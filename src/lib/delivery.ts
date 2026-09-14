// Distance-based delivery pricing — the single source of truth so the
// same formula is never computed two different ways in two different
// places (checkout, the dashboard preview, the browse "near me" sort).
//
// How it works: once a seller pins their shop's location, and a buyer
// shares theirs (or picks a saved address that has one), the delivery
// fee is calculated automatically from the straight-line distance
// between them — the seller never sets a per-km rate themselves, so
// pricing stays predictable and consistent platform-wide. A shop's own
// flat delivery_fee_fcfa (set in shop settings) is kept as the
// fallback whenever the exact distance isn't known — the buyer never
// shared a location, or the seller hasn't pinned their shop yet — so
// nothing about today's flat-fee behavior changes for anyone who
// doesn't use location at all.
export const DELIVERY_FREE_RADIUS_KM = 2; // covered by the base fee, no extra charge
export const DELIVERY_FEE_PER_KM_FCFA = 150; // charged for each km beyond the free radius
export const DELIVERY_MAX_FEE_FCFA = 5000; // cap so a very long delivery never looks broken

// Great-circle distance between two coordinates, in kilometers.
export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

// baseFeeFcfa is the shop's own flat fee (shop settings) — used as the
// starting price for the free radius, then the per-km rate applies
// beyond that. Rounded to the nearest 50 FCFA so it never looks like a
// suspiciously precise number to a buyer.
export function calculateDistanceDeliveryFeeFcfa(distanceKm: number, baseFeeFcfa: number): number {
  const billableKm = Math.max(0, distanceKm - DELIVERY_FREE_RADIUS_KM);
  const rawFee = Math.max(0, baseFeeFcfa) + billableKm * DELIVERY_FEE_PER_KM_FCFA;
  const rounded = Math.round(rawFee / 50) * 50;
  return Math.min(DELIVERY_MAX_FEE_FCFA, rounded);
}
