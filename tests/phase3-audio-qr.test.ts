import { query } from "../src/lib/db";
import {
  ensurePlaceVoices,
  dispatchRandomShopVoice,
  synthesizeShopGreetingAudio,
} from "../src/lib/services/elevenlabs";
import { isWithinGeofence, calculateDistanceMeters } from "../src/lib/services/geofence";
import { awardUserEpochPoints, getUserEpochStatus, DAILY_TASTE_EMISSION } from "../src/lib/services/epoch";
import fs from "fs";
import path from "path";

async function runPhase3Tests() {
  console.log("=================================================");
  console.log("   TASTECHAIN BKK — PHASE 3 VERIFICATION TESTS   ");
  console.log("   ElevenLabs AI Voice Studio & Front-Shop QR    ");
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
    // Pick an operational Bangkok test place
    const placeRes = await query<{
      id: string;
      place_id: string;
      name: string;
      latitude: number;
      longitude: number;
    }>(
      `SELECT id, place_id, name, latitude::float, longitude::float 
       FROM places 
       WHERE city = 'กรุงเทพมหานคร' AND business_status = 'OPERATIONAL' AND latitude IS NOT NULL
       LIMIT 1`
    );

    const testPlace = placeRes.rows[0];
    const testPlaceId = testPlace.place_id;
    console.log(`Using Test Venue: "${testPlace.name}" (${testPlaceId})`);
    console.log(`Venue Coordinates: ${testPlace.latitude}, ${testPlace.longitude}\n`);

    // -------------------------------------------------------------------------
    // Test 1: ElevenLabs Voice Studio & Seeding
    // -------------------------------------------------------------------------
    console.log("--- 1. Testing ElevenLabs AI Shop Voice Studio ---");
    const voices = await ensurePlaceVoices(testPlaceId, testPlace.name);
    assert(
      voices.length === 3,
      "T3.1a: Exactly 3 greeting voice slots generated per venue",
      `Generated ${voices.length} slots for "${testPlace.name}"`
    );

    const slots = voices.map((v) => v.slot_number).sort();
    assert(
      slots[0] === 1 && slots[1] === 2 && slots[2] === 3,
      "T3.1b: Voice slots correspond to [1: Welcome Host, 2: Chef's Special, 3: VIP Patron]",
      `Slots present: ${slots.join(", ")}`
    );

    // Verify audio files exist on disk
    let allAudioFilesExist = true;
    for (const v of voices) {
      const relPath = v.audio_url.replace(/^\//, "");
      const fullPath = path.join(process.cwd(), "public", relPath.replace(/^audio\//, "audio/"));
      if (!fs.existsSync(fullPath) || fs.statSync(fullPath).size === 0) {
        allAudioFilesExist = false;
      }
    }
    assert(
      allAudioFilesExist,
      "T3.1c: All 3 audio voice files synthesized & saved to public/audio/voices/",
      `Sample audio file: ${voices[0].audio_url}`
    );

    // -------------------------------------------------------------------------
    // Test 2: Random 1-in-3 Dispatch
    // -------------------------------------------------------------------------
    console.log("\n--- 2. Testing Random 1-in-3 Shop Voice Dispatch ---");
    const dispatchResults = new Set<number>();
    let playCountBefore = (await query<{ play_count: number }>(
      `SELECT play_count FROM shop_voices WHERE id = $1`,
      [voices[0].id]
    )).rows[0]?.play_count || 0;

    for (let i = 0; i < 15; i++) {
      const dispatched = await dispatchRandomShopVoice(testPlaceId);
      dispatchResults.add(dispatched.slot_number);
      assert(
        !!dispatched.audio_url && !!dispatched.script_text,
        `T3.2-iteration-${i + 1}: Dispatched Slot #${dispatched.slot_number}`,
        `Title: "${dispatched.title}" | Audio: ${dispatched.audio_url}`
      );
    }

    assert(
      dispatchResults.size >= 2,
      "T3.2b: Random dispatch distributes among multiple voice slots",
      `Observed dispatched slots in sample: ${Array.from(dispatchResults).join(", ")}`
    );

    // -------------------------------------------------------------------------
    // Test 3: Geofence Validation (100m Threshold)
    // -------------------------------------------------------------------------
    console.log("\n--- 3. Testing Front-Shop Geofence Oracle (Haversine & Proximity) ---");
    const venueLat = Number(testPlace.latitude);
    const venueLng = Number(testPlace.longitude);

    // Scenario A: Exact location (0m)
    const geoA = isWithinGeofence(venueLat, venueLng, venueLat, venueLng, 100);
    assert(
      geoA.withinRange && geoA.distanceMeters <= 5,
      "T3.3a: Exact shop location matches geofence (0m <= 100m)",
      `Distance: ${geoA.distanceMeters}m`
    );

    // Scenario B: Nearby location (~40m offset)
    // 0.00035 degrees latitude is approx 38.9 meters
    const nearLat = venueLat + 0.00035;
    const geoB = isWithinGeofence(nearLat, venueLng, venueLat, venueLng, 100);
    assert(
      geoB.withinRange && geoB.distanceMeters <= 100,
      "T3.3b: In-store position within 100m accepted",
      `Distance: ${geoB.distanceMeters}m (Threshold: 100m)`
    );

    // Scenario C: Far location (> 200m offset)
    // 0.003 degrees latitude is approx 333 meters
    const farLat = venueLat + 0.003;
    const geoC = isWithinGeofence(farLat, venueLng, venueLat, venueLng, 100);
    assert(
      !geoC.withinRange && geoC.distanceMeters > 100,
      "T3.3c: Location > 100m strictly rejected by geofence oracle",
      `Distance: ${geoC.distanceMeters}m > 100m limit`
    );

    // -------------------------------------------------------------------------
    // Test 4: Points Awarding & 10,000 $TASTE Daily Epoch Pro-Rata Math
    // -------------------------------------------------------------------------
    console.log("\n--- 4. Testing Activity Points & Daily 10,000 $TASTE Pool ---");
    const testWallet = "0x888877776666555544443333222211110000aaaa";
    const testEpoch = "2026-10-15";

    // Award 3 points (QR Scan reward)
    const reward1 = await awardUserEpochPoints(testWallet, 3, testEpoch);
    assert(
      reward1.userPoints >= 3,
      "T3.4a: Front-Shop QR check-in awards 3 activity points",
      `User points: ${reward1.userPoints} pts in epoch ${reward1.epochDate}`
    );

    assert(
      reward1.totalPlatformPoints >= reward1.userPoints,
      "T3.4b: Total platform points aggregated in daily_token_epochs",
      `Platform total: ${reward1.totalPlatformPoints} pts | Daily pool: ${DAILY_TASTE_EMISSION} $TASTE`
    );

    const expectedShare = (reward1.userPoints / reward1.totalPlatformPoints) * DAILY_TASTE_EMISSION;
    assert(
      Math.abs(reward1.estimatedTasteReward - expectedShare) < 0.1,
      "T3.4c: User reward calculated via dynamic pro-rata formula: (user_pts / total_pts) * 10,000",
      `Estimated reward: ${reward1.estimatedTasteReward} $TASTE`
    );

    // -------------------------------------------------------------------------
    // Test 5: End-to-End HTTP API Check-in & Rate Limits
    // -------------------------------------------------------------------------
    console.log("\n--- 5. Testing In-Store Check-in HTTP API & Daily Quotas ---");
    const rateLimitTestWallet = "0x999988887777666655554444333322221111bbbb";

    // Clean any prior records for this wallet for deterministic rate limit testing
    await query(
      `DELETE FROM in_store_qr_checkins WHERE customer_address = $1`,
      [rateLimitTestWallet.toLowerCase()]
    );

    // Step 1: Call API with far distance (Expect 403)
    const farReq = await fetch("http://localhost:3001/api/checkin/qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        placeId: testPlaceId,
        customerAddress: rateLimitTestWallet,
        latitude: farLat,
        longitude: venueLng,
      }),
    });
    const farJson = await farReq.json();
    assert(
      farReq.status === 403 && farJson.error === "GEOFENCE_VIOLATION",
      "T3.5a: HTTP POST /api/checkin/qr returns 403 GEOFENCE_VIOLATION when > 100m",
      `Status: ${farReq.status} | Message: "${farJson.message}"`
    );

    // Step 2: 3 valid in-store check-ins (1, 2, 3)
    for (let c = 1; c <= 3; c++) {
      const validReq = await fetch("http://localhost:3001/api/checkin/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: testPlaceId,
          customerAddress: rateLimitTestWallet,
          latitude: venueLat,
          longitude: venueLng,
        }),
      });
      const validJson = await validReq.json();
      assert(
        validReq.status === 200 && validJson.success === true && validJson.pointsAwarded === 3,
        `T3.5b: Check-in #${c}/3 successfully accepted with +3 points & audio dispatch`,
        `Dispatched voice: Slot #${validJson.voiceGreeting?.slotNumber} ("${validJson.voiceGreeting?.title}")`
      );
    }

    // Step 3: 4th check-in at the same venue (Must be rejected with 429)
    const fourthReq = await fetch("http://localhost:3001/api/checkin/qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        placeId: testPlaceId,
        customerAddress: rateLimitTestWallet,
        latitude: venueLat,
        longitude: venueLng,
      }),
    });
    const fourthJson = await fourthReq.json();
    assert(
      fourthReq.status === 429 && fourthJson.error === "DAILY_VENUE_LIMIT_EXCEEDED",
      "T3.5c: 4th check-in rejected with 429 DAILY_VENUE_LIMIT_EXCEEDED (Max 3/shop/day enforced)",
      `Status: ${fourthReq.status} | Reason: "${fourthJson.message}"`
    );

    // -------------------------------------------------------------------------
    // Test Summary
    // -------------------------------------------------------------------------
    console.log("\n=================================================");
    console.log(`PHASE 3 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("=================================================");

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error("Phase 3 test execution error:", err);
    process.exit(1);
  }
}

runPhase3Tests();
