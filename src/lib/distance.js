// Haversine great-circle distance in metres, used for the *preview* shown on
// the student QR screen ("about 7.8 m from the venue").
//
// This is deliberately display only. The authoritative distance test runs
// inside the verify-attendance Edge Function against coordinates reported by
// the student's device, because a client-side check can always be bypassed
// (spec sections 19 and 29).

const EARTH_RADIUS_METERS = 6371000;

export function haversineMeters(lat1, lon1, lat2, lon2) {
  const values = [lat1, lon1, lat2, lon2].map(Number);
  if (values.some((value) => !Number.isFinite(value))) return null;

  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const [startLat, startLon, endLat, endLon] = values;

  const deltaLat = toRadians(endLat - startLat);
  const deltaLon = toRadians(endLon - startLon);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(startLat)) *
      Math.cos(toRadians(endLat)) *
      Math.sin(deltaLon / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
}

export function roundMeters(meters) {
  if (!Number.isFinite(meters)) return null;
  return Math.round(meters * 10) / 10;
}

// Short, human readable distance for badges and result screens.
export function formatDistance(meters) {
  if (!Number.isFinite(meters)) return "—";
  if (meters < 1000) return `${roundMeters(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}
