import { query } from "../db";
import fs from "fs";
import path from "path";

export interface ShopVoiceRecord {
  id: string;
  place_id: string;
  slot_number: number;
  title: string;
  script_text: string;
  voice_id: string;
  audio_url: string;
  duration_seconds: number;
  is_active: boolean;
  play_count: number;
  created_at: string;
}

const ELEVENLABS_VOICES = {
  slot1: {
    id: "21m00Tcm4TlvDq8ikWAM", // Rachel - Warm & Welcoming
    title: "ยินดีต้อนรับสู่ร้าน",
  },
  slot2: {
    id: "EXAVITQu4vr4xnSDxMaL", // Bella - Energetic & Chef Special
    title: "เมนูแนะนำประจำร้าน",
  },
  slot3: {
    id: "AZnzlk1XvdvUeBnXmlld", // Domi - Elegant VIP Patron Gratitude
    title: "ขอบคุณผู้มีอุปการคุณ",
  },
};

/**
 * Synthesizes a pleasant multi-tone PCM WAV chime (C5-E5-G5-C6)
 * as a robust local audio fallback.
 */
export function generateChimeWavBuffer(durationSeconds: number = 3.2): Buffer {
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const dataSize = numSamples * 2; // 16-bit mono = 2 bytes per sample
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // fmt subchunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // subchunk1 size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // audio format (1 = PCM)
  buffer.writeUInt16LE(1, 22); // num channels (1 = mono)
  buffer.writeUInt32LE(sampleRate, 24); // sample rate
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate (sampleRate * numChannels * bitsPerSample / 8)
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample

  // data subchunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Notes: C5 (523.25 Hz), E5 (659.25 Hz), G5 (783.99 Hz), C6 (1046.50 Hz)
  const notes = [523.25, 659.25, 783.99, 1046.5];
  const noteDuration = durationSeconds / notes.length;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const noteIdx = Math.min(Math.floor(t / noteDuration), notes.length - 1);
    const freq = notes[noteIdx];
    const noteTime = t - noteIdx * noteDuration;
    // Exponential decay envelope
    const envelope = Math.exp(-3.5 * (noteTime / noteDuration));
    // Sine wave
    const sampleVal = Math.sin(2 * Math.PI * freq * noteTime) * envelope * 0.7;
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sampleVal * 32767)));
    buffer.writeInt16LE(intSample, 44 + i * 2);
  }

  return buffer;
}

/**
 * Synthesizes speech using ElevenLabs API if key is present,
 * otherwise falls back to generating a pleasant local WAV audio file.
 */
export async function synthesizeShopGreetingAudio(params: {
  placeId: string;
  slotNumber: number;
  voiceId: string;
  scriptText: string;
}): Promise<{ audioUrl: string; durationSeconds: number }> {
  const { placeId, slotNumber, voiceId, scriptText } = params;
  const apiKey = process.env.ELEVENLABS_API_KEY;

  const audioDir = path.join(process.cwd(), "public", "audio", "voices");
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }

  // Safe filename
  const cleanPlaceId = placeId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `${cleanPlaceId}_slot${slotNumber}.mp3`;
  const filePath = path.join(audioDir, fileName);
  const publicUrl = `/audio/voices/${fileName}`;

  if (apiKey && apiKey.trim() && apiKey !== "mock_key") {
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": apiKey.trim(),
          },
          body: JSON.stringify({
            text: scriptText,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
            },
          }),
        }
      );

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        fs.writeFileSync(filePath, buffer);
        return {
          audioUrl: publicUrl,
          durationSeconds: 4.2,
        };
      } else {
        console.warn(`ElevenLabs API returned ${response.status}. Using high-quality synthetic fallback audio.`);
      }
    } catch (err) {
      console.warn("ElevenLabs synthesis error, switching to synthetic fallback audio:", err);
    }
  }

  // Fallback: Generate pleasant local WAV audio
  const fallbackFileName = `${cleanPlaceId}_slot${slotNumber}.wav`;
  const fallbackPath = path.join(audioDir, fallbackFileName);
  const fallbackUrl = `/audio/voices/${fallbackFileName}`;
  const duration = 3.2;

  const wavBuffer = generateChimeWavBuffer(duration);
  fs.writeFileSync(fallbackPath, wavBuffer);

  return {
    audioUrl: fallbackUrl,
    durationSeconds: duration,
  };
}

/**
 * Pre-seeds or verifies that a place has all 3 required shop voices in shop_voices.
 */
export async function ensurePlaceVoices(
  placeId: string,
  placeName?: string
): Promise<ShopVoiceRecord[]> {
  // Check existing voices
  const existingRes = await query<ShopVoiceRecord>(
    `SELECT * FROM shop_voices WHERE place_id = $1 ORDER BY slot_number ASC`,
    [placeId]
  );

  if (existingRes.rows.length >= 3) {
    return existingRes.rows;
  }

  // Get place name if not supplied
  let shopName = placeName;
  if (!shopName) {
    const placeRes = await query<{ name: string }>(
      `SELECT name FROM places WHERE place_id = $1`,
      [placeId]
    );
    shopName = placeRes.rows[0]?.name || "ร้านอาหาร TasteChain";
  }

  const existingSlots = new Set(existingRes.rows.map((r) => r.slot_number));

  const defaultTemplates = [
    {
      slot: 1,
      voice: ELEVENLABS_VOICES.slot1,
      script: `ยินดีต้อนรับสู่ร้าน ${shopName} ครับ ขอขอบคุณที่แวะมาลิ้มรสความอร่อยและสัมผัสบรรยากาศดีๆ กับเราในวันนี้ เชิญรับประทานให้อร่อยนะครับ!`,
    },
    {
      slot: 2,
      voice: ELEVENLABS_VOICES.slot2,
      script: `ขอแนะนำเมนูพิเศษสูตรลับประจำร้าน ${shopName} คัดสรรวัตถุดิบชั้นเลิศ สดใหม่ทุกวัน ลิ้มลองรสชาติแท้ๆ ที่ปรุงด้วยใจได้เลยครับ!`,
    },
    {
      slot: 3,
      voice: ELEVENLABS_VOICES.slot3,
      script: `ขอขอบคุณที่ร่วมสนับสนุนร้าน ${shopName} และเครือข่าย TasteChain BKK วันนี้ท่านได้รับแต้มความพยายามพิเศษสะสม $TASTE แล้วครับ!`,
    },
  ];

  for (const t of defaultTemplates) {
    if (!existingSlots.has(t.slot)) {
      const audioResult = await synthesizeShopGreetingAudio({
        placeId,
        slotNumber: t.slot,
        voiceId: t.voice.id,
        scriptText: t.script,
      });

      await query(
        `INSERT INTO shop_voices (place_id, slot_number, title, script_text, voice_id, audio_url, duration_seconds, is_active, play_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, 0)
         ON CONFLICT (place_id, slot_number)
         DO UPDATE SET title = $3, script_text = $4, audio_url = $6, duration_seconds = $7`,
        [
          placeId,
          t.slot,
          t.voice.title,
          t.script,
          t.voice.id,
          audioResult.audioUrl,
          audioResult.durationSeconds,
        ]
      );
    }
  }

  const allVoicesRes = await query<ShopVoiceRecord>(
    `SELECT * FROM shop_voices WHERE place_id = $1 AND is_active = true ORDER BY slot_number ASC`,
    [placeId]
  );
  return allVoicesRes.rows;
}

/**
 * Randomly dispatches 1 out of the 3 active shop voices for a venue upon QR scan or review.
 * Increments play_count for the selected voice.
 */
export async function dispatchRandomShopVoice(placeId: string): Promise<ShopVoiceRecord> {
  const voices = await ensurePlaceVoices(placeId);
  if (voices.length === 0) {
    throw new Error(`No voices available for place: ${placeId}`);
  }

  // 1-in-3 random selection
  const randomIndex = Math.floor(Math.random() * voices.length);
  const selectedVoice = voices[randomIndex];

  // Increment play count
  await query(
    `UPDATE shop_voices SET play_count = play_count + 1 WHERE id = $1`,
    [selectedVoice.id]
  );

  return {
    ...selectedVoice,
    play_count: selectedVoice.play_count + 1,
  };
}
