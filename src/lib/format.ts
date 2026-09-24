// The CFA franc (XAF) is pegged to the euro: 1 EUR = 655.957 XAF, fixed.
// So a euro amount shown next to an FCFA price is exact, not a guess —
// useful for buyers in the diaspora paying by card.
export const XAF_PER_EUR = 655.957;

export function formatEurFromFcfa(amountFcfa: number, locale: "en" | "fr" = "en") {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: amountFcfa / XAF_PER_EUR >= 100 ? 0 : 2,
  }).format(amountFcfa / XAF_PER_EUR);
}

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
