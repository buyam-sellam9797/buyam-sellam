import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveOrderPricing } from "@/lib/order-pricing";
import { notifyShop } from "@/lib/supabase-admin";
import { formatFcfa } from "@/lib/format";

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
  quantity?: number;
  provider: "mtn" | "orange";
  phone: string;
  deliveryName?: string;
  deliveryPhone?: string;
  isGift?: boolean;
  giftNote?: string;
  deliveryCity?: string;
  deliveryNeighborhood?: string;
  deliveryAddress?: string;
  deliveryNotes?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliveryZoneId?: string;
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

  const {
    productId,
    provider,
    phone,
    deliveryName,
    deliveryCity,
    deliveryNeighborhood,
    deliveryAddress,
    deliveryNotes,
  } = body;
  if (!productId || !provider || !phone) {
    return NextResponse.json({ error: "Missing product, provider, or phone." }, { status: 400 });
  }

  // Logged-in buyers are optional — most checkouts are still guests
  // identified only by phone. When an Authorization header is present
  // (a signed-in buyer completing checkout), resolve it to a user id so
  // the order can be tied to their account and show up in /account's
  // order history. A missing or invalid token just falls back to guest
  // checkout exactly as before — it never blocks the purchase.
  let buyerId: string | null = null;
  const authHeader = req.headers.get("authorization") ?? "";
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "");
  if (bearerToken) {
    const { data: userData } = await admin.auth.getUser(bearerToken);
    if (userData?.user) buyerId = userData.user.id;
  }
  if (!deliveryName || !deliveryCity) {
    return NextResponse.json(
      { error: "Please tell us who to deliver this to, and which city." },
      { status: 400 }
    );
  }

  const pricing = await resolveOrderPricing(admin, {
    productId,
    quantity: body.quantity,
    deliveryLatitude: body.deliveryLatitude,
    deliveryLongitude: body.deliveryLongitude,
    deliveryZoneId: body.deliveryZoneId,
  });
  if (!pricing.ok) {
    return NextResponse.json({ error: pricing.error }, { status: pricing.status });
  }
  const {
    product,
    quantity,
    unitPriceFcfa,
    deliveryFeeFcfa,
    deliveryDistanceKm,
    deliveryZoneName,
    totalAmountFcfa,
  } = pricing;

  const orderReference = `bs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      shop_id: product.shop_id,
      status: "pending_payment",
      total_amount_fcfa: totalAmountFcfa,
      payment_provider: "notchpay",
      payment_reference: orderReference,
      buyer_id: buyerId,
      buyer_phone: phone,
      delivery_name: deliveryName,
      delivery_phone: body.deliveryPhone || phone,
      is_gift: Boolean(body.isGift),
      gift_note: body.isGift ? (body.giftNote || null) : null,
      delivery_city: deliveryCity,
      delivery_neighborhood: deliveryNeighborhood || null,
      delivery_address: deliveryAddress || null,
      delivery_notes: deliveryNotes || null,
      delivery_fee_fcfa: deliveryFeeFcfa,
      delivery_latitude: typeof body.deliveryLatitude === "number" ? body.deliveryLatitude : null,
      delivery_longitude: typeof body.deliveryLongitude === "number" ? body.deliveryLongitude : null,
      delivery_distance_km: deliveryDistanceKm,
      delivery_zone_name: deliveryZoneName,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Could not start the order. Please try again." }, { status: 500 });
  }

  await admin.from("order_items").insert({
    order_id: order.id,
    product_id: product.id,
    quantity,
    unit_price_fcfa: unitPriceFcfa,
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
        amount: totalAmountFcfa,
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
          .update({
            status: "paid_held",
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("payment_reference", orderReference)
          .eq("status", "pending_payment")
          .select("id, shop_id, total_amount_fcfa")
          .maybeSingle();

        if (updatedOrder) {
          await admin.from("payment_events").insert({
            order_id: updatedOrder.id,
            provider: "notchpay",
            event_type: "payment.complete",
            raw_payload: data,
          });

          await notifyShop(admin, {
            shopId: updatedOrder.shop_id,
            type: "new_order",
            title: "New order — payment received",
            body: `A buyer just paid ${formatFcfa(updatedOrder.total_amount_fcfa)}. It's held safely until you ship and they confirm delivery.`,
            orderId: updatedOrder.id,
          });

          // Stock is only taken off the shelf once payment is actually
          // confirmed — never at checkout start, so an abandoned mobile
          // money prompt never permanently reserves inventory. This is a
          // simple read-then-write (not an atomic decrement), which is an
          // accepted simplification at this order volume.
          const { data: items } = await admin
            .from("order_items")
            .select("product_id, quantity")
            .eq("order_id", updatedOrder.id);
          for (const item of items ?? []) {
            const { data: prod } = await admin
              .from("products")
              .select("stock_quantity, title")
              .eq("id", item.product_id)
              .maybeSingle();
            if (prod) {
              const newStock = Math.max(0, prod.stock_quantity - item.quantity);
              await admin
                .from("products")
                .update({ stock_quantity: newStock })
                .eq("id", item.product_id);

              // Only fire the moment stock crosses into "needs attention"
              // (<=3, same threshold as the dashboard's low-stock badge) —
              // never re-fire on every later checkout of an already-low item.
              if (newStock <= 3 && prod.stock_quantity > 3) {
                await notifyShop(admin, {
                  shopId: updatedOrder.shop_id,
                  type: "low_stock",
                  title: newStock === 0 ? "Out of stock" : "Low stock",
                  body:
                    newStock === 0
                      ? `"${prod.title}" just sold out.`
                      : `"${prod.title}" has only ${newStock} left.`,
                });
              }
            }
          }
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
