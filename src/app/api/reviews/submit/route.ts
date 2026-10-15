import { NextRequest, NextResponse } from "next/server";
import { submitVerifiedReview } from "@/lib/services/reviews";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      placeId,
      reviewerAddress,
      rating,
      reviewText,
      foodPhotoImageBase64,
      slipImageBase64,
      simulatedSlipAmount,
      simulatedSlipRefId,
      gpsLatitude,
      gpsLongitude,
    } = body;

    if (!placeId || typeof placeId !== "string") {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "placeId is required" },
        { status: 400 }
      );
    }

    if (!reviewerAddress || typeof reviewerAddress !== "string") {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "reviewerAddress is required" },
        { status: 400 }
      );
    }

    const normAddress = reviewerAddress.toLowerCase().trim();
    if (!normAddress.startsWith("0x") || normAddress.length !== 42) {
      return NextResponse.json(
        { error: "INVALID_ADDRESS", message: "reviewerAddress must be a valid EVM address" },
        { status: 400 }
      );
    }

    const numRating = Number(rating);
    if (!numRating || numRating < 1 || numRating > 5) {
      return NextResponse.json(
        { error: "INVALID_RATING", message: "rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    if (!reviewText || typeof reviewText !== "string" || reviewText.trim().length < 5) {
      return NextResponse.json(
        { error: "INVALID_TEXT", message: "reviewText must be at least 5 characters" },
        { status: 400 }
      );
    }

    const result = await submitVerifiedReview({
      placeId,
      reviewerAddress: normAddress,
      rating: numRating,
      reviewText: reviewText.trim(),
      foodPhotoImageBase64,
      slipImageBase64,
      simulatedSlipAmount: simulatedSlipAmount !== undefined ? Number(simulatedSlipAmount) : undefined,
      simulatedSlipRefId,
      gpsLatitude: gpsLatitude !== undefined ? Number(gpsLatitude) : undefined,
      gpsLongitude: gpsLongitude !== undefined ? Number(gpsLongitude) : undefined,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Submit review API error:", err);
    const status = err.status || 500;
    return NextResponse.json(
      {
        error: err.code || "INTERNAL_ERROR",
        message: err.message || "Failed to submit review",
      },
      { status }
    );
  }
}
