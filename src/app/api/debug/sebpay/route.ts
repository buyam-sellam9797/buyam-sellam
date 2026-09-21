import { NextRequest, NextResponse } from "next/server";

// TEMPORARY — a diagnostic-only route to see exactly what SebPay's live
// API returns for this account, since the checkout page's SebPay option
// isn't showing up and there's no way to inspect this without hitting
// the same endpoints sebpay.ts uses. Never returns the actual key
// values (only whether they're set, and a short, safe-to-show prefix),
// and is gated by a hardcoded token — not a real secret, just enough to
// keep it from being casually stumbled on while it's live. Delete this
// whole route once the SebPay option is confirmed working.
const DEBUG_TOKEN = "bs-sebpay-diag-7f2a";

const SEBPAY_PUBLIC_KEY = process.env.SEBPAY_PUBLIC_KEY ?? "";
const SEBPAY_SECRET_KEY = process.env.SEBPAY_SECRET_KEY ?? "";
const SEBPAY_BASE_URL = "https://newapi.sebpay.bj/api/v1";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== DEBUG_TOKEN) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const configured = Boolean(SEBPAY_PUBLIC_KEY && SEBPAY_SECRET_KEY);
  const headers = {
    "X-Public-Key": SEBPAY_PUBLIC_KEY,
    "X-Secret-Key": SEBPAY_SECRET_KEY,
    "Content-Type": "application/json",
  };

  const result: Record<string, unknown> = {
    configured,
    publicKeyPrefix: SEBPAY_PUBLIC_KEY ? SEBPAY_PUBLIC_KEY.slice(0, 8) : null,
    secretKeyPrefix: SEBPAY_SECRET_KEY ? SEBPAY_SECRET_KEY.slice(0, 8) : null,
  };

  try {
    const opsRes = await fetch(`${SEBPAY_BASE_URL}/operators?country=CM`, {
      headers,
      cache: "no-store",
    });
    result.operatorsStatus = opsRes.status;
    result.operatorsBody = await opsRes.text();
  } catch (e) {
    result.operatorsError = String(e);
  }

  try {
    const countriesRes = await fetch(`${SEBPAY_BASE_URL}/countries`, {
      headers,
      cache: "no-store",
    });
    result.countriesStatus = countriesRes.status;
    result.countriesBody = await countriesRes.text();
  } catch (e) {
    result.countriesError = String(e);
  }

  return NextResponse.json(result);
}
