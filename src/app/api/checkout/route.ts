import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Server-side only — these keys never reach the browser.
const NOTCHPAY_PUBLIC_KEY = process.env.NOTCHPAY_PUBLIC_KEY ?? "";
const NOTCHPAY_BASE_URL = "https://api.notchpay.co";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// A privileged client used only in this trusted server route — it can
// write orders for guest buyers (who have no logged-in session) and
// update payment status without needing broad public write rules that
// anyone could otherwise call directly with the public anon key.
function getAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

type ChargeBody = {
  productId: string;
  provider: "mtn" | "orange";
  phone: string;
};

// Starts a NotchPay payment for a real product: looks the product up
// (so the price can't be tampered with from the browser), creates a
// pending order, then initializes and charges via mobile money. Returns
// both the reference NotchPay uses and the reference our own order was
// filed under, so the client can poll for the buyer's confirmation.
export async function POST(req: NextRequest) {
  if (!NOTCHPAY_PUBLIC_KEY) {
    return NextResponse.json(
      { error: "Payments are not configured yet (missing NOTCHPAY_PUBLIC_KEY)." },
      { status: 500 }
    );
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Payments are not configured yet (missing Supabase service role key)." },
      { status: 500 }
    );
  }

  let body: ChargeBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { productId, provider, phone } = body;
  if (!productId || !provider || !phone) {
    return NextResponse.json({ error: "Missing product, provider, or phone." }, { status: 400 });
  }

  const { data: product, error: productError } = await admin
    .from("products")
    .select("id, shop_id, title, price_fcfa, is_active")
    .eq("id", productId)
    .eq("is_active", true)
    .maybeSingle();

  if (productError || !product) {
    return NextResponse.json({ error: "This product is no longer available." }, { status: 404 });
  }

  const orderReference = `bs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      shop_id: product.shop_id,
      status: "pending_payment",
      total_amount_fcfa: product.price_fcfa,
      payment_provider: "notchpay",
      payment_reference: orderReference,
      buyer_phone: phone,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Could not start the order. Please try again." }, { status: 500 });
  }

  await admin.from("order_items").insert({
    order_id: order.id,
    product_id: product.id,
    quantity: 1,
    unit_price_fcfa: product.price_fcfa,
  });

  try {
    // Step 1: initialize the payment
    const initRes = await fetch(`${NOTCHPAY_BASE_URL}/payments`, {
      method: "POST",
      headers: {
        Authorization: NOTCHPAY_PUBLIC_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: product.price_fcfa,
        currency: "XAF",
        description: product.title,
        reference: orderReference,
        customer: { phone },
      }),
    });

    const initData = await initRes.json();
    if (!initRes.ok) {
      return NextResponse.json(
        { error: initData?.message ?? "Could not start the payment.", debug: initData },
        { status: initRes.status }
      );
    }

    // NotchPay's actual response nests these under "transaction".
    const txReference: string | undefined = initData?.transaction?.reference;
    const txId: string | undefined = initData?.transaction?.id;
    const candidates = [txReference, txId, orderReference].filter(
      (v): v is string => Boolean(v)
    );

    // Step 2: trigger the mobile money charge (sends the prompt to the phone).
    // Try each identifier NotchPay might expect, in order, since the docs
    // and real API responses don't always agree on reference vs id.
    const channel = provider === "mtn" ? "cm.mtn" : "cm.orange";
    let chargeData: Record<string, unknown> | null = null;
    let chargeOk = false;
    let usedReference = candidates[0];
    let lastError: unknown = null;

    for (const candidate of candidates) {
      const chargeRes = await fetch(`${NOTCHPAY_BASE_URL}/payments/${candidate}`, {
        method: "POST",
        headers: {
          Authorization: NOTCHPAY_PUBLIC_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel, data: { phone } }),
      });
      const data = await chargeRes.json();
      if (chargeRes.ok) {
        chargeData = data;
        chargeOk = true;
        usedReference = candidate;
        break;
      }
      lastError = data;
      // Only keep trying the next candidate on a "not found"-style miss.
      if (chargeRes.status !== 404) break;
    }

    if (!chargeOk) {
      const errData = (lastError ?? {}) as { message?: string };
      return NextResponse.json(
        {
          error: errData?.message ?? "Could not charge that mobile money number.",
          debug: { initData, lastError, candidates },
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      reference: usedReference,
      orderReference,
      orderId: order.id,
      debug: chargeData,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the payment provider. Please try again." },
      { status: 502 }
    );
  }
}

// Polled by the client to find out whether the buyer approved the
// mobile money prompt yet. Once NotchPay confirms it, the matching
// order is flipped to "paid_held" so the seller sees it in their
// dashboard and the escrow clock starts.
export async function GET(req: NextRequest) {
  if (!NOTCHPAY_PUBLIC_KEY) {
    return NextResponse.json(
      { error: "Payments are not configured yet." },
      { status: 500 }
    );
  }

  const reference = req.nextUrl.searchParams.get("reference");
  const orderReference = req.nextUrl.searchParams.get("orderReference");
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

    if (status === "complete" && orderReference) {
      const admin = getAdminClient();
      if (admin) {
        const { data: updatedOrder } = await admin
          .from("orders")
          .update({ status: "paid_held", updated_at: new Date().toISOString() })
          .eq("payment_reference", orderReference)
          .eq("status", "pending_payment")
          .select("id")
          .maybeSingle();

        if (updatedOrder) {
          await admin.from("payment_events").insert({
            order_id: updatedOrder.id,
            provider: "notchpay",
            event_type: "payment.complete",
            raw_payload: data,
          });
        }
      }
    }

    return NextResponse.json({ status });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the payment provider." },
      { status: 502 }
    );
  }
}
