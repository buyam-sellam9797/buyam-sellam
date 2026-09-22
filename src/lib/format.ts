export function formatFcfa(amount: number) {
  return new Intl.NumberFormat("fr-CM", {
    style: "currency",
    currency: "XAF",
    maximumFractionDigits: 0,
  }).format(amount);
}

// Turns a raw average-response-time-in-minutes number into the short,
// human phrase used by the seller reliability badge (see
// getSellerResponseStats) — "under an hour", "3h", "2d" — rather than
// showing buyers a precise-looking "127 minutes", which reads as
// spuriously exact for what's an average over a handful of chats.
export function formatResponseTime(
  minutes: number,
  t: { responseTimeUnderHour: string; responseTimeHours: string; responseTimeDays: string }
): string {
  if (minutes < 60) return t.responseTimeUnderHour;
  if (minutes < 60 * 24) return t.responseTimeHours.replace("{n}", String(Math.round(minutes / 60)));
  return t.responseTimeDays.replace("{n}", String(Math.round(minutes / (60 * 24))));
}
