import { NextRequest, NextResponse } from "next/server";
import { resolveOrderPricing } from "@/lib/order-pricing";
import { initAndChargeNotchPay, checkNotchPayStatus } from "@/lib/notchpay";
import { completeLayawayInstallment } from "@/lib/order-fulfillment";
import { getAdminClient } from "@/lib/supabase-admin";

// Layaway v1: exactly two installments — a 50% deposit charged
// immediately (same as a normal checkout, just for half the amount),
// and the remaining 50% the buyer pays later from their account page
// (see /api/layaway/[orderId]/installment). NotchPay only for now —
// SebPay's OTP-per-charge flow doesn't fit a "come back later and pay
// again" pattern without more design work, so the checkout form only
// offers this option on the NotchPay gateway.
//
// Deliberately does NOT touch /api/checkout/route.ts — that route keeps
// working exactly as it does today for every non-layaway order. This
// is a parallel, additive path that happens to finish through the same
// well-tested markOrderPaid()/decrementStockAndNotify() helpers (see
// order-fulfillment.ts) once the buyer has paid in full, so the escrow
// and payout logic downstream of "fully paid" never had to change.
const DEPOSIT_SHARE = 0.5;
const SECOND_INSTALLMENT_DAYS = 14;

type LayawayChargeBody = {
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

export async function POST(req: NextRequest) {
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Payments are not configured yet." }, { status: 500 });
  }

  let body: LayawayChargeBody;
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
  const { product, quantity, unitPriceFcfa, deliveryFeeFcfa, deliveryDistanceKm, deliveryZoneName, totalAmountFcfa } = pricing;

  const depositAmount = Math.round(totalAmountFcfa * DEPOSIT_SHARE);
  const finalAmount = totalAmountFcfa - depositAmount;
  const orderReference = `bs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      shop_id: product.shop_id,
      status: "pending_payment",
      payment_plan: "layaway",
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

  const now = new Date();
  const dueLater = new Date(now.getTime() + SECOND_INSTALLMENT_DAYS * 24 * 60 * 60 * 1000);
  const { error: installmentsError } = await admin.from("layaway_installments").insert([
    { order_id: order.id, installment_number: 1, amount_fcfa: depositAmount, due_at: now.toISOString() },
    { order_id: order.id, installment_number: 2, amount_fcfa: finalAmount, due_at: dueLater.toISOString() },
  ]);
  if (installmentsError) {
    return NextResponse.json({ error: "Could not set up the layaway plan. Please try again." }, { status: 500 });
  }

  // Suffixed with its own timestamp (not just "_1") so a retried deposit
  // charge — after a declined prompt, say — never reuses a reference
  // NotchPay has already seen, the same way a whole new orderReference
  // is minted for every retry of a normal (non-layaway) checkout.
  const chargeReference = `${orderReference}_1_${Date.now()}`;
  const charge = await initAndChargeNotchPay({
    amountFcfa: depositAmount,
    phone,
    provider,
    description: `${product.title} — deposit (1/2)`,
    reference: chargeReference,
  });
  if (!charge.ok) {
    return NextResponse.json({ error: charge.error, debug: charge.debug }, { status: charge.status });
  }

  await admin
    .from("layaway_installments")
    .update({ payment_reference: charge.reference })
    .eq("order_id", order.id)
    .eq("installment_number", 1);

  return NextResponse.json({
    reference: charge.reference,
    orderReference,
    orderId: order.id,
    depositAmountFcfa: depositAmount,
    finalAmountFcfa: finalAmount,
  });
}

// Polled by the client the same way the regular checkout's deposit is
// polled — once NotchPay confirms it, completeLayawayInstallment marks
// the first installment paid and takes the stock off the shelf, but
// (being installment 1 of 2) never moves the order itself to
// "paid_held" — that only happens once the second installment clears
// too (see the installment sub-route), so a seller never sees "paid,
// ship now" until the buyer has actually paid in full. The NotchPay
// webhook (/api/webhooks/notchpay) can also complete this same
// installment first, independently, if it arrives before this poll
// does — completeLayawayInstallment's own "still pending" guard is what
// makes that safe to run twice.
export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get("reference");
  if (!reference) {
    return NextResponse.json({ error: "Missing reference." }, { status: 400 });
  }

  const result = await checkNotchPayStatus(reference);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (result.status === "complete") {
    const admin = getAdminClient();
    if (admin) {
      await completeLayawayInstallment(admin, {
        paymentReference: reference,
        provider: "notchpay",
        eventType: "layaway.deposit_paid",
        rawPayload: result.raw,
      });
    }
  }

  return NextResponse.json({ status: result.status });
}
