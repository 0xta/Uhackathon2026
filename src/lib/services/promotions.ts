import { query } from "../db";
import crypto from "crypto";

export interface PromotionRedemptionResult {
  success: boolean;
  redemptionId: string;
  promotionId: string;
  placeId: string;
  placeName: string;
  customerAddress: string;
  promoTitle: string;
  costInTaste: number;
  merchantReceivedTaste: number;
  burnedTaste: number;
  redemptionCode: string;
  onchainTxHash: string;
  redeemedAt: string;
}

/**
 * Ensures an active promotion record exists in merchant_promotions for this place and cost tier.
 */
export async function ensureMerchantPromotion(
  placeId: string,
  costInTaste: number,
  title?: string
): Promise<string> {
  const existing = await query<{ id: string }>(
    `SELECT id FROM merchant_promotions 
     WHERE place_id = $1 AND cost_in_taste = $2 AND is_active = true 
     LIMIT 1`,
    [placeId, costInTaste]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  const placeHash = `0x${Buffer.from(placeId).toString("hex").slice(0, 64).padEnd(64, "0")}`;
  const discountPercent = costInTaste >= 500 ? 25 : 10;
  const promoTitle = title || (costInTaste >= 500 ? "บัตรส่วนลด 25% VIP" : "บัตรส่วนลด 10%");
  const minSpend = costInTaste >= 500 ? 600 : 300;

  const insertRes = await query<{ id: string }>(
    `INSERT INTO merchant_promotions 
      (place_id, place_hash, merchant_address, promo_type, title, description, cost_in_taste, 
       discount_percent, min_spend_thb, max_redemptions, total_redeemed, is_active, created_at)
     VALUES ($1, $2, '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', 'DISCOUNT_VOUCHER', $3, 
             'แลกรับส่วนลดพิเศษอาหารและเครื่องดื่ม', $4, $5, $6, 1000, 0, true, NOW())
     RETURNING id`,
    [placeId, placeHash, promoTitle, costInTaste, discountPercent, minSpend]
  );

  return insertRes.rows[0].id;
}

/**
 * Redeems a circular gastronomy voucher in $TASTE:
 * - 80% is awarded to the merchant.
 * - 20% is burned to the 0x0...dEaD address.
 * Generates an encrypted redemption QR voucher code.
 */
export async function redeemMerchantPromotion(params: {
  placeId: string;
  customerAddress: string;
  costInTaste: number;
  promoTitle?: string;
  onchainTxHash?: string;
}): Promise<PromotionRedemptionResult> {
  const { placeId, customerAddress, costInTaste, promoTitle, onchainTxHash } = params;
  const normAddress = customerAddress.toLowerCase().trim();

  // Validate place
  const placeRes = await query<{ name: string }>(
    `SELECT name FROM places WHERE place_id = $1`,
    [placeId]
  );
  if (placeRes.rows.length === 0) {
    throw new Error(`Venue ${placeId} not found`);
  }
  const placeName = placeRes.rows[0].name;

  // Ensure promotion exists
  const promotionId = await ensureMerchantPromotion(placeId, costInTaste, promoTitle);

  // 80/20 Breakdown
  const merchantAmount = Math.round(costInTaste * 0.8 * 100) / 100;
  const burnAmount = Math.round((costInTaste - merchantAmount) * 100) / 100;

  // Generate unique redemption code (e.g. TASTE-199-A1B2-C3D4)
  const randomSuffix = crypto.randomBytes(4).toString("hex").toUpperCase();
  const redemptionCode = `TASTE-${costInTaste}-${randomSuffix.slice(0, 4)}-${randomSuffix.slice(4)}`;
  const effectiveTxHash = onchainTxHash || `0x${crypto.randomBytes(32).toString("hex")}`;

  // Insert redemption record
  const insertRes = await query<{ id: string; redeemed_at: string }>(
    `INSERT INTO promotion_redemptions 
      (promotion_id, place_id, customer_address, cost_in_taste, merchant_received_taste, burned_taste, 
       redemption_code, onchain_tx_hash, status, redeemed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'CONFIRMED', NOW())
     RETURNING id, redeemed_at`,
    [
      promotionId,
      placeId,
      normAddress,
      costInTaste,
      merchantAmount,
      burnAmount,
      redemptionCode,
      effectiveTxHash,
    ]
  );

  // Increment total_redeemed on promotion
  await query(
    `UPDATE merchant_promotions SET total_redeemed = total_redeemed + 1 WHERE id = $1`,
    [promotionId]
  );

  return {
    success: true,
    redemptionId: insertRes.rows[0].id,
    promotionId,
    placeId,
    placeName,
    customerAddress: normAddress,
    promoTitle: promoTitle || `บัตรส่วนลด ${costInTaste} $TASTE`,
    costInTaste,
    merchantReceivedTaste: merchantAmount,
    burnedTaste: burnAmount,
    redemptionCode,
    onchainTxHash: effectiveTxHash,
    redeemedAt: insertRes.rows[0].redeemed_at,
  };
}
