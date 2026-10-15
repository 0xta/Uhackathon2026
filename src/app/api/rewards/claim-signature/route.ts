import { NextRequest, NextResponse } from "next/server";
import { generateClaimSignature } from "@/lib/services/claimSignature";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userAddress = searchParams.get("userAddress");
    const epochDate = searchParams.get("epochDate") || undefined;

    if (!userAddress || !userAddress.startsWith("0x")) {
      return NextResponse.json(
        { error: "INVALID_ADDRESS", message: "Valid 0x userAddress is required" },
        { status: 400 }
      );
    }

    const claimData = await generateClaimSignature(userAddress, epochDate);
    return NextResponse.json({
      success: true,
      ...claimData,
    });
  } catch (err: any) {
    console.error("Claim signature error:", err);
    return NextResponse.json(
      { error: "CLAIM_ERROR", message: err.message || "Failed to generate claim signature" },
      { status: 400 }
    );
  }
}
