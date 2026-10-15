import sharp from "sharp";
import { query } from "../db";

/**
 * Computes a 64-bit Difference Hash (dHash) for an image buffer.
 * Standard algorithm:
 * 1. Convert to grayscale.
 * 2. Resize to 9x8 pixels (72 pixels total).
 * 3. Compare adjacent pixels per row: if pixel[x] > pixel[x+1] => 1, else 0.
 * 4. Yields 8 rows * 8 comparisons = 64 bits = 16-character hex string.
 */
export async function computeImageDHash(imageBuffer: Buffer): Promise<string> {
  const rawPixels = await sharp(imageBuffer)
    .grayscale()
    .resize(9, 8, { fit: "fill" })
    .raw()
    .toBuffer();

  let hexString = "";
  for (let row = 0; row < 8; row++) {
    let rowByte = 0;
    for (let col = 0; col < 8; col++) {
      const leftPixel = rawPixels[row * 9 + col];
      const rightPixel = rawPixels[row * 9 + col + 1];
      if (leftPixel > rightPixel) {
        rowByte |= 1 << (7 - col);
      }
    }
    hexString += rowByte.toString(16).padStart(2, "0");
  }

  return hexString;
}

/**
 * Computes Hamming distance between two 64-bit hex hash strings.
 * Distance <= 5 typically denotes identical / duplicate photo with minor compression.
 */
export function computeHammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) return 64;

  let distance = 0;
  for (let i = 0; i < hash1.length; i += 2) {
    const byte1 = parseInt(hash1.slice(i, i + 2), 16);
    const byte2 = parseInt(hash2.slice(i, i + 2), 16);
    let xor = byte1 ^ byte2;
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }

  return distance;
}

/**
 * Validates if the given image hash has already been used in previous verified reviews.
 * Returns { isDuplicate: boolean, matchedReviewId?: string, minDistance: number }
 */
export async function checkPhotoFreshness(
  photoHash: string,
  thresholdDistance: number = 5
): Promise<{ isDuplicate: boolean; matchedReviewId?: string; minDistance: number }> {
  const existingReviewsRes = await query<{ id: string; food_photo_phash: string }>(
    `SELECT id, food_photo_phash FROM verified_reviews WHERE food_photo_phash IS NOT NULL`
  );

  let minDistance = 64;
  let matchedId: string | undefined = undefined;

  for (const row of existingReviewsRes.rows) {
    const dist = computeHammingDistance(photoHash, row.food_photo_phash);
    if (dist < minDistance) {
      minDistance = dist;
      matchedId = row.id;
    }
    if (dist <= thresholdDistance) {
      return {
        isDuplicate: true,
        matchedReviewId: row.id,
        minDistance: dist,
      };
    }
  }

  return {
    isDuplicate: false,
    matchedReviewId: matchedId,
    minDistance,
  };
}
