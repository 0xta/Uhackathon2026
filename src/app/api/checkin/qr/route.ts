import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isWithinGeofence } from "@/lib/services/geofence";
import { awardUserEpochPoints } from "@/lib/services/epoch";
import { dispatchRandomShopVoice } from "@/lib/services/elevenlabs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { placeId, customerAddress, latitude, longitude } = body;

    if (!placeId || typeof placeId !== "string") {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "placeId is required" },
        { status: 400 }
      );
    }

    if (!customerAddress || typeof customerAddress !== "string") {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "customerAddress is required" },
        { status: 400 }
      );
    }

    const normAddress = customerAddress.toLowerCase().trim();
    if (!normAddress.startsWith("0x") || normAddress.length !== 42) {
      return NextResponse.json(
        { error: "INVALID_ADDRESS", message: "customerAddress must be a valid EVM 0x address" },
        { status: 400 }
      );
    }

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: "INVALID_GPS", message: "GPS latitude and longitude are required" },
        { status: 400 }
      );
    }

    const userLat = Number(latitude);
    const userLng = Number(longitude);

    if (isNaN(userLat) || isNaN(userLng)) {
      return NextResponse.json(
        { error: "INVALID_GPS", message: "GPS latitude and longitude must be numbers" },
        { status: 400 }
      );
    }

    // 1. Fetch Venue
    const placeRes = await query<{
      id: string;
      place_id: string;
      name: string;
      address: string;
      latitude: string | number | null;
      longitude: string | number | null;
      business_status: string;
    }>(
      `SELECT id, place_id, name, address, latitude, longitude, business_status 
       FROM places 
       WHERE place_id = $1`,
      [placeId]
    );

    if (placeRes.rows.length === 0) {
      return NextResponse.json(
        { error: "VENUE_NOT_FOUND", message: `Venue ${placeId} not found` },
        { status: 404 }
      );
    }

    const place = placeRes.rows[0];
    const venueLat = place.latitude !== null ? Number(place.latitude) : null;
    const venueLng = place.longitude !== null ? Number(place.longitude) : null;

    if (venueLat === null || venueLng === null) {
      return NextResponse.json(
        { error: "VENUE_LOCATION_UNAVAILABLE", message: "Venue GPS coordinates are not on file" },
        { status: 400 }
      );
    }

    // 2. Validate Geofence (<= 100 meters)
    const { withinRange, distanceMeters } = isWithinGeofence(
      userLat,
      userLng,
      venueLat,
      venueLng,
      100
    );

    if (!withinRange) {
      return NextResponse.json(
        {
          error: "GEOFENCE_VIOLATION",
          message: `Check-in rejected: You are ${Math.round(distanceMeters)}m away. You must be within 100m of ${place.name}.`,
          distanceMeters,
          maxAllowedMeters: 100,
        },
        { status: 403 }
      );
    }

    // 3. Check Daily Limits (Max 3 / place / day, Max 10 / day overall)
    const [venueCheckinCountRes, totalCheckinCountRes] = await Promise.all([
      query<{ count: number }>(
        `SELECT COUNT(*)::int as count 
         FROM in_store_qr_checkins 
         WHERE LOWER(customer_address) = $1 
           AND place_id = $2 
           AND created_at >= CURRENT_DATE`,
        [normAddress, placeId]
      ),
      query<{ count: number }>(
        `SELECT COUNT(*)::int as count 
         FROM in_store_qr_checkins 
         WHERE LOWER(customer_address) = $1 
           AND created_at >= CURRENT_DATE`,
        [normAddress]
      ),
    ]);

    const venueCheckinsToday = venueCheckinCountRes.rows[0]?.count || 0;
    const totalCheckinsToday = totalCheckinCountRes.rows[0]?.count || 0;

    if (venueCheckinsToday >= 3) {
      return NextResponse.json(
        {
          error: "DAILY_VENUE_LIMIT_EXCEEDED",
          message: `Daily limit reached: Maximum 3 check-ins per venue per day allowed (${venueCheckinsToday}/3 used).`,
          venueCheckinsToday,
          maxPerVenue: 3,
        },
        { status: 429 }
      );
    }

    if (totalCheckinsToday >= 10) {
      return NextResponse.json(
        {
          error: "DAILY_TOTAL_LIMIT_EXCEEDED",
          message: `Daily total limit reached: Maximum 10 check-ins per day allowed across all venues (${totalCheckinsToday}/10 used).`,
          totalCheckinsToday,
          maxDailyTotal: 10,
        },
        { status: 429 }
      );
    }

    // 4. Check Pioneer Status for this venue
    const pioneerRes = await query<{ slot_index: number }>(
      `SELECT slot_index FROM pioneer_claims 
       WHERE place_id = $1 AND LOWER(pioneer_address) = $2`,
      [placeId, normAddress]
    );
    const isPioneer = pioneerRes.rows.length > 0;
    const pioneerSlot = isPioneer ? pioneerRes.rows[0].slot_index : null;

    // 5. Award 3 Daily Activity Points
    const POINTS_AWARDED = 3;
    const epochReward = await awardUserEpochPoints(normAddress, POINTS_AWARDED);

    // 6. Dispatch Random 1-in-3 Shop Greeting Voice
    const voice = await dispatchRandomShopVoice(placeId);

    // 7. Insert In-Store QR Check-in Record
    const placeHash = `0x${Buffer.from(placeId).toString("hex").slice(0, 64).padEnd(64, "0")}`;
    const insertRes = await query<{ id: string; created_at: string }>(
      `INSERT INTO in_store_qr_checkins 
        (place_id, place_hash, customer_address, gps_latitude, gps_longitude, gps_distance_meters, dispatched_voice_id, epoch_points_awarded)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, created_at`,
      [
        placeId,
        placeHash,
        normAddress,
        userLat,
        userLng,
        distanceMeters,
        voice.id,
        POINTS_AWARDED,
      ]
    );

    return NextResponse.json({
      success: true,
      checkinId: insertRes.rows[0].id,
      place: {
        place_id: place.place_id,
        name: place.name,
        address: place.address,
      },
      pointsAwarded: POINTS_AWARDED,
      userTotalPointsToday: epochReward.userPoints,
      estimatedTasteReward: epochReward.estimatedTasteReward,
      distanceMeters,
      isPioneer,
      pioneerSlot,
      voiceGreeting: {
        id: voice.id,
        slotNumber: voice.slot_number,
        title: voice.title,
        scriptText: voice.script_text,
        audioUrl: voice.audio_url,
        durationSeconds: voice.duration_seconds,
        playCount: voice.play_count,
      },
      checkinsRemainingForVenue: Math.max(0, 2 - venueCheckinsToday),
      checkinsRemainingTotal: Math.max(0, 9 - totalCheckinsToday),
    });
  } catch (error: any) {
    console.error("QR check-in error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
