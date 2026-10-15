import { query } from "../db";
import crypto from "crypto";
import { computeImageDHash, checkPhotoFreshness } from "./phash";
import { parsePromptPaySlipImage, checkSlipUniqueness } from "./slipOcr";
import { awardUserEpochPoints, UserEpochReward } from "./epoch";
import { dispatchRandomShopVoice, ShopVoiceRecord } from "./elevenlabs";

export interface SubmitReviewParams {
  placeId: string;
  reviewerAddress: string;
  rating: number;
  reviewText: string;
  foodPhotoImageBase64?: string;
  foodPhotoImageBuffer?: Buffer;
  slipImageBase64?: string;
  slipImageBuffer?: Buffer;
  simulatedSlipAmount?: number;
  simulatedSlipRefId?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
}

export interface ReviewSubmissionResult {
  success: boolean;
  reviewId: string;
  placeId: string;
  placeName: string;
  reviewerAddress: string;
  rating: number;
  verificationTier: number;
  basePoints: number;
  isPioneer: boolean;
  pioneerSlot: number | null;
  pointsMultiplier: number;
  totalPointsAwarded: number;
  newPioneerClaimed: boolean;
  epochReward: UserEpochReward;
  dispatchedVoice: ShopVoiceRecord;
  slipDetails?: {
    amountThb: number;
    refId: string;
    slipRefHash: string;
  };
  photoHash?: string;
}

/**
 * Calculates review activity points and applies the Pioneer 2x multiplier rule:
 * - Food photo (unique pHash): +1 point
 * - Slip OCR < 150 THB: +1 point
 * - Slip OCR >= 150 THB: +3 points
 * - Pioneer 2x Multiplier: if user is one of the 3 Pioneers, points are doubled (x2)!
 */
export function calculateReviewPoints(params: {
  hasValidPhoto: boolean;
  slipAmountThb: number;
  isPioneer: boolean;
}): { basePoints: number; pointsMultiplier: number; finalPoints: number } {
  const { hasValidPhoto, slipAmountThb, isPioneer } = params;

  let basePoints = 0;
  if (hasValidPhoto) {
    basePoints += 1;
  }

  if (slipAmountThb > 0) {
    if (slipAmountThb < 150) {
      basePoints += 1;
    } else {
      basePoints += 3;
    }
  }

  // Fallback 1 point for high-effort text review if neither receipt nor photo provided
  if (basePoints === 0) {
    basePoints = 1;
  }

  const pointsMultiplier = isPioneer ? 2 : 1;
  const finalPoints = basePoints * pointsMultiplier;

  return {
    basePoints,
    pointsMultiplier,
    finalPoints,
  };
}

/**
 * Submits a verified review, checks quotas, deduplicates slip & photo,
 * awards daily activity points with Pioneer 2x boost, and claims Pioneer slot if available.
 */
export async function submitVerifiedReview(
  params: SubmitReviewParams
): Promise<ReviewSubmissionResult> {
  const {
    placeId,
    reviewerAddress,
    rating,
    reviewText,
    foodPhotoImageBase64,
    foodPhotoImageBuffer,
    slipImageBase64,
    slipImageBuffer,
    simulatedSlipAmount,
    simulatedSlipRefId,
    gpsLatitude,
    gpsLongitude,
  } = params;

  const normAddress = reviewerAddress.toLowerCase().trim();

  // 1. Verify place exists
  const placeRes = await query<{ id: string; name: string }>(
    `SELECT id, name FROM places WHERE place_id = $1`,
    [placeId]
  );
  if (placeRes.rows.length === 0) {
    throw new Error(`Venue ${placeId} not found`);
  }
  const placeName = placeRes.rows[0].name;

  // 2. Validate Daily Review Quotas (Max 3 / place / day, Max 10 / day overall)
  const [venueReviewCountRes, totalReviewCountRes] = await Promise.all([
    query<{ count: number }>(
      `SELECT COUNT(*)::int as count 
       FROM verified_reviews 
       WHERE LOWER(reviewer_address) = $1 
         AND place_id = $2 
         AND created_at >= CURRENT_DATE`,
      [normAddress, placeId]
    ),
    query<{ count: number }>(
      `SELECT COUNT(*)::int as count 
       FROM verified_reviews 
       WHERE LOWER(reviewer_address) = $1 
         AND created_at >= CURRENT_DATE`,
      [normAddress]
    ),
  ]);

  const venueReviewsToday = venueReviewCountRes.rows[0]?.count || 0;
  const totalReviewsToday = totalReviewCountRes.rows[0]?.count || 0;

  if (venueReviewsToday >= 3) {
    const error: any = new Error(
      `Daily limit reached: Maximum 3 reviews per venue per day allowed (${venueReviewsToday}/3 used).`
    );
    error.code = "DAILY_VENUE_LIMIT_EXCEEDED";
    error.status = 429;
    throw error;
  }

  if (totalReviewsToday >= 10) {
    const error: any = new Error(
      `Daily total limit reached: Maximum 10 reviews per day allowed across all venues (${totalReviewsToday}/10 used).`
    );
    error.code = "DAILY_TOTAL_LIMIT_EXCEEDED";
    error.status = 429;
    throw error;
  }

  // 3. Process Food Photo Freshness (pHash)
  let photoDHash: string | undefined = undefined;
  let hasValidPhoto = false;

  const photoBuffer =
    foodPhotoImageBuffer ||
    (foodPhotoImageBase64
      ? Buffer.from(
          foodPhotoImageBase64.replace(/^data:image\/\w+;base64,/, ""),
          "base64"
        )
      : undefined);

  if (photoBuffer && photoBuffer.length > 0) {
    photoDHash = await computeImageDHash(photoBuffer);
    const freshness = await checkPhotoFreshness(photoDHash);
    if (freshness.isDuplicate) {
      const error: any = new Error(
        `Duplicate food photo detected (Hamming distance ${freshness.minDistance} <= 5). Please upload a fresh in-store photo.`
      );
      error.code = "DUPLICATE_PHOTO";
      error.status = 400;
      throw error;
    }
    hasValidPhoto = true;
  }

  // 4. Process PromptPay Slip OCR
  let ocrResult: any = undefined;
  let slipAmountThb = 0;
  let slipRefHash: string | undefined = undefined;

  const hasSlipInput =
    slipImageBase64 ||
    slipImageBuffer ||
    simulatedSlipAmount !== undefined ||
    simulatedSlipRefId !== undefined;

  if (hasSlipInput) {
    ocrResult = await parsePromptPaySlipImage({
      imageBase64: slipImageBase64,
      imageBuffer: slipImageBuffer,
      simulatedAmount: simulatedSlipAmount,
      simulatedRefId: simulatedSlipRefId,
    });

    slipAmountThb = ocrResult.amountThb;
    slipRefHash = ocrResult.slipRefHash;

    // Check Slip Replay Anti-Fraud
    const slipCheck = await checkSlipUniqueness(slipRefHash);
    if (slipCheck.isDuplicate) {
      const error: any = new Error(
        `Payment slip has already been claimed in a prior review (Ref Hash: ${slipRefHash.slice(0, 16)}...). Anti-replay violation.`
      );
      error.code = "DUPLICATE_SLIP";
      error.status = 400;
      throw error;
    }
  }

  // 5. Check Pioneer Status of User
  const existingPioneerRes = await query<{ slot_index: number }>(
    `SELECT slot_index FROM pioneer_claims 
     WHERE place_id = $1 AND LOWER(pioneer_address) = $2`,
    [placeId, normAddress]
  );

  let isPioneer = existingPioneerRes.rows.length > 0;
  let pioneerSlot = isPioneer ? existingPioneerRes.rows[0].slot_index : null;
  let newPioneerClaimed = false;

  // 6. Calculate Points with Pioneer 2x Multiplier
  const { basePoints, pointsMultiplier, finalPoints } = calculateReviewPoints({
    hasValidPhoto,
    slipAmountThb,
    isPioneer,
  });

  // Determine Verification Tier (1: Basic, 2: Photo, 3: Full Slip + Photo)
  const verificationTier = hasValidPhoto && slipAmountThb > 0 ? 3 : hasValidPhoto ? 2 : 1;
  const placeHash = `0x${Buffer.from(placeId).toString("hex").slice(0, 64).padEnd(64, "0")}`;
  const effectiveTxHash = `0x${crypto.randomBytes(32).toString("hex")}`;

  // 7. Insert Verified Review
  const reviewInsertRes = await query<{ id: string }>(
    `INSERT INTO verified_reviews 
      (place_id, place_hash, reviewer_address, rating, review_text, verification_tier, 
       gps_latitude, gps_longitude, slip_amount_thb, slip_ref_hash, slip_ocr_raw, 
       food_photo_phash, is_pioneer, pioneer_slot, onchain_tx_hash, epoch_points_awarded, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'CONFIRMED')
     RETURNING id`,
    [
      placeId,
      placeHash,
      normAddress,
      rating,
      reviewText,
      verificationTier,
      gpsLatitude || null,
      gpsLongitude || null,
      slipAmountThb > 0 ? slipAmountThb : null,
      slipRefHash || null,
      ocrResult ? JSON.stringify(ocrResult.rawJson) : null,
      photoDHash || null,
      isPioneer,
      pioneerSlot,
      effectiveTxHash,
      finalPoints,
    ]
  );
  const reviewId = reviewInsertRes.rows[0].id;

  // 8. Auto-claim Pioneer Slot if place has < 3 pioneers and user is not yet a pioneer
  if (!isPioneer) {
    const currentPioneersRes = await query<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM pioneer_claims WHERE place_id = $1`,
      [placeId]
    );
    const pioneerCount = currentPioneersRes.rows[0]?.count || 0;

    if (pioneerCount < 3) {
      const assignedSlot = pioneerCount + 1;
      await query(
        `INSERT INTO pioneer_claims 
          (place_id, place_hash, slot_index, pioneer_address, review_id, onchain_tx_hash, total_royalty_earned_avax, claimed_at)
         VALUES ($1, $2, $3, $4, $5, $6, 0, NOW())
         ON CONFLICT (place_id, slot_index) DO NOTHING`,
        [placeId, placeHash, assignedSlot, normAddress, reviewId, effectiveTxHash]
      );

      // Update review with newly claimed pioneer status
      await query(
        `UPDATE verified_reviews 
         SET is_pioneer = true, pioneer_slot = $2 
         WHERE id = $1`,
        [reviewId, assignedSlot]
      );

      isPioneer = true;
      pioneerSlot = assignedSlot;
      newPioneerClaimed = true;
    }
  }

  // 9. Award Epoch Points in 10,000 $TASTE Mining Pool
  const epochReward = await awardUserEpochPoints(normAddress, finalPoints);

  // 10. Dispatch Shop Voice Greeting
  const dispatchedVoice = await dispatchRandomShopVoice(placeId);

  return {
    success: true,
    reviewId,
    placeId,
    placeName,
    reviewerAddress: normAddress,
    rating,
    verificationTier,
    basePoints,
    isPioneer,
    pioneerSlot,
    pointsMultiplier,
    totalPointsAwarded: finalPoints,
    newPioneerClaimed,
    epochReward,
    dispatchedVoice,
    slipDetails: ocrResult
      ? {
          amountThb: ocrResult.amountThb,
          refId: ocrResult.refId,
          slipRefHash: ocrResult.slipRefHash,
        }
      : undefined,
    photoHash: photoDHash,
  };
}
