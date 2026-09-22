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

// --- Shared init+charge helper, added for layaway (see
// src/app/api/layaway/...) so its deposit and final-installment charges
// don't each need their own copy of the two-step NotchPay call. The
// original full-payment checkout (src/app/api/checkout/route.ts) keeps
// its own inline version exactly as it already works — deliberately
// left untouched here to avoid any risk to the live payment flow —
// so this is new code only, not a refactor of anything existing. ---
const NOTCHPAY_PUBLIC_KEY = process.env.NOTCHPAY_PUBLIC_KEY ?? "";
const NOTCHPAY_BASE_URL = "https://api.notchpay.co";

export type NotchPayChargeResult =
  | { ok: true; reference: string; debug: unknown }
  | { ok: false; error: string; status: number; debug?: unknown };

export async function initAndChargeNotchPay(input: {
  amountFcfa: number;
  phone: string;
  provider: "mtn" | "orange";
  description: string;
  reference: string;
}): Promise<NotchPayChargeResult> {
  if (!NOTCHPAY_PUBLIC_KEY) {
    return { ok: false, error: "Payments are not configured yet (missing NOTCHPAY_PUBLIC_KEY).", status: 500 };
  }

  try {
    const initRes = await fetch(`${NOTCHPAY_BASE_URL}/payments`, {
      method: "POST",
      headers: { Authorization: NOTCHPAY_PUBLIC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: input.amountFcfa,
        currency: "XAF",
        description: input.description,
        reference: input.reference,
        customer: { phone: input.phone },
      }),
    });
    const initData = await initRes.json();
    if (!initRes.ok) {
      return { ok: false, error: initData?.message ?? "Could not start the payment.", status: initRes.status, debug: initData };
    }

    const txReference: string | undefined = initData?.transaction?.reference;
    const txId: string | undefined = initData?.transaction?.id;
    const candidates = [txReference, txId, input.reference].filter((v): v is string => Boolean(v));

    const channel = input.provider === "mtn" ? "cm.mtn" : "cm.orange";
    let chargeData: unknown = null;
    let usedReference: string | undefined = candidates[0];
    let lastError: unknown = null;

    for (const candidate of candidates) {
      const chargeRes = await fetch(`${NOTCHPAY_BASE_URL}/payments/${candidate}`, {
        method: "POST",
        headers: { Authorization: NOTCHPAY_PUBLIC_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ channel, data: { phone: input.phone } }),
      });
      const data = await chargeRes.json();
      if (chargeRes.ok) {
        chargeData = data;
        usedReference = candidate;
        lastError = null;
        break;
      }
      lastError = data;
      if (chargeRes.status !== 404) break;
    }

    if (lastError || !usedReference) {
      const errData = (lastError ?? {}) as { message?: string };
      return {
        ok: false,
        error: errData?.message ?? "Could not charge that mobile money number.",
        status: 502,
        debug: { initData, lastError },
      };
    }

    return { ok: true, reference: usedReference, debug: chargeData };
  } catch {
    return { ok: false, error: "Could not reach the payment provider. Please try again.", status: 502 };
  }
}

// Polls NotchPay for a charge's current status — same lookup the
// existing checkout GET route does inline, factored out here so
// layaway's own GET routes don't repeat it a third time.
export async function checkNotchPayStatus(reference: string): Promise<
  { ok: true; status: string; raw: unknown } | { ok: false; error: string; status: number }
> {
  if (!NOTCHPAY_PUBLIC_KEY) {
    return { ok: false, error: "Payments are not configured yet.", status: 500 };
  }
  try {
    const res = await fetch(`${NOTCHPAY_BASE_URL}/payments/${reference}`, {
      headers: { Authorization: NOTCHPAY_PUBLIC_KEY },
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data?.message ?? "Could not check payment status.", status: res.status };
    }
    const status: string = data?.transaction?.status ?? data?.payment?.status ?? "pending";
    return { ok: true, status, raw: data };
  } catch {
    return { ok: false, error: "Could not reach the payment provider.", status: 502 };
  }
}
