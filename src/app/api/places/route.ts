import { NextRequest, NextResponse } from "next/server";
import { getBangkokPlaces } from "@/lib/services/places";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const q = searchParams.get("q") || undefined;
    const service_type = searchParams.get("service_type") || undefined;
    const min_rating_param = searchParams.get("min_rating");
    const min_rating = min_rating_param ? parseFloat(min_rating_param) : undefined;
    const has_bounty = searchParams.get("has_bounty") === "true";
    const pioneer_open = searchParams.get("pioneer_open") === "true";

    const limit_param = searchParams.get("limit");
    const limit = limit_param ? parseInt(limit_param, 10) : 20;

    const offset_param = searchParams.get("offset");
    const offset = offset_param ? parseInt(offset_param, 10) : 0;

    const minLat = searchParams.get("minLat") ? parseFloat(searchParams.get("minLat")!) : undefined;
    const maxLat = searchParams.get("maxLat") ? parseFloat(searchParams.get("maxLat")!) : undefined;
    const minLng = searchParams.get("minLng") ? parseFloat(searchParams.get("minLng")!) : undefined;
    const maxLng = searchParams.get("maxLng") ? parseFloat(searchParams.get("maxLng")!) : undefined;

    const result = await getBangkokPlaces({
      q,
      service_type,
      min_rating,
      has_bounty,
      pioneer_open,
      limit,
      offset,
      minLat,
      maxLat,
      minLng,
      maxLng,
    });

    return NextResponse.json({
      success: true,
      data: result.places,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: result.offset + result.places.length < result.total,
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/places:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch places",
        message: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}
