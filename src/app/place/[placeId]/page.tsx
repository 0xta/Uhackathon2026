import { notFound } from "next/navigation";
import { getPlaceById } from "@/lib/services/places";
import { ensurePlaceVoices } from "@/lib/services/elevenlabs";
import PlaceDetailClient from "@/components/PlaceDetailClient";

interface PlacePageProps {
  params: {
    placeId: string;
  };
}

export const dynamic = "force-dynamic";

export default async function PlacePage({ params }: PlacePageProps) {
  const { placeId } = params;

  // Pre-seed voices if not yet generated
  await ensurePlaceVoices(placeId);

  const place = await getPlaceById(placeId);

  if (!place) {
    notFound();
  }

  return <PlaceDetailClient place={place} />;
}
