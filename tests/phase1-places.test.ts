import { query } from "../src/lib/db";
import { getBangkokPlaces, getPlaceById, getBangkokStats, BANGKOK_FNB_TYPES } from "../src/lib/services/places";

async function runPhase1Tests() {
  console.log("=================================================");
  console.log("   TASTECHAIN BKK — PHASE 1 VERIFICATION TESTS   ");
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
    // -------------------------------------------------------------------------
    // Test 1: DB Connection
    // -------------------------------------------------------------------------
    console.log("--- 1. Testing Database Connection Pool ---");
    const t1Start = Date.now();
    const dbNow = await query("SELECT NOW() as current_time, version() as pg_version");
    const t1Duration = Date.now() - t1Start;
    assert(
      dbNow.rows.length > 0 && !!dbNow.rows[0].current_time,
      "T1.1: PostgreSQL connection to uhack-postgres",
      `Connected in ${t1Duration}ms | Server: ${dbNow.rows[0].pg_version.split(" ")[0]} ${dbNow.rows[0].pg_version.split(" ")[1]}`
    );

    // -------------------------------------------------------------------------
    // Test 2: Bangkok F&B Venue Count (Must be >= 36,000)
    // -------------------------------------------------------------------------
    console.log("\n--- 2. Verifying Bangkok Operational F&B Venues ---");
    const stats = await getBangkokStats();
    assert(
      stats.total_venues >= 36000,
      "T1.2: Total operational Bangkok F&B venues >= 36,000",
      `Actual operational F&B count: ${stats.total_venues.toLocaleString()} places`
    );

    // -------------------------------------------------------------------------
    // Test 3: Search Query Latency (< 300ms)
    // -------------------------------------------------------------------------
    console.log("\n--- 3. Testing Search Performance & Latency ---");
    const t3Start = Date.now();
    const searchResult = await getBangkokPlaces({ q: "ผัดไท", limit: 20 });
    const t3Duration = Date.now() - t3Start;
    assert(
      t3Duration < 300,
      "T1.3: Search query latency < 300ms",
      `Query 'ผัดไท' returned ${searchResult.places.length} of ${searchResult.total} matches in ${t3Duration}ms`
    );
    assert(
      searchResult.places.length > 0,
      "T1.3b: Search result contains valid venues",
      `Top match: "${searchResult.places[0].name}" at "${searchResult.places[0].address?.slice(0, 40)}..."`
    );

    // -------------------------------------------------------------------------
    // Test 4: Category Filter Accuracy (e.g. cafe)
    // -------------------------------------------------------------------------
    console.log("\n--- 4. Testing Category Filtering Accuracy ---");
    const cafeResult = await getBangkokPlaces({ service_type: "cafe", limit: 20 });
    const allCafes = cafeResult.places.every((p) => p.service_type === "cafe");
    assert(
      allCafes && cafeResult.places.length > 0,
      "T1.4: 100% of filtered venues match selected service_type ('cafe')",
      `Total cafes found: ${cafeResult.total.toLocaleString()} places | Sample: "${cafeResult.places[0].name}"`
    );

    // -------------------------------------------------------------------------
    // Test 5: Pioneer Slot Count & Place Detail Integrity
    // -------------------------------------------------------------------------
    console.log("\n--- 5. Testing Single Place Detail & Pioneer Integrity ---");
    const samplePlaceId = searchResult.places[0].place_id;
    const placeDetail = await getPlaceById(samplePlaceId);
    assert(
      placeDetail !== null && placeDetail.place_id === samplePlaceId,
      "T1.5: Detailed place profile retrieval",
      `Retrieved "${placeDetail?.name}" with pioneerCount=${placeDetail?.pioneer_count}/3`
    );
    assert(
      Array.isArray(placeDetail?.pioneers) &&
      Array.isArray(placeDetail?.recent_reviews) &&
      Array.isArray(placeDetail?.promotions) &&
      Array.isArray(placeDetail?.shop_voices),
      "T1.5b: Place detail contains all companion relation arrays",
      `Pioneers: ${placeDetail?.pioneers.length}, Reviews: ${placeDetail?.recent_reviews.length}, Promos: ${placeDetail?.promotions.length}, Voices: ${placeDetail?.shop_voices.length}`
    );

    // -------------------------------------------------------------------------
    // Test Summary
    // -------------------------------------------------------------------------
    console.log("\n=================================================");
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("=================================================");

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error("Test execution fatal error:", err);
    process.exit(1);
  }
}

runPhase1Tests();
