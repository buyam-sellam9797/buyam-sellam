import crypto from "crypto";

// SebPay — a second mobile money gateway, added alongside NotchPay
// rather than replacing it (see checkout-form.tsx: buyers choose which
// one to pay with). Kept intentionally separate from notchpay's own
// logic in api/checkout/route.ts — the two providers' request/response
// shapes don't match closely enough to share code, and keeping them
// apart means a bug in one can never touch the other's checkout path.
//
// IMPORTANT — nothing about Cameroon/MTN/Orange support is hardcoded
// here. SebPay's own public docs (https://new.sebpay.bj/fr/docs) don't
// confirm which countries/operators/currency are actually enabled on
// any given account — that table is only populated once you're
// authenticated. So instead of guessing operator slugs or a currency
// code and risking a silently wrong charge, everything is looked up
// live from SebPay's own API (getOperatorsForCountry) and the checkout
// page simply hides the SebPay option if that lookup comes back empty
// or fails. See src/app/checkout/[id]/page.tsx.
const SEBPAY_PUBLIC_KEY = process.env.SEBPAY_PUBLIC_KEY ?? "";
const SEBPAY_SECRET_KEY = process.env.SEBPAY_SECRET_KEY ?? "";
const SEBPAY_BASE_URL = "https://newapi.sebpay.bj/api/v1";
export const SEBPAY_COUNTRY_CODE = "CM";

export function isSebpayConfigured(): boolean {
  return Boolean(SEBPAY_PUBLIC_KEY && SEBPAY_SECRET_KEY);
}

function sebpayHeaders(): Record<string, string> {
  return {
    "X-Public-Key": SEBPAY_PUBLIC_KEY,
    "X-Secret-Key": SEBPAY_SECRET_KEY,
    "Content-Type": "application/json",
  };
}

export type SebpayOperator = {
  slug: string;
  name: string;
  countryCode: string;
  otpRequired: boolean;
  ussdCode: string | null;
};

// Reads whatever SebPay's own API says is actually enabled for this
// account in Cameroon right now — never a hardcoded guess. Every field
// is read defensively (SebPay's docs describe the shape but don't give
// a worked example), and any operator missing a usable slug is dropped
// rather than risking a malformed charge later.
export async function getOperatorsForCountry(countryCode: string): Promise<SebpayOperator[]> {
  if (!isSebpayConfigured()) return [];
  try {
    const res = await fetch(
      `${SEBPAY_BASE_URL}/operators?country=${encodeURIComponent(countryCode)}`,
      { headers: sebpayHeaders(), cache: "no-store" }
    );
    if (!res.ok) return [];
    const body = await res.json();
    const rows: unknown[] = Array.isArray(body?.data)
      ? body.data
      : Array.isArray(body)
        ? body
        : [];
    const operators: SebpayOperator[] = [];
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const slug = (r.slug ?? r.code ?? r.operator) as string | undefined;
      if (!slug || typeof slug !== "string") continue;
      const active = r.status == null || r.status === "active" || r.active !== false;
      if (!active) continue;
      operators.push({
        slug,
        name: typeof r.name === "string" ? r.name : slug.toUpperCase(),
        countryCode:
          typeof r.country === "string"
            ? r.country
            : typeof r.country_code === "string"
              ? r.country_code
              : countryCode,
        otpRequired: Boolean(r.otp_required),
        ussdCode: typeof r.ussd_code === "string" ? r.ussd_code : null,
      });
    }
    return operators;
  } catch {
    // Network hiccup, unexpected response shape, or SebPay is down —
    // treated the same as "not available": the checkout page just
    // won't show the SebPay option, NotchPay checkout is unaffected.
    return [];
  }
}

// The currency to charge for a country, read from SebPay's own
// countries reference rather than assumed — Cameroon uses XAF, but
// this account may not have Cameroon enabled in XAF specifically, and
// guessing on a live payment integration is exactly what this file is
// built to avoid.
export async function getCurrencyForCountry(countryCode: string): Promise<string | null> {
  if (!isSebpayConfigured()) return null;
  try {
    const res = await fetch(`${SEBPAY_BASE_URL}/countries`, {
      headers: sebpayHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = await res.json();
    const rows: unknown[] = Array.isArray(body?.data)
      ? body.data
      : Array.isArray(body)
        ? body
        : [];
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const code = (r.code ?? r.iso_code ?? r.country_code) as string | undefined;
      if (typeof code === "string" && code.toUpperCase() === countryCode.toUpperCase()) {
        const currency = (r.currency ?? r.devise) as string | undefined;
        return typeof currency === "string" ? currency : null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export type CreateCollectionInput = {
  amountFcfa: number;
  currency: string;
  phone: string;
  operator: string;
  country: string;
  externalReference: string;
  callbackUrl?: string;
  otpCode?: string;
};

export type CreateCollectionResult =
  | {
      ok: true;
      transactionId: string;
      status: string;
      providerLink: string | null;
    }
  | { ok: false; error: string; status: number };

export async function createCollection(
  input: CreateCollectionInput
): Promise<CreateCollectionResult> {
  try {
    const res = await fetch(`${SEBPAY_BASE_URL}/collections`, {
      method: "POST",
      headers: sebpayHeaders(),
      body: JSON.stringify({
        amount: input.amountFcfa,
        currency: input.currency,
        phone: input.phone,
        operator: input.operator,
        country: input.country,
        external_reference: input.externalReference,
        ...(input.callbackUrl ? { callback_url: input.callbackUrl } : {}),
        ...(input.otpCode ? { otp_code: input.otpCode } : {}),
      }),
    });
    const body = await res.json().catch(() => null);
    const data = body?.data ?? body;
    if (!res.ok || body?.success === false) {
      return {
        ok: false,
        error: body?.message ?? "SebPay could not start this payment.",
        status: res.status || 502,
      };
    }
    const transactionId: string | undefined = data?.transaction_id;
    if (!transactionId) {
      return { ok: false, error: "SebPay did not return a transaction id.", status: 502 };
    }
    return {
      ok: true,
      transactionId,
      status: data?.status ?? "pending",
      providerLink: typeof data?.provider_link === "string" ? data.provider_link : null,
    };
  } catch {
    return { ok: false, error: "Could not reach SebPay. Please try again.", status: 502 };
  }
}

export async function getCollectionStatus(
  transactionIdOrReference: string
): Promise<{ status: string } | null> {
  try {
    const res = await fetch(
      `${SEBPAY_BASE_URL}/collections/${encodeURIComponent(transactionIdOrReference)}`,
      { headers: sebpayHeaders(), cache: "no-store" }
    );
    if (!res.ok) return null;
    const body = await res.json();
    const data = body?.data ?? body;
    const status = data?.status;
    return typeof status === "string" ? { status } : null;
  } catch {
    return null;
  }
}

// Every webhook must be verified before it's trusted — SebPay's own
// docs are explicit that an unverified webhook must never be acted on.
// Uses a timing-safe comparison so this check itself can't leak the
// correct signature one byte at a time.
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader || !SEBPAY_SECRET_KEY) return false;
  const expected = crypto
    .createHmac("sha256", SEBPAY_SECRET_KEY)
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signatureHeader, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
