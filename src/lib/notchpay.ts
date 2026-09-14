import { createHmac, timingSafeEqual } from "node:crypto";

// Confirms a webhook request actually came from NotchPay: an
// HMAC-SHA256 hex digest of the raw request body, computed with the
// webhook secret from the NotchPay Business dashboard (Settings ->
// Webhooks), compared against the signature NotchPay sends.
//
// Built from NotchPay's published docs (developer.notchpay.co) as of
// September 2026 — not yet tested against a live webhook delivery,
// since that needs the secret registered there first and a real
// payment to trigger one. If the first real delivery doesn't verify,
// the most likely culprits are the exact header name or digest
// encoding — both isolated to this one function and the route that
// calls it, same as the Didit webhook's own disclaimer in didit.ts.
export function verifyNotchPayWebhook(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const givenBuf = Buffer.from(signatureHeader, "utf8");
  if (expectedBuf.length !== givenBuf.length) return false;
  return timingSafeEqual(expectedBuf, givenBuf);
}

// NotchPay's webhook payload nests the payment reference under a
// couple of different possible shapes depending on the event and API
// version ("data.transaction.reference", "data.reference", or
// "reference" directly) — checked defensively in this order rather
// than assuming one, the same way the checkout route already tries
// multiple candidates when charging a mobile money number.
export function extractNotchPayReference(payload: unknown): string | undefined {
  const p = payload as Record<string, unknown>;
  const data = (p?.data ?? {}) as Record<string, unknown>;
  const transaction = (data?.transaction ?? {}) as Record<string, unknown>;
  return (
    (transaction.reference as string | undefined) ??
    (data.reference as string | undefined) ??
    (p?.reference as string | undefined)
  );
}

// The event name NotchPay sends under "type" (some payloads use
// "event" instead — checked as a fallback).
export function extractNotchPayEventType(payload: unknown): string | undefined {
  const p = payload as Record<string, unknown>;
  return (p?.type as string | undefined) ?? (p?.event as string | undefined);
}
