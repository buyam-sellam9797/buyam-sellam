import { NextRequest, NextResponse } from "next/server";

// Server-side only — this key never reaches the browser.
const NOTCHPAY_PUBLIC_KEY = process.env.NOTCHPAY_PUBLIC_KEY ?? "";
const NOTCHPAY_BASE_URL = "https://api.notchpay.co";

type ChargeBody = {
  amount: number;
  productTitle: string;
  provider: "mtn" | "orange";
  phone: string;
};

// Starts a NotchPay payment: initialize, then immediately trigger the
// mobile money charge (this sends the USSD/approval prompt to the
// buyer's phone). Returns the payment reference so the client can poll
// for the buyer's confirmation.
export async function POST(req: NextRequest) {
  if (!NOTCHPAY_PUBLIC_KEY) {
    return NextResponse.json(
      { error: "Payments are not configured yet (missing NOTCHPAY_PUBLIC_KEY)." },
      { status: 500 }
    );
  }

  let body: ChargeBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { amount, productTitle, provider, phone } = body;
  if (!amount || !provider || !phone) {
    return NextResponse.json({ error: "Missing amount, provider, or phone." }, { status: 400 });
  }

  const reference = `bs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    // Step 1: initialize the payment
    const initRes = await fetch(`${NOTCHPAY_BASE_URL}/payments`, {
      method: "POST",
      headers: {
        Authorization: NOTCHPAY_PUBLIC_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        currency: "XAF",
        description: productTitle,
        reference,
        customer: { phone },
      }),
    });

    const initData = await initRes.json();
    if (!initRes.ok) {
      return NextResponse.json(
        { error: initData?.message ?? "Could not start the payment." },
        { status: initRes.status }
      );
    }

    const paymentReference: string = initData?.payment?.reference ?? reference;

    // Step 2: trigger the mobile money charge (sends the prompt to the phone)
    const channel = provider === "mtn" ? "cm.mtn" : "cm.orange";
    const chargeRes = await fetch(`${NOTCHPAY_BASE_URL}/payments/${paymentReference}`, {
      method: "POST",
      headers: {
        Authorization: NOTCHPAY_PUBLIC_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel, data: { phone } }),
    });

    const chargeData = await chargeRes.json();
    if (!chargeRes.ok) {
      return NextResponse.json(
        { error: chargeData?.message ?? "Could not charge that mobile money number." },
        { status: chargeRes.status }
      );
    }

    return NextResponse.json({ reference: paymentReference });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the payment provider. Please try again." },
      { status: 502 }
    );
  }
}

// Polled by the client to find out whether the buyer approved the
// mobile money prompt yet.
export async function GET(req: NextRequest) {
  if (!NOTCHPAY_PUBLIC_KEY) {
    return NextResponse.json(
      { error: "Payments are not configured yet." },
      { status: 500 }
    );
  }

  const reference = req.nextUrl.searchParams.get("reference");
  if (!reference) {
    return NextResponse.json({ error: "Missing reference." }, { status: 400 });
  }

  try {
    const res = await fetch(`${NOTCHPAY_BASE_URL}/payments/${reference}`, {
      headers: { Authorization: NOTCHPAY_PUBLIC_KEY },
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.message ?? "Could not check payment status." },
        { status: res.status }
      );
    }
    const status: string = data?.transaction?.status ?? data?.payment?.status ?? "pending";
    return NextResponse.json({ status });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the payment provider." },
      { status: 502 }
    );
  }
}
