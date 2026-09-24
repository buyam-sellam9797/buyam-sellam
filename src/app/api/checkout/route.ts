import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveBagPricing, type BagLineInput } from "@/lib/order-pricing";
import { markOrderPaid, decrementStockAndNotify } from "@/lib/order-fulfillment";
import { resolveAgreedOffer } from "@/lib/offers";
import { getSharedBagByToken, isSharedBagOpen, pricingInputFor, type SharedBagRow } from "@/lib/shared-bags";
import { cleanEmail } from "@/lib/email-address";
import { getSiteUrl } from "@/lib/site";
import { getOrderSecrets } from "@/lib/order-secrets";

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
  // One item (Buy now) ...
  productId?: string;
  quantity?: number;
  // ... or several items from one shop (the bag) ...
  items?: BagLineInput[];
  // ... or one item at a price agreed through an offer ...
  offerId?: string;
  // ... or a bag someone shared with a "pay for me" link.
  sharedBagToken?: string;
  payerName?: string;
  provider: "mtn" | "orange" | "card";
  phone: string;
  deliveryName?: string;
  deliveryPhone?: string;
  isGift?: boolean;
  giftNote?: string;
  buyerEmail?: string;
  locale?: string;
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

  const { provider, phone } = body;
  if (provider === "card" && process.env.NOTCHPAY_CARDS_ENABLED !== "true") {
    return NextResponse.json({ error: "Card payment is not available yet." }, { status: 400 });
  }
  if (!provider || !phone) {
    return NextResponse.json({ error: "Missing provider or phone." }, { status: 400 });
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

  // A shared bag carries its own items and the recipient's delivery
  // details; the person paying only adds their payment number (and,
  // optionally, their name so the recipient knows who paid).
  let sharedBag: SharedBagRow | null = null;
  if (body.sharedBagToken) {
    sharedBag = await getSharedBagByToken(admin, body.sharedBagToken);
    if (!sharedBag || !isSharedBagOpen(sharedBag)) {
      return NextResponse.json({ error: "This payment link has expired or was already paid." }, { status: 410 });
    }
  }

  const delivery = sharedBag
    ? {
        name: sharedBag.delivery.name,
        phone: sharedBag.delivery.phone,
        city: sharedBag.delivery.city,
        neighborhood: sharedBag.delivery.neighborhood ?? null,
        address: sharedBag.delivery.address ?? null,
        notes: sharedBag.delivery.notes ?? null,
        latitude: sharedBag.delivery.latitude ?? undefined,
        longitude: sharedBag.delivery.longitude ?? undefined,
        zoneId: sharedBag.delivery.zoneId ?? undefined,
      }
    : {
        name: body.deliveryName ?? "",
        phone: body.deliveryPhone || phone,
        city: body.deliveryCity ?? "",
        neighborhood: body.deliveryNeighborhood || null,
        address: body.deliveryAddress || null,
        notes: body.deliveryNotes || null,
        latitude: typeof body.deliveryLatitude === "number" ? body.deliveryLatitude : undefined,
        longitude: typeof body.deliveryLongitude === "number" ? body.deliveryLongitude : undefined,
        zoneId: body.deliveryZoneId,
      };
  if (!delivery.name || !delivery.city) {
    return NextResponse.json(
      { error: "Please tell us who to deliver this to, and which city." },
      { status: 400 }
    );
  }

  // Offer price: only for the buyer who agreed it, on that product.
  let agreedUnitPriceFcfa: number | undefined;
  if (body.offerId && !sharedBag) {
    if (!body.productId) return NextResponse.json({ error: "Missing product." }, { status: 400 });
    const agreed = await resolveAgreedOffer(admin, { offerId: body.offerId, buyerId, productId: body.productId });
    if (!agreed.ok) return NextResponse.json({ error: agreed.error, code: agreed.code }, { status: agreed.status });
    agreedUnitPriceFcfa = agreed.unitPriceFcfa;
  }

  const lines: BagLineInput[] = sharedBag
    ? sharedBag.items
    : Array.isArray(body.items) && body.items.length > 0
      ? body.items
      : body.productId
        ? [{ productId: body.productId, quantity: body.quantity }]
        : [];
  if (lines.length === 0) {
    return NextResponse.json({ error: "Missing product." }, { status: 400 });
  }

  const pricing = sharedBag
    ? await resolveBagPricing(admin, pricingInputFor(sharedBag))
    : await resolveBagPricing(admin, {
        lines,
        agreedUnitPriceFcfa,
        deliveryLatitude: delivery.latitude,
        deliveryLongitude: delivery.longitude,
        deliveryZoneId: delivery.zoneId,
      });
  if (!pricing.ok) {
    return NextResponse.json({ error: pricing.error }, { status: pricing.status });
  }
  const { deliveryFeeFcfa, deliveryDistanceKm, deliveryZoneName, totalAmountFcfa } = pricing;

  const orderReference = `bs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      shop_id: pricing.shopId,
      status: "pending_payment",
      total_amount_fcfa: totalAmountFcfa,
      payment_provider: "notchpay",
      payment_reference: orderReference,
      // A shared bag's order belongs to the person who asked: it shows
      // in their account with the delivery code, and emails go to them.
      buyer_id: sharedBag ? sharedBag.creator_id : buyerId,
      buyer_phone: phone,
      delivery_name: delivery.name,
      delivery_phone: delivery.phone,
      is_gift: sharedBag ? false : Boolean(body.isGift),
      gift_note: !sharedBag && body.isGift ? (body.giftNote || null) : null,
      buyer_email: sharedBag ? null : cleanEmail(body.buyerEmail),
      buyer_locale: body.locale === "fr" || body.locale === "en" ? body.locale : null,
      delivery_city: delivery.city,
      delivery_neighborhood: delivery.neighborhood,
      delivery_address: delivery.address,
      delivery_notes: delivery.notes,
      delivery_fee_fcfa: deliveryFeeFcfa,
      delivery_latitude: delivery.latitude ?? null,
      delivery_longitude: delivery.longitude ?? null,
      delivery_distance_km: deliveryDistanceKm,
      delivery_zone_name: deliveryZoneName,
      offer_id: agreedUnitPriceFcfa != null ? body.offerId : null,
      shared_bag_id: sharedBag?.id ?? null,
      payer_name: sharedBag ? (body.payerName ?? "").trim().slice(0, 80) || null : null,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Could not start the order. Please try again." }, { status: 500 });
  }

  const { error: itemsError } = await admin.from("order_items").insert(
    pricing.lines.map((l) => ({
      order_id: order.id,
      product_id: l.product.id,
      quantity: l.quantity,
      unit_price_fcfa: l.unitPriceFcfa,
    }))
  );
  if (itemsError) {
    await admin.from("orders").update({ status: "cancelled" }).eq("id", order.id);
    return NextResponse.json({ error: "Could not start the order. Please try again." }, { status: 500 });
  }

  // The person paying for someone else's bag never gets the order's
  // private key: the delivery code belongs to the one receiving it.
  const viewKey = sharedBag ? null : ((await getOrderSecrets(admin, order.id))?.view_key ?? null);

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
        description: pricing.description,
        reference: orderReference,
        customer:
          provider === "card"
            ? { phone, email: cleanEmail(body.buyerEmail) ?? undefined, name: sharedBag ? body.payerName || undefined : delivery.name }
            : { phone },
        ...(provider === "card"
          ? {
              callback: sharedBag
                ? `${getSiteUrl()}/pay/${sharedBag.token}?paid=1`
                : `${getSiteUrl()}/order/${order.id}${viewKey ? `?k=${viewKey}` : ""}`,
            }
          : {}),
      }),
    });

    const initData = await initRes.json();
    if (!initRes.ok) {
      return NextResponse.json(
        { error: initData?.message ?? "Could not start the payment.", debug: initData },
        { status: initRes.status }
      );
    }

    // Card payments (for buyers abroad): NotchPay's hosted payment page
    // takes the card; the buyer is sent there and comes back to their
    // order page, and the NotchPay webhook marks the order paid.
    if (provider === "card") {
      const authorizationUrl: string | undefined = initData?.authorization_url ?? initData?.transaction?.authorization_url;
      if (!authorizationUrl) {
        return NextResponse.json({ error: "Card payment is not available right now." }, { status: 502 });
      }
      return NextResponse.json({ authorizationUrl, orderReference, orderId: order.id, viewKey });
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
      viewKey,
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
        // Shared with the NotchPay webhook: whichever hears first wins,
        // the other is a no-op. Stock is only taken off the shelf once
        // payment is confirmed, never at checkout start.
        const updatedOrder = await markOrderPaid(admin, {
          paymentReference: orderReference,
          provider: "notchpay",
          eventType: "payment.complete",
          rawPayload: data,
        });
        if (updatedOrder && updatedOrder.payment_plan !== "layaway") {
          await decrementStockAndNotify(admin, updatedOrder.id, updatedOrder.shop_id);
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
