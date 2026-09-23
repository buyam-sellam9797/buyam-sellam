import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { resolveOrderPricing } from "@/lib/order-pricing";
import { markOrderPaid, decrementStockAndNotify } from "@/lib/order-fulfillment";
import {
  createCollection,
  getCollectionStatus,
  getCurrencyForCountry,
  getOperatorsForCountry,
  isSebpayConfigured,
  SEBPAY_COUNTRY_CODE,
} from "@/lib/sebpay";
import { getSiteUrl } from "@/lib/site";
import { cleanEmail } from "@/lib/email-address";

// SebPay's second checkout path, kept as its own route rather than a
// branch inside /api/checkout — see sebpay.ts for why. Mirrors that
// route's shape (POST to start, GET to poll) so the client-side polling
// code in checkout-form.tsx works the same way for either gateway.
type ChargeBody = {
  productId: string;
  quantity?: number;
  operator: string;
  phone: string;
  otpCode?: string;
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

export async function POST(req: NextRequest) {
  if (!isSebpayConfigured()) {
    return NextResponse.json(
      { error: "SebPay is not configured yet (missing SEBPAY_PUBLIC_KEY/SEBPAY_SECRET_KEY)." },
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

  const { productId, operator, phone, deliveryName, deliveryCity, deliveryNeighborhood, deliveryAddress, deliveryNotes } = body;
  if (!productId || !operator || !phone) {
    return NextResponse.json({ error: "Missing product, operator, or phone." }, { status: 400 });
  }
  if (!deliveryName || !deliveryCity) {
    return NextResponse.json(
      { error: "Please tell us who to deliver this to, and which city." },
      { status: 400 }
    );
  }

  // Never trust an operator slug/OTP requirement passed from the
  // browser at face value — re-check against SebPay's own live list for
  // this account, the same list the checkout page rendered its buttons
  // from, so a tampered request can't sneak in an operator this account
  // doesn't actually have enabled.
  const [operators, currency] = await Promise.all([
    getOperatorsForCountry(SEBPAY_COUNTRY_CODE),
    getCurrencyForCountry(SEBPAY_COUNTRY_CODE),
  ]);
  const matchedOperator = operators.find((o) => o.slug === operator);
  if (!matchedOperator) {
    return NextResponse.json({ error: "That payment operator isn't available." }, { status: 400 });
  }
  if (!currency) {
    return NextResponse.json(
      { error: "SebPay hasn't confirmed a currency for Cameroon on this account yet." },
      { status: 500 }
    );
  }
  if (matchedOperator.otpRequired && !body.otpCode) {
    return NextResponse.json(
      { error: "This operator needs the code from your phone before we can charge it." },
      { status: 400 }
    );
  }

  let buyerId: string | null = null;
  const authHeader = req.headers.get("authorization") ?? "";
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "");
  if (bearerToken) {
    const { data: userData } = await admin.auth.getUser(bearerToken);
    if (userData?.user) buyerId = userData.user.id;
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
  const { product, quantity, unitPriceFcfa, deliveryFeeFcfa, deliveryDistanceKm, deliveryZoneName, totalAmountFcfa } =
    pricing;

  const orderReference = `bs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      shop_id: product.shop_id,
      status: "pending_payment",
      total_amount_fcfa: totalAmountFcfa,
      payment_provider: "sebpay",
      payment_reference: orderReference,
      buyer_id: buyerId,
      buyer_phone: phone,
      delivery_name: deliveryName,
      delivery_phone: body.deliveryPhone || phone,
      is_gift: Boolean(body.isGift),
      gift_note: body.isGift ? (body.giftNote || null) : null,
      buyer_email: cleanEmail(body.buyerEmail),
      buyer_locale: body.locale === "fr" || body.locale === "en" ? body.locale : null,
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

  const result = await createCollection({
    amountFcfa: totalAmountFcfa,
    currency,
    phone,
    operator: matchedOperator.slug,
    country: SEBPAY_COUNTRY_CODE,
    externalReference: orderReference,
    callbackUrl: `${getSiteUrl()}/api/webhooks/sebpay`,
    otpCode: body.otpCode,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    transactionId: result.transactionId,
    orderReference,
    orderId: order.id,
    status: result.status,
  });
}

// Polled by the client the same way as /api/checkout's GET handler —
// once SebPay confirms the payment, the matching order is flipped to
// "paid_held" so the seller sees it and the escrow clock starts.
export async function GET(req: NextRequest) {
  if (!isSebpayConfigured()) {
    return NextResponse.json({ error: "SebPay is not configured yet." }, { status: 500 });
  }
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  const transactionId = req.nextUrl.searchParams.get("transactionId");
  const orderReference = req.nextUrl.searchParams.get("orderReference");
  if (!transactionId || !orderReference) {
    return NextResponse.json({ error: "Missing transactionId or orderReference." }, { status: 400 });
  }

  const result = await getCollectionStatus(transactionId);
  if (!result) {
    return NextResponse.json({ error: "Could not reach SebPay." }, { status: 502 });
  }

  if (result.status === "approved") {
    const updatedOrder = await markOrderPaid(admin, {
      paymentReference: orderReference,
      provider: "sebpay",
      eventType: "collection.approved",
      rawPayload: { transactionId, status: result.status },
    });
    if (updatedOrder) {
      await decrementStockAndNotify(admin, updatedOrder.id, updatedOrder.shop_id);
    }
  } else if (result.status === "rejected") {
    await admin
      .from("orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("payment_reference", orderReference)
      .eq("status", "pending_payment");
  }

  return NextResponse.json({ status: result.status });
}
