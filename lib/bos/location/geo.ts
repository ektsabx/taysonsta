// Location helpers (docs/bos/30 §28) — pure.

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export function validCoords(lat: unknown, lng: unknown) {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0);
}

// Bounding box for an OpenStreetMap embed around the points (with padding).
export function bbox(points: { lat: number; lng: number }[], padDeg = 0.01) {
  if (!points.length) return null;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return { minLat: Math.min(...lats) - padDeg, maxLat: Math.max(...lats) + padDeg, minLng: Math.min(...lngs) - padDeg, maxLng: Math.max(...lngs) + padDeg };
}

export function osmEmbedUrl(points: { lat: number; lng: number }[]) {
  const b = bbox(points);
  if (!b) return null;
  const marker = points.length === 1 ? `&marker=${points[0].lat},${points[0].lng}` : "";
  return `https://www.openstreetmap.org/export/embed.html?bbox=${b.minLng.toFixed(5)},${b.minLat.toFixed(5)},${b.maxLng.toFixed(5)},${b.maxLat.toFixed(5)}&layer=mapnik${marker}`;
}

export const googleMapsLink = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`;
