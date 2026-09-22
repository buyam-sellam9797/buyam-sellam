import { NextRequest, NextResponse } from "next/server";
import { resolveOrderPricing } from "@/lib/order-pricing";
import { initAndChargeNotchPay, checkNotchPayStatus } from "@/lib/notchpay";
import { completeGroupBuyJoin } from "@/lib/order-fulfillment";
import { getAdminClient } from "@/lib/supabase-admin";

// Joining a campaign charges the buyer immediately, for real — same
// NotchPay flow as a normal checkout, just at the campaign's
// group_price_fcfa instead of the product's usual price. The resulting
// order is tagged with group_buy_id and starts life exactly like any
// other order (status "pending_payment"), but once that charge clears
// it does NOT become a normal paid_held order the way checkout's does
// — see completeGroupBuyJoin in order-fulfillment.ts for why (shipping
// depends on the whole campaign succeeding, not just this one payment).
type JoinBody = {
  productId: string;
  quantity?: number;
  provider: "mtn" | "orange";
  phone: string;
  deliveryName?: string;
  deliveryPhone?: string;
  deliveryCity?: string;
  deliveryNeighborhood?: string;
  deliveryAddress?: string;
  deliveryNotes?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliveryZoneId?: string;
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Payments are not configured yet." }, { status: 500 });
  }
  const { id: groupBuyId } = await params;

  let body: JoinBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { productId, provider, phone, deliveryName, deliveryCity, deliveryNeighborhood, deliveryAddress, deliveryNotes } = body;
  if (!productId || !provider || !phone) {
    return NextResponse.json({ error: "Missing product, provider, or phone." }, { status: 400 });
  }
  if (!deliveryName || !deliveryCity) {
    return NextResponse.json({ error: "Please tell us who to deliver this to, and which city." }, { status: 400 });
  }

  const { data: groupBuy } = await admin
    .from("group_buys")
    .select("id, shop_id, product_id, target_quantity, group_price_fcfa, deadline, status")
    .eq("id", groupBuyId)
    .maybeSingle();
  if (!groupBuy) {
    return NextResponse.json({ error: "This group buy no longer exists." }, { status: 404 });
  }
  if (groupBuy.product_id !== productId) {
    return NextResponse.json({ error: "This group buy is for a different product." }, { status: 400 });
  }
  if (groupBuy.status !== "open" || new Date(groupBuy.deadline).getTime() < Date.now()) {
    return NextResponse.json({ error: "This group buy is no longer accepting new participants." }, { status: 409 });
  }

  let buyerId: string | null = null;
  const authHeader = req.headers.get("authorization") ?? "";
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "");
  if (bearerToken) {
    const { data: userData } = await admin.auth.getUser(bearerToken);
    if (userData?.user) buyerId = userData.user.id;
  }

  // resolveOrderPricing validates the product/shop and computes the
  // delivery fee exactly like a normal checkout would — its own
  // unitPriceFcfa/totalAmountFcfa (the product's regular or sale price)
  // is deliberately NOT used below; the campaign's fixed
  // group_price_fcfa replaces it.
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
  const { product, quantity, deliveryFeeFcfa, deliveryDistanceKm, deliveryZoneName } = pricing;
  const totalAmountFcfa = groupBuy.group_price_fcfa * quantity + deliveryFeeFcfa;

  const orderReference = `bs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      shop_id: product.shop_id,
      status: "pending_payment",
      group_buy_id: groupBuy.id,
      total_amount_fcfa: totalAmountFcfa,
      payment_provider: "notchpay",
      payment_reference: orderReference,
      buyer_id: buyerId,
      buyer_phone: phone,
      delivery_name: deliveryName,
      delivery_phone: body.deliveryPhone || phone,
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
    unit_price_fcfa: groupBuy.group_price_fcfa,
  });

  const charge = await initAndChargeNotchPay({
    amountFcfa: totalAmountFcfa,
    phone,
    provider,
    description: `${product.title} — group buy`,
    reference: orderReference,
  });
  if (!charge.ok) {
    return NextResponse.json({ error: charge.error, debug: charge.debug }, { status: charge.status });
  }

  return NextResponse.json({ reference: charge.reference, orderReference, orderId: order.id });
}

// Polled by the client right after joining. Once NotchPay confirms the
// charge, completeGroupBuyJoin records the participant and checks
// whether the campaign just reached its target — the webhook can also
// complete this same join independently if it arrives first (see the
// comment on completeGroupBuyJoin in order-fulfillment.ts).
export async function GET(req: NextRequest) {
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Payments are not configured yet." }, { status: 500 });
  }
  const reference = req.nextUrl.searchParams.get("reference");
  if (!reference) {
    return NextResponse.json({ error: "Missing reference." }, { status: 400 });
  }

  const result = await checkNotchPayStatus(reference);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (result.status === "complete") {
    await completeGroupBuyJoin(admin, {
      paymentReference: reference,
      provider: "notchpay",
      eventType: "group_buy.joined",
      rawPayload: result.raw,
    });
  }

  return NextResponse.json({ status: result.status });
}
