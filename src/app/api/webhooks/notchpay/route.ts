import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { verifyNotchPayWebhook, extractNotchPayEventType, readNotchPayTx } from "@/lib/notchpay";
import { applyConfirmedNotchPayPayment } from "@/lib/order-fulfillment";

// Before this route existed, an order only flipped from
// "pending_payment" to "paid_held" when the BUYER'S OWN BROWSER polled
// /api/checkout's GET handler and asked NotchPay directly whether the
// payment went through. That works fine most of the time, but if a
// buyer approves the mobile money prompt and then closes the tab,
// loses signal, or their phone dies before the next poll fires,
// NotchPay has the money and our database never hears about it — the
// order sits stuck forever, the seller is never notified, and the
// buyer paid for nothing as far as the platform can tell.
//
// This webhook is NotchPay telling us directly, server-to-server, the
// same way Didit already does for identity verification (see
// /api/webhooks/didit). It's now the authoritative source of truth for
// payment status; the browser's polling still runs too, purely for
// fast on-screen feedback while someone is actively watching the page.
export async function POST(req: NextRequest) {
  const admin = getAdminClient();
  const secret = process.env.NOTCHPAY_WEBHOOK_SECRET;
  if (!admin || !secret) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  // Signature verification needs the exact raw bytes NotchPay sent, so
  // this reads text — never req.json() — before anything else touches
  // the body.
  const rawBody = await req.text();
  const signature = req.headers.get("x-notch-signature");
  if (!verifyNotchPayWebhook(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const eventType = extractNotchPayEventType(payload);
  const tx = readNotchPayTx(payload);
  // Our own order/charge reference, as we gave it to NotchPay.
  const ourReference = tx.merchantReference ?? tx.reference;

  if (!ourReference) {
    // Nothing to match this to — acknowledge so NotchPay doesn't keep
    // retrying a payload we could never act on anyway.
    return NextResponse.json({ ok: true, ignored: "no reference in payload" });
  }

  if (eventType === "payment.complete" || eventType === "payment.success") {
    // Same path as the buyer's own polling: matched on our reference,
    // amount checked, escrow + stock + alerts; a no-op if already done.
    await applyConfirmedNotchPayPayment(admin, tx, { eventType, rawPayload: payload });
  } else if (
    eventType === "payment.failed" ||
    eventType === "payment.canceled" ||
    eventType === "payment.cancelled" ||
    eventType === "payment.expired"
  ) {
    // A payment that definitely isn't coming — release the order
    // instead of leaving it stuck in "pending_payment" indefinitely.
    // Safe to do: stock was never reserved for it in the first place.
    const { data: updatedOrder } = await admin
      .from("orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("payment_reference", ourReference)
      .eq("status", "pending_payment")
      .select("id")
      .maybeSingle();

    if (updatedOrder) {
      await admin.from("payment_events").insert({
        order_id: updatedOrder.id,
        provider: "notchpay",
        event_type: eventType,
        raw_payload: payload as object,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
