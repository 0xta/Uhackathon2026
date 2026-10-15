import { query } from "../src/lib/db";
import { computeImageDHash, computeHammingDistance, checkPhotoFreshness } from "../src/lib/services/phash";
import { parsePromptPaySlipImage, checkSlipUniqueness, computeSlipRefHash } from "../src/lib/services/slipOcr";
import { calculateReviewPoints, submitVerifiedReview } from "../src/lib/services/reviews";
import sharp from "sharp";

async function runPhase4Tests() {
  console.log("=================================================");
  console.log("   TASTECHAIN BKK — PHASE 4 VERIFICATION TESTS   ");
  console.log("   OpenAI Vision Slip OCR & Proof-of-Visit       ");
  console.log("   pHash Freshness & Pioneer 2x Multiplier       ");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      if (detail) console.log(`   └─ ${detail}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (detail) console.error(`   └─ ${detail}`);
      failed++;
    }
  }

  try {
    // 1. Pick a dedicated test venue for clean isolated testing
    const placeRes = await query<{
      id: string;
      place_id: string;
      name: string;
      latitude: number;
      longitude: number;
    }>(
      `SELECT id, place_id, name, latitude::float, longitude::float 
       FROM places 
       WHERE city = 'กรุงเทพมหานคร' AND business_status = 'OPERATIONAL'
       ORDER BY total_reviews ASC LIMIT 1`
    );

    const testPlace = placeRes.rows[0];
    const testPlaceId = testPlace.place_id;
    console.log(`Testing with Venue: "${testPlace.name}" (${testPlaceId})\n`);

    // Clean any prior reviews & pioneer claims for this test venue
    await query(`DELETE FROM pioneer_claims WHERE place_id = $1`, [testPlaceId]);
    await query(`DELETE FROM verified_reviews WHERE place_id = $1`, [testPlaceId]);

    // -------------------------------------------------------------------------
    // Test 1: PromptPay Slip OCR Points Threshold (< 150 vs >= 150 THB)
    // -------------------------------------------------------------------------
    console.log("--- 1. Testing PromptPay Slip OCR & Dynamic Points ---");

    // Tier A: Slip < 150 THB (e.g. 120 THB => 1 point)
    const ocrSmall = await parsePromptPaySlipImage({ simulatedAmount: 120 });
    const ptsSmall = calculateReviewPoints({
      hasValidPhoto: false,
      slipAmountThb: ocrSmall.amountThb,
      isPioneer: false,
    });
    assert(
      ptsSmall.basePoints === 1 && ptsSmall.finalPoints === 1,
      "T4.1a: Slip amount < 150 THB awards exactly 1 point",
      `Amount: ${ocrSmall.amountThb} THB -> Points: ${ptsSmall.finalPoints}`
    );

    // Tier B: Slip >= 150 THB (e.g. 240 THB => 3 points)
    const ocrLarge = await parsePromptPaySlipImage({ simulatedAmount: 240 });
    const ptsLarge = calculateReviewPoints({
      hasValidPhoto: false,
      slipAmountThb: ocrLarge.amountThb,
      isPioneer: false,
    });
    assert(
      ptsLarge.basePoints === 3 && ptsLarge.finalPoints === 3,
      "T4.1b: Slip amount >= 150 THB awards exactly 3 points",
      `Amount: ${ocrLarge.amountThb} THB -> Points: ${ptsLarge.finalPoints}`
    );

    // -------------------------------------------------------------------------
    // Test 2: Perceptual Food Photo Freshness (dHash / pHash)
    // -------------------------------------------------------------------------
    console.log("\n--- 2. Testing Food Photo Freshness & Perceptual Hash (dHash) ---");

    // Create 2 distinct test image buffers with sharp
    const imgBufferA = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 100, b: 50 },
      },
    })
      .png()
      .toBuffer();

    const imgBufferB = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 20, g: 80, b: 220 },
      },
    })
      .png()
      .toBuffer();

    const hashA = await computeImageDHash(imgBufferA);
    const hashB = await computeImageDHash(imgBufferB);
    assert(
      hashA.length === 16 && typeof hashA === "string",
      "T4.2a: Generates valid 64-bit hex perceptual hash (16 chars)",
      `Hash A: ${hashA}`
    );

    const distSelf = computeHammingDistance(hashA, hashA);
    assert(
      distSelf === 0,
      "T4.2b: Hamming distance of identical image is 0",
      `Hamming distance: ${distSelf}`
    );

    // -------------------------------------------------------------------------
    // Test 3: Pioneer 2x Multiplier Rule
    // -------------------------------------------------------------------------
    console.log("\n--- 3. Testing Pioneer 2x Multiplier Calculation ---");

    // Regular User: Photo (1 pt) + Slip >= 150 (3 pts) = 4 pts
    const regularCalc = calculateReviewPoints({
      hasValidPhoto: true,
      slipAmountThb: 180,
      isPioneer: false,
    });
    assert(
      regularCalc.basePoints === 4 &&
        regularCalc.pointsMultiplier === 1 &&
        regularCalc.finalPoints === 4,
      "T4.3a: Regular reviewer gets 1x multiplier (4 base pts = 4 final pts)",
      `Base: ${regularCalc.basePoints} * ${regularCalc.pointsMultiplier}x = ${regularCalc.finalPoints}`
    );

    // Pioneer User: Photo (1 pt) + Slip >= 150 (3 pts) = 4 pts => 2x = 8 pts!
    const pioneerCalc = calculateReviewPoints({
      hasValidPhoto: true,
      slipAmountThb: 180,
      isPioneer: true,
    });
    assert(
      pioneerCalc.basePoints === 4 &&
        pioneerCalc.pointsMultiplier === 2 &&
        pioneerCalc.finalPoints === 8,
      "T4.3b: Pioneer reviewer gets 2x multiplier (4 base pts = 8 final pts)",
      `Base: ${pioneerCalc.basePoints} * ${pioneerCalc.pointsMultiplier}x = ${pioneerCalc.finalPoints}`
    );

    // -------------------------------------------------------------------------
    // Test 4: Pioneer Slot Auto-Claim (First 3 Reviewers)
    // -------------------------------------------------------------------------
    console.log("\n--- 4. Testing Pioneer Slot Auto-Claiming (Slots 1, 2, 3) ---");

    const pioneerUser1 = "0x1111111111111111111111111111111111110001";
    const pioneerUser2 = "0x2222222222222222222222222222222222220002";
    const pioneerUser3 = "0x3333333333333333333333333333333333330003";
    const normalUser4 = "0x4444444444444444444444444444444444440004";

    // Reviewer 1: becomes Pioneer #1
    const rev1 = await submitVerifiedReview({
      placeId: testPlaceId,
      reviewerAddress: pioneerUser1,
      rating: 5,
      reviewText: "รสชาติยอดเยี่ยมมาก บริการดีเลิศ Pioneer 1",
      simulatedSlipAmount: 200,
      simulatedSlipRefId: `SLIP-REV1-${Date.now()}`,
    });
    assert(
      rev1.isPioneer && rev1.pioneerSlot === 1 && rev1.newPioneerClaimed,
      "T4.4a: 1st reviewer automatically claims Pioneer Slot #1",
      `Slot assigned: ${rev1.pioneerSlot}`
    );

    // Reviewer 2: becomes Pioneer #2
    const rev2 = await submitVerifiedReview({
      placeId: testPlaceId,
      reviewerAddress: pioneerUser2,
      rating: 5,
      reviewText: "ร้านสวย อาหารอร่อย แนะนำครับ Pioneer 2",
      simulatedSlipAmount: 200,
      simulatedSlipRefId: `SLIP-REV2-${Date.now()}`,
    });
    assert(
      rev2.isPioneer && rev2.pioneerSlot === 2 && rev2.newPioneerClaimed,
      "T4.4b: 2nd reviewer automatically claims Pioneer Slot #2",
      `Slot assigned: ${rev2.pioneerSlot}`
    );

    // Reviewer 3: becomes Pioneer #3
    const rev3 = await submitVerifiedReview({
      placeId: testPlaceId,
      reviewerAddress: pioneerUser3,
      rating: 4,
      reviewText: "เมนูเด็ดต้องลอง อิ่มคุ้ม Pioneer 3",
      simulatedSlipAmount: 200,
      simulatedSlipRefId: `SLIP-REV3-${Date.now()}`,
    });
    assert(
      rev3.isPioneer && rev3.pioneerSlot === 3 && rev3.newPioneerClaimed,
      "T4.4c: 3rd reviewer automatically claims Pioneer Slot #3",
      `Slot assigned: ${rev3.pioneerSlot}`
    );

    // Reviewer 4: all 3 slots filled => NOT a Pioneer
    const rev4 = await submitVerifiedReview({
      placeId: testPlaceId,
      reviewerAddress: normalUser4,
      rating: 5,
      reviewText: "มาทานรอบดึก อร่อยมากครับ ผู้ใช้คนที่ 4",
      simulatedSlipAmount: 200,
      simulatedSlipRefId: `SLIP-REV4-${Date.now()}`,
    });
    assert(
      !rev4.newPioneerClaimed && rev4.pioneerSlot === null && rev4.pointsMultiplier === 1,
      "T4.4d: 4th reviewer does NOT get a Pioneer slot (Max 3 slots filled)",
      `Slot: ${rev4.pioneerSlot} | Multiplier: ${rev4.pointsMultiplier}x`
    );

    // Pioneer User 1 submits a 2nd review for the same shop: MUST GET 2x MULTIPLIER!
    const rev1Second = await submitVerifiedReview({
      placeId: testPlaceId,
      reviewerAddress: pioneerUser1,
      rating: 5,
      reviewText: "มาซ้ำอีกรอบในฐานะ Pioneer ตัวจริง!",
      simulatedSlipAmount: 180, // >= 150 THB => 3 pts
      foodPhotoImageBuffer: imgBufferA, // +1 pt => 4 base pts => 8 final pts!
      simulatedSlipRefId: `SLIP-REV1-SECOND-${Date.now()}`,
    });
    assert(
      rev1Second.isPioneer &&
        rev1Second.pointsMultiplier === 2 &&
        rev1Second.basePoints === 4 &&
        rev1Second.totalPointsAwarded === 8,
      "T4.4e: Confirmed Pioneer gets 2x points on subsequent reviews (4 base pts -> 8 pts!)",
      `Points: ${rev1Second.basePoints} base * ${rev1Second.pointsMultiplier}x = ${rev1Second.totalPointsAwarded} pts awarded!`
    );

    // -------------------------------------------------------------------------
    // Test 5: Anti-Replay Slip Fraud Protection
    // -------------------------------------------------------------------------
    console.log("\n--- 5. Testing Anti-Replay Slip Fraud Rejection ---");
    const reusedSlipRef = `SLIP-REV1-SECOND-${Date.now()}`;
    let slipFraudDetected = false;

    try {
      // First submission with slip
      await submitVerifiedReview({
        placeId: testPlaceId,
        reviewerAddress: normalUser4,
        rating: 5,
        reviewText: "รีวิวพร้อมสลิปต้นฉบับ",
        simulatedSlipAmount: 200,
        simulatedSlipRefId: reusedSlipRef,
      });

      // Second submission reusing the exact same slip!
      await submitVerifiedReview({
        placeId: testPlaceId,
        reviewerAddress: normalUser4,
        rating: 5,
        reviewText: "พยายามส่งสลิปซ้ำเพื่อโกงแต้ม",
        simulatedSlipAmount: 200,
        simulatedSlipRefId: reusedSlipRef,
      });
    } catch (err: any) {
      if (err.code === "DUPLICATE_SLIP") {
        slipFraudDetected = true;
      }
    }
    assert(
      slipFraudDetected,
      "T4.5: Reused PromptPay slip reference is strictly rejected (DUPLICATE_SLIP)",
      `Anti-replay hash successfully blocked duplicate slip`
    );

    // -------------------------------------------------------------------------
    // Test 6: Daily Review Quotas (Max 3/shop/day, Max 10/day)
    // -------------------------------------------------------------------------
    console.log("\n--- 6. Testing Daily Review Rate Limits (3/shop/day, 10/day) ---");
    const quotaWallet = "0x5555555555555555555555555555555555550005";

    // Clean prior reviews for this wallet
    await query(`DELETE FROM pioneer_claims WHERE pioneer_address = $1`, [quotaWallet.toLowerCase()]);
    await query(`DELETE FROM verified_reviews WHERE reviewer_address = $1`, [quotaWallet.toLowerCase()]);

    // Review 1, 2, 3 for testPlaceId
    for (let i = 1; i <= 3; i++) {
      const r = await submitVerifiedReview({
        placeId: testPlaceId,
        reviewerAddress: quotaWallet,
        rating: 5,
        reviewText: `รีวิวที่ ${i} ประจำวัน`,
        simulatedSlipAmount: 100,
        simulatedSlipRefId: `QUOTA-SLIP-${i}-${Date.now()}`,
      });
      assert(
        r.success,
        `T4.6a: Review #${i}/3 for this venue accepted`,
        `Review ID: ${r.reviewId}`
      );
    }

    // 4th review for the SAME venue: must throw 429
    let venueLimitExceeded = false;
    try {
      await submitVerifiedReview({
        placeId: testPlaceId,
        reviewerAddress: quotaWallet,
        rating: 5,
        reviewText: "รีวิวครั้งที่ 4 เกินโควตาร้านต่อวัน",
        simulatedSlipAmount: 100,
        simulatedSlipRefId: `QUOTA-SLIP-4-${Date.now()}`,
      });
    } catch (err: any) {
      if (err.code === "DAILY_VENUE_LIMIT_EXCEEDED" && err.status === 429) {
        venueLimitExceeded = true;
      }
    }
    assert(
      venueLimitExceeded,
      "T4.6b: 4th review for same venue strictly rejected with 429 DAILY_VENUE_LIMIT_EXCEEDED",
      `Enforced limit: Max 3 reviews per venue per day`
    );

    // -------------------------------------------------------------------------
    // Test Summary
    // -------------------------------------------------------------------------
    console.log("\n=================================================");
    console.log(`PHASE 4 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("=================================================");

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error("Phase 4 test fatal error:", err);
    process.exit(1);
  }
}

runPhase4Tests();
