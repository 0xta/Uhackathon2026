import { query } from "../src/lib/db";
import { getBangkokPlaces, getPlaceById } from "../src/lib/services/places";
import { isWithinGeofence } from "../src/lib/services/geofence";
import { ensurePlaceVoices, dispatchRandomShopVoice } from "../src/lib/services/elevenlabs";
import { submitVerifiedReview } from "../src/lib/services/reviews";
import { generateClaimSignature } from "../src/lib/services/claimSignature";
import { redeemMerchantPromotion } from "../src/lib/services/promotions";
import { ethers } from "ethers";
import sharp from "sharp";

async function runPhase6E2ETests() {
  console.log("=================================================");
  console.log("   TASTECHAIN BKK — PHASE 6 END-TO-END DEMO      ");
  console.log("   1-Click Judge Guided User Journey Test        ");
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
    const judgeWallet = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const todayDate = "2026-10-15";

    // Create 2 distinct fresh food photos with authentic pixel gradients
    const foodImgA = await sharp(
      Buffer.from(
        Array.from({ length: 64 * 64 * 3 }, (_, idx) => (idx * 17 + Math.floor(Date.now() / 1000)) % 256)
      ),
      { raw: { width: 64, height: 64, channels: 3 } }
    ).png().toBuffer();

    const foodImgB = await sharp(
      Buffer.from(
        Array.from({ length: 64 * 64 * 3 }, (_, idx) => (idx * 31 + Math.floor(Date.now() / 1000) + 77) % 256)
      ),
      { raw: { width: 64, height: 64, channels: 3 } }
    ).png().toBuffer();

    // -------------------------------------------------------------------------
    // Step 1: Bangkok Venue Discovery (Ban That Thong / Silom)
    // -------------------------------------------------------------------------
    console.log("--- Step 1: Discovering Bangkok F&B Venue ---");
    const searchRes = await getBangkokPlaces({ q: "สาทร", limit: 5 });
    assert(
      searchRes.places.length > 0,
      "E2E-1: Query Bangkok F&B venues via multi-criteria engine",
      `Found ${searchRes.places.length} matching venues | Top place: "${searchRes.places[0].name}"`
    );

    const demoPlace = searchRes.places[0];
    const placeId = demoPlace.place_id;

    // Clean prior test reviews/checkins for clean run
    await query(`DELETE FROM in_store_qr_checkins WHERE customer_address = $1`, [judgeWallet.toLowerCase()]);
    await query(`DELETE FROM pioneer_claims WHERE place_id = $1`, [placeId]);
    await query(`DELETE FROM verified_reviews WHERE place_id = $1`, [placeId]);

    // -------------------------------------------------------------------------
    // Step 2: ElevenLabs Shop Voice Studio Verification
    // -------------------------------------------------------------------------
    console.log("\n--- Step 2: Verifying ElevenLabs AI Shop Voice Studio ---");
    const voices = await ensurePlaceVoices(placeId, demoPlace.name);
    assert(
      voices.length === 3,
      "E2E-2a: Venue has 3 active ElevenLabs greeting voices",
      `Slots: ${voices.map((v) => `#${v.slot_number} (${v.title})`).join(", ")}`
    );

    const dispatchedVoice = await dispatchRandomShopVoice(placeId);
    assert(
      dispatchedVoice.slot_number >= 1 && dispatchedVoice.slot_number <= 3,
      "E2E-2b: Random 1-in-3 voice dispatch dispatches active greeting",
      `Dispatched: Slot #${dispatchedVoice.slot_number} ("${dispatchedVoice.title}")`
    );

    // -------------------------------------------------------------------------
    // Step 3: Front-Shop QR Check-in (Proximity & +3 Points)
    // -------------------------------------------------------------------------
    console.log("\n--- Step 3: In-Store Front-Shop QR Check-in (Proof-of-Visit) ---");
    const venueLat = Number(demoPlace.latitude || 13.724883);
    const venueLng = Number(demoPlace.longitude || 100.530706);

    const checkinReq = await fetch("http://localhost:3001/api/checkin/qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        placeId,
        customerAddress: judgeWallet,
        latitude: venueLat,
        longitude: venueLng,
      }),
    });
    const checkinRes = await checkinReq.json();
    assert(
      checkinReq.status === 200 && checkinRes.success && checkinRes.pointsAwarded === 3,
      "E2E-3: In-store QR check-in awards 3 daily activity points and dispatches shop voice",
      `Check-in ID: ${checkinRes.checkinId} | Distance: ${checkinRes.distanceMeters}m | Points: +${checkinRes.pointsAwarded}`
    );

    // -------------------------------------------------------------------------
    // Step 4: First Review Submission & Pioneer Slot #1 Auto-Claim
    // -------------------------------------------------------------------------
    console.log("\n--- Step 4: Submitting First Verified Review (Claiming Pioneer #1) ---");
    const firstReview = await submitVerifiedReview({
      placeId,
      reviewerAddress: judgeWallet,
      rating: 5,
      reviewText: "เป็นลูกค้ารายแรกที่มารีวิว อร่อยสมคำร่ำลือ!",
      simulatedSlipAmount: 185, // >= 150 THB => 3 pts
      foodPhotoImageBuffer: foodImgA, // 1 pt
      simulatedSlipRefId: `JUDGE-SLIP-1-${Date.now()}`,
    });
    assert(
      firstReview.isPioneer && firstReview.pioneerSlot === 1 && firstReview.newPioneerClaimed,
      "E2E-4a: 1st reviewer automatically claims Pioneer Slot #1",
      `Assigned Pioneer Slot: #${firstReview.pioneerSlot}`
    );
    assert(
      firstReview.basePoints === 4 && firstReview.totalPointsAwarded === 4,
      "E2E-4b: First review earns 4 base points (3 pts slip + 1 pt photo)",
      `Points: ${firstReview.totalPointsAwarded} pts`
    );

    // -------------------------------------------------------------------------
    // Step 5: Second Review by Pioneer (Pioneer 2x Multiplier Rule)
    // -------------------------------------------------------------------------
    console.log("\n--- Step 5: Second Review by Confirmed Pioneer (Testing 2x Multiplier) ---");
    const secondReview = await submitVerifiedReview({
      placeId,
      reviewerAddress: judgeWallet,
      rating: 5,
      reviewText: "กลับมาทานซ้ำในฐานะ Pioneer ตัวจริง อาหารยังคงสุดยอด!",
      simulatedSlipAmount: 200, // >= 150 THB => 3 pts
      foodPhotoImageBuffer: foodImgB, // 1 pt
      simulatedSlipRefId: `JUDGE-SLIP-2-${Date.now()}`,
    });
    assert(
      secondReview.isPioneer &&
        secondReview.pointsMultiplier === 2 &&
        secondReview.basePoints === 4 &&
        secondReview.totalPointsAwarded === 8,
      "E2E-5: Confirmed Pioneer receives 2x Multiplier on review (4 base pts -> 8 pts!)",
      `Base: ${secondReview.basePoints} * ${secondReview.pointsMultiplier}x = ${secondReview.totalPointsAwarded} pts`
    );

    // -------------------------------------------------------------------------
    // Step 6: Mechanism B Oracle ECDSA Claim Signature
    // -------------------------------------------------------------------------
    console.log("\n--- Step 6: Claiming Daily 10,000 $TASTE Mining Pool (Mechanism B) ---");
    const claimSig = await generateClaimSignature(judgeWallet, todayDate);
    assert(
      claimSig.signature.startsWith("0x") && claimSig.userPoints >= 15,
      "E2E-6a: Generates valid Oracle ECDSA claim signature for accumulated points",
      `User cumulative points: ${claimSig.userPoints} pts | Estimated reward: ${claimSig.rewardTasteFormatted} $TASTE`
    );

    const packedMsg = ethers.solidityPackedKeccak256(
      ["address", "uint256", "uint256"],
      [judgeWallet.toLowerCase(), claimSig.epochDateUint, claimSig.userPoints]
    );
    const recoveredSigner = ethers.verifyMessage(ethers.getBytes(packedMsg), claimSig.signature);
    assert(
      recoveredSigner.toLowerCase() === claimSig.oracleAddress.toLowerCase(),
      "E2E-6b: Cryptographic signature verified against Oracle address",
      `Recovered: ${recoveredSigner}`
    );

    // -------------------------------------------------------------------------
    // Step 7: Circular Gastronomy Promotion Redemption (80/20 Burn)
    // -------------------------------------------------------------------------
    console.log("\n--- Step 7: Circular Gastronomy Promotion (80% Merchant / 20% Burn) ---");
    const promoRedeem = await redeemMerchantPromotion({
      placeId,
      customerAddress: judgeWallet,
      costInTaste: 199,
      promoTitle: "บัตรส่วนลด 10% (199 $TASTE)",
    });
    assert(
      promoRedeem.merchantReceivedTaste === 159.2 && promoRedeem.burnedTaste === 39.8,
      "E2E-7a: 199 $TASTE voucher allocates 80% to merchant (159.2) and burns 20% (39.8)",
      `Merchant payout: ${promoRedeem.merchantReceivedTaste} $TASTE | Deflationary burn: ${promoRedeem.burnedTaste} $TASTE`
    );
    assert(
      promoRedeem.redemptionCode.startsWith("TASTE-199-"),
      "E2E-7b: Cashier redemption code issued",
      `Voucher Code: ${promoRedeem.redemptionCode}`
    );

    // -------------------------------------------------------------------------
    // Step 8: Daily Limit Guard (Max 3 reviews per venue per day)
    // -------------------------------------------------------------------------
    console.log("\n--- Step 8: Enforcing Daily Limits (Max 3 / venue / day) ---");
    // Submit 3rd review for this venue (should succeed, count = 3)
    const thirdReview = await submitVerifiedReview({
      placeId,
      reviewerAddress: judgeWallet,
      rating: 4,
      reviewText: "รีวิวรอบที่ 3 ตามโควตาสูงสุดประจำวัน",
      simulatedSlipAmount: 50,
      simulatedSlipRefId: `JUDGE-SLIP-3-${Date.now()}`,
    });
    assert(
      thirdReview.success,
      "E2E-8a: 3rd review for this venue succeeds (3/3)",
      `Review ID: ${thirdReview.reviewId}`
    );

    // Submit 4th review for the SAME venue (MUST fail with 429)
    let fourthReviewRejected = false;
    try {
      await submitVerifiedReview({
        placeId,
        reviewerAddress: judgeWallet,
        rating: 5,
        reviewText: "พยายามส่งรีวิวรอบที่ 4 เกินโควตาร้านต่อวัน",
        simulatedSlipAmount: 50,
        simulatedSlipRefId: `JUDGE-SLIP-4-${Date.now()}`,
      });
    } catch (err: any) {
      if (err.code === "DAILY_VENUE_LIMIT_EXCEEDED" && err.status === 429) {
        fourthReviewRejected = true;
      }
    }
    assert(
      fourthReviewRejected,
      "E2E-8b: 4th review for same venue strictly rejected with 429 DAILY_VENUE_LIMIT_EXCEEDED",
      `Enforced limit: Max 3 reviews per venue per day`
    );

    // -------------------------------------------------------------------------
    // Test Summary
    // -------------------------------------------------------------------------
    console.log("\n=================================================");
    console.log(`PHASE 6 E2E DEMO SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("=================================================");

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error("Phase 6 E2E test fatal error:", err);
    process.exit(1);
  }
}

runPhase6E2ETests();
