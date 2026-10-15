import { query } from "../src/lib/db";
import { awardUserEpochPoints, DAILY_TASTE_EMISSION } from "../src/lib/services/epoch";
import { generateClaimSignature, recordClaimSuccess, dateStringToUint } from "../src/lib/services/claimSignature";
import { redeemMerchantPromotion } from "../src/lib/services/promotions";
import { ethers } from "ethers";

async function runPhase5Tests() {
  console.log("=================================================");
  console.log("   TASTECHAIN BKK — PHASE 5 VERIFICATION TESTS   ");
  console.log("   Tokenomics, Mechanism B Oracle Signatures,    ");
  console.log("   & Circular Gastronomy 80/20 Escrow Redemptions");
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
    const testEpoch = "2026-10-15";
    const userAlice = "0xaaaa111122223333444455556666777788889999";
    const userBob = "0xbbbb111122223333444455556666777788889999";

    // Clean prior test epoch records for deterministic testing
    await query(`DELETE FROM user_epoch_shares WHERE epoch_date = $1`, [testEpoch]);
    await query(`DELETE FROM daily_token_epochs WHERE epoch_date = $1`, [testEpoch]);

    // -------------------------------------------------------------------------
    // Test 1: Daily 10,000 $TASTE Pro-Rata Math
    // -------------------------------------------------------------------------
    console.log("--- 1. Testing Daily 10,000 $TASTE Dynamic Pool Pro-Rata Math ---");

    // Alice earns 6 points (e.g. 2 QR scans)
    const aliceRes = await awardUserEpochPoints(userAlice, 6, testEpoch);
    assert(
      aliceRes.userPoints === 6 && aliceRes.totalPlatformPoints === 6,
      "T5.1a: Alice single-user epoch has 100% share (10,000 $TASTE)",
      `Alice points: ${aliceRes.userPoints} | Estimated reward: ${aliceRes.estimatedTasteReward} $TASTE`
    );

    // Bob earns 14 points (e.g. Pioneer review: 7 pts * 2 = 14 pts)
    const bobRes = await awardUserEpochPoints(userBob, 14, testEpoch);
    assert(
      bobRes.userPoints === 14 && bobRes.totalPlatformPoints === 20,
      "T5.1b: Platform aggregates total points (6 + 14 = 20 pts)",
      `Total points: ${bobRes.totalPlatformPoints} pts | Bob: ${bobRes.userPoints} pts`
    );

    // Alice should now have 6/20 = 30% = 3,000 $TASTE
    // Bob should have 14/20 = 70% = 7,000 $TASTE
    const aliceUpdated = await awardUserEpochPoints(userAlice, 0, testEpoch);
    assert(
      Math.abs(aliceUpdated.estimatedTasteReward - 3000) < 0.1,
      "T5.1c: Alice dynamically recalculated to 30% share (3,000 $TASTE)",
      `Alice reward: ${aliceUpdated.estimatedTasteReward} $TASTE`
    );
    assert(
      Math.abs(bobRes.estimatedTasteReward - 7000) < 0.1,
      "T5.1d: Bob dynamically calculated to 70% share (7,000 $TASTE)",
      `Bob reward: ${bobRes.estimatedTasteReward} $TASTE`
    );

    // Total emitted tokens must sum to exactly 10,000 $TASTE
    const sumRewards = aliceUpdated.estimatedTasteReward + bobRes.estimatedTasteReward;
    assert(
      Math.abs(sumRewards - DAILY_TASTE_EMISSION) < 0.1,
      "T5.1e: Total distributed pool rewards equal exactly 10,000 $TASTE",
      `Sum: ${sumRewards} $TASTE == ${DAILY_TASTE_EMISSION} $TASTE`
    );

    // -------------------------------------------------------------------------
    // Test 2: Mechanism B Oracle ECDSA Signature Verification
    // -------------------------------------------------------------------------
    console.log("\n--- 2. Testing Mechanism B Oracle ECDSA Signature ---");

    const claimData = await generateClaimSignature(userAlice, testEpoch);
    assert(
      claimData.signature.startsWith("0x") && claimData.signature.length === 132,
      "T5.2a: Generates valid 65-byte ECDSA signature string",
      `Signature: ${claimData.signature.slice(0, 30)}...`
    );

    // Verify cryptographic signature matches contract logic:
    // bytes32 messageHash = keccak256(abi.encodePacked(userAddress, epochDateUint, points));
    // verify recovered signer == oracleAddress
    const packedMessage = ethers.solidityPackedKeccak256(
      ["address", "uint256", "uint256"],
      [userAlice.toLowerCase(), claimData.epochDateUint, claimData.userPoints]
    );
    const recoveredSigner = ethers.verifyMessage(ethers.getBytes(packedMessage), claimData.signature);
    assert(
      recoveredSigner.toLowerCase() === claimData.oracleAddress.toLowerCase(),
      "T5.2b: Cryptographic signature correctly recovers to Oracle address",
      `Recovered: ${recoveredSigner} == Oracle: ${claimData.oracleAddress}`
    );

    // -------------------------------------------------------------------------
    // Test 3: Circular Gastronomy 80/20 Burn Redemptions
    // -------------------------------------------------------------------------
    console.log("\n--- 3. Testing 199 / 500 $TASTE Promotion Redemptions (80/20 Burn) ---");

    const placeRes = await query<{ place_id: string }>(
      `SELECT place_id FROM places WHERE business_status = 'OPERATIONAL' LIMIT 1`
    );
    const testPlaceId = placeRes.rows[0].place_id;

    // Redemption A: 199 $TASTE (Tier 1 Voucher)
    const redeem199 = await redeemMerchantPromotion({
      placeId: testPlaceId,
      customerAddress: userAlice,
      costInTaste: 199,
      promoTitle: "บัตรส่วนลด 10% (199 $TASTE)",
    });
    assert(
      redeem199.merchantReceivedTaste === 159.2 && redeem199.burnedTaste === 39.8,
      "T5.3a: 199 $TASTE voucher allocates 80% to merchant (159.2) & 20% burn (39.8)",
      `Merchant: ${redeem199.merchantReceivedTaste} | Burned: ${redeem199.burnedTaste}`
    );
    assert(
      redeem199.redemptionCode.startsWith("TASTE-199-"),
      "T5.3b: Generates encrypted cashier redemption voucher code",
      `Voucher Code: ${redeem199.redemptionCode}`
    );

    // Redemption B: 500 $TASTE (Tier 2 VIP Voucher)
    const redeem500 = await redeemMerchantPromotion({
      placeId: testPlaceId,
      customerAddress: userBob,
      costInTaste: 500,
      promoTitle: "บัตรส่วนลด 25% VIP (500 $TASTE)",
    });
    assert(
      redeem500.merchantReceivedTaste === 400 && redeem500.burnedTaste === 100,
      "T5.3c: 500 $TASTE voucher allocates 80% to merchant (400) & 20% burn (100)",
      `Merchant: ${redeem500.merchantReceivedTaste} | Burned: ${redeem500.burnedTaste}`
    );

    // -------------------------------------------------------------------------
    // Test 4: On-Chain Claim Tracking
    // -------------------------------------------------------------------------
    console.log("\n--- 4. Testing On-Chain Claim State Persistence ---");

    const simulatedTxHash = "0x" + "c1a11111".padEnd(64, "0");
    await recordClaimSuccess(userAlice, testEpoch, simulatedTxHash);

    const postClaim = await generateClaimSignature(userAlice, testEpoch);
    assert(
      postClaim.claimed === true,
      "T5.4: User epoch share successfully recorded as claimed upon tx confirmation",
      `Claimed status: ${postClaim.claimed}`
    );

    // -------------------------------------------------------------------------
    // Test Summary
    // -------------------------------------------------------------------------
    console.log("\n=================================================");
    console.log(`PHASE 5 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("=================================================");

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error("Phase 5 test fatal error:", err);
    process.exit(1);
  }
}

runPhase5Tests();
