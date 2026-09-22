import { NextRequest, NextResponse } from "next/server";
import { initAndChargeNotchPay, checkNotchPayStatus } from "@/lib/notchpay";
import { completeLayawayInstallment } from "@/lib/order-fulfillment";
import { getAdminClient } from "@/lib/supabase-admin";

// Charges the next unpaid installment of an existing layaway order —
// in v1 that's always installment #2, the final one, since a layaway
// plan is exactly two installments (see /api/layaway/route.ts). Kept
// as its own "[orderId]/installment" endpoint rather than folded into
// the order-creation route so the buyer can come back later (a
// different page load, possibly a different day) and pay just this
// one remaining charge.
export async function POST(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Payments are not configured yet." }, { status: 500 });
  }
  const { orderId } = await params;

  let body: { provider?: "mtn" | "orange"; phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { provider, phone } = body;
  if (!provider || !phone) {
    return NextResponse.json({ error: "Missing provider or phone." }, { status: 400 });
  }

  const { data: order } = await admin
    .from("orders")
    .select("id, payment_reference, payment_plan")
    .eq("id", orderId)
    .eq("payment_plan", "layaway")
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ error: "Layaway order not found." }, { status: 404 });
  }

  const { data: installment } = await admin
    .from("layaway_installments")
    .select("id, installment_number, amount_fcfa, status")
    .eq("order_id", orderId)
    .eq("status", "pending")
    .order("installment_number", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!installment) {
    return NextResponse.json({ error: "This layaway plan has already been paid in full." }, { status: 409 });
  }

  // Timestamped so a retried charge (the buyer's first attempt at this
  // installment was declined, say) never reuses a reference NotchPay
  // has already seen — unlike the deposit, this route can plausibly be
  // called again for the very same installment days apart.
  const chargeReference = `${order.payment_reference}_${installment.installment_number}_${Date.now()}`;
  const charge = await initAndChargeNotchPay({
    amountFcfa: installment.amount_fcfa,
    phone,
    provider,
    description: `Layaway installment ${installment.installment_number}/2`,
    reference: chargeReference,
  });
  if (!charge.ok) {
    return NextResponse.json({ error: charge.error, debug: charge.debug }, { status: charge.status });
  }

  await admin.from("layaway_installments").update({ payment_reference: charge.reference }).eq("id", installment.id);

  return NextResponse.json({ reference: charge.reference, installmentNumber: installment.installment_number });
}

// Polled by the client after the POST above. Once NotchPay confirms
// this charge, completeLayawayInstallment marks the installment paid
// — and, being the last one, hands the order to the exact same
// markOrderPaid() helper every other payment gateway finishes through,
// so escrow, seller notification, and payout eligibility all follow
// the one already-tested code path. The NotchPay webhook can complete
// this same installment independently if it arrives first — see the
// comment on completeLayawayInstallment.
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
    await completeLayawayInstallment(admin, {
      paymentReference: reference,
      provider: "notchpay",
      eventType: "layaway.completed",
      rawPayload: result.raw,
    });
  }

  return NextResponse.json({ status: result.status });
}
