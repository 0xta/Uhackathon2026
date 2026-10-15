import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  ensurePlaceVoices,
  synthesizeShopGreetingAudio,
} from "@/lib/services/elevenlabs";

/**
 * GET /api/merchant/voice?placeId=...
 * Lists all active voices (slots 1, 2, 3) for a place. Automatically seeds defaults if not present.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const placeId = searchParams.get("placeId");

    if (!placeId) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "placeId query parameter is required" },
        { status: 400 }
      );
    }

    const voices = await ensurePlaceVoices(placeId);
    return NextResponse.json({
      success: true,
      placeId,
      voices,
    });
  } catch (error: any) {
    console.error("Fetch shop voices error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/merchant/voice
 * Customizes or regenerates a specific voice slot (1, 2, or 3) for a merchant venue.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { placeId, slotNumber, title, scriptText, voiceId } = body;

    if (!placeId || !slotNumber || !title || !scriptText) {
      return NextResponse.json(
        {
          error: "INVALID_REQUEST",
          message: "placeId, slotNumber (1..3), title, and scriptText are required",
        },
        { status: 400 }
      );
    }

    const slot = Number(slotNumber);
    if (![1, 2, 3].includes(slot)) {
      return NextResponse.json(
        { error: "INVALID_SLOT", message: "slotNumber must be 1, 2, or 3" },
        { status: 400 }
      );
    }

    const effectiveVoiceId = voiceId || "21m00Tcm4TlvDq8ikWAM";

    // Synthesize audio
    const audioResult = await synthesizeShopGreetingAudio({
      placeId,
      slotNumber: slot,
      voiceId: effectiveVoiceId,
      scriptText,
    });

    // Upsert into shop_voices
    const upsertRes = await query(
      `INSERT INTO shop_voices 
        (place_id, slot_number, title, script_text, voice_id, audio_url, duration_seconds, is_active, play_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, 0)
       ON CONFLICT (place_id, slot_number)
       DO UPDATE SET 
         title = $3, 
         script_text = $4, 
         voice_id = $5, 
         audio_url = $6, 
         duration_seconds = $7,
         is_active = true
       RETURNING *`,
      [
        placeId,
        slot,
        title,
        scriptText,
        effectiveVoiceId,
        audioResult.audioUrl,
        audioResult.durationSeconds,
      ]
    );

    return NextResponse.json({
      success: true,
      voice: upsertRes.rows[0],
    });
  } catch (error: any) {
    console.error("Merchant voice update error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
