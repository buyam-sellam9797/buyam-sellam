import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { markOrderPaid } from "@/lib/order-fulfillment";
import { verifyWebhookSignature } from "@/lib/sebpay";

// SebPay's server-to-server confirmation — the same reasoning as
// /api/webhooks/notchpay: the buyer's own browser polling
// /api/checkout/sebpay works most of the time, but if they close the
// tab or lose signal right after approving on their phone, this is
// what still moves the order out of "pending_payment" instead of it
// getting stuck forever with the seller never notified.
//
// Matches NotchPay's webhook in NOT decrementing stock here (only the
// browser-poll GET handler does that) — kept that way deliberately so
// both gateways behave identically rather than one becoming "more
// correct" than the other in a way that's easy to forget about later.
export async function POST(req: NextRequest) {
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  // Signature verification needs the exact raw bytes SebPay sent, so
  // this reads text — never req.json() — before anything else touches
  // the body.
  const rawBody = await req.text();
  const signature = req.headers.get("x-sebpay-signature");
  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: { external_reference?: string; status?: string; transaction_id?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const reference = payload.external_reference;
  if (!reference) {
    return NextResponse.json({ ok: true, ignored: "no external_reference in payload" });
  }

  if (payload.status === "approved") {
    await markOrderPaid(admin, {
      paymentReference: reference,
      provider: "sebpay",
      eventType: "collection.approved",
      rawPayload: payload,
    });
  } else if (payload.status === "rejected") {
    const { data: updatedOrder } = await admin
      .from("orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("payment_reference", reference)
      .eq("status", "pending_payment")
      .select("id")
      .maybeSingle();

    if (updatedOrder) {
      await admin.from("payment_events").insert({
        order_id: updatedOrder.id,
        provider: "sebpay",
        event_type: "collection.rejected",
        raw_payload: payload,
      });
    }
  }

  // SebPay requires a 200 within 5 seconds and may retry the same
  // webhook more than once — markOrderPaid's own `.eq("status",
  // "pending_payment")` guard makes a retry a safe no-op, so there's
  // nothing extra to do here for idempotence.
  return NextResponse.json({ ok: true });
}
