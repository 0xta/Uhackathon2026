import { NextRequest, NextResponse } from "next/server";
import { redeemMerchantPromotion } from "@/lib/services/promotions";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { placeId, customerAddress, costInTaste, promoTitle, onchainTxHash } = body;

    if (!placeId || !customerAddress || !costInTaste) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "placeId, customerAddress, and costInTaste are required" },
        { status: 400 }
      );
    }

    const numCost = Number(costInTaste);
    if (isNaN(numCost) || numCost <= 0) {
      return NextResponse.json(
        { error: "INVALID_COST", message: "costInTaste must be a positive number" },
        { status: 400 }
      );
    }

    const result = await redeemMerchantPromotion({
      placeId,
      customerAddress,
      costInTaste: numCost,
      promoTitle,
      onchainTxHash,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Promotion redemption error:", err);
    return NextResponse.json(
      { error: "REDEMPTION_ERROR", message: err.message || "Failed to redeem promotion" },
      { status: 400 }
    );
  }
}
