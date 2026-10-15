/**
 * Geofencing & Distance Calculation Services for TasteChain BKK
 * Validates in-store user proximity to operational Bangkok venues.
 */

const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculates Haversine distance in meters between two coordinates.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c * 10) / 10;
}

/**
 * Checks whether user coordinates are within maximum allowed threshold from venue.
 * Default threshold is 100 meters per TasteChain protocol.
 */
export function isWithinGeofence(
  userLat: number,
  userLng: number,
  venueLat: number,
  venueLng: number,
  maxMeters: number = 100
): { withinRange: boolean; distanceMeters: number } {
  const distanceMeters = calculateDistanceMeters(userLat, userLng, venueLat, venueLng);
  return {
    withinRange: distanceMeters <= maxMeters,
    distanceMeters,
  };
}
