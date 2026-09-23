import { NextRequest, NextResponse, after } from "next/server";
import { sendOrderEmails } from "@/lib/order-emails";
import { getAdminClient, notifyShop } from "@/lib/supabase-admin";
import { verifyNotchPayWebhook, extractNotchPayReference, extractNotchPayEventType } from "@/lib/notchpay";
import { completeLayawayInstallment, completeGroupBuyJoin } from "@/lib/order-fulfillment";
import { formatFcfa } from "@/lib/format";

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
  const reference = extractNotchPayReference(payload);

  if (!reference) {
    // Nothing to match this to — acknowledge so NotchPay doesn't keep
    // retrying a payload we could never act on anyway.
    return NextResponse.json({ ok: true, ignored: "no reference in payload" });
  }

  if (eventType === "payment.complete" || eventType === "payment.success") {
    // Stock is only taken off the shelf once payment is actually
    // confirmed (see /api/checkout's GET handler for the matching
    // comment) — this is the second, more reliable path to that same
    // "paid_held" transition, guarded the same way: only a still-
    // pending order can be moved, so a late/duplicate webhook delivery
    // after the browser's own poll already confirmed it is a no-op.
    // The `.is("group_buy_id", null)` guard is the only change from
    // this route's original, already-tested query: a group-buy join
    // charge (see /api/group-buy/[id]/join) must NOT be escrowed the
    // instant it clears the way every other order is — it's contingent
    // on the whole campaign succeeding — so it's left for the
    // completeGroupBuyJoin branch below to handle instead.
    const { data: updatedOrder } = await admin
      .from("orders")
      .update({
        status: "paid_held",
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("payment_reference", reference)
      .eq("status", "pending_payment")
      .is("group_buy_id", null)
      .select("id, shop_id, total_amount_fcfa")
      .maybeSingle();

    if (updatedOrder) {
      await admin.from("payment_events").insert({
        order_id: updatedOrder.id,
        provider: "notchpay",
        event_type: eventType,
        raw_payload: payload as object,
      });

      await notifyShop(admin, {
        shopId: updatedOrder.shop_id,
        type: "new_order",
        title: "New order — payment received",
        body: `A buyer just paid ${formatFcfa(updatedOrder.total_amount_fcfa)}. It's held safely until you ship and they confirm delivery.`,
        orderId: updatedOrder.id,
      });
      const paidOrderId = updatedOrder.id as string;
      after(() => sendOrderEmails(admin, paidOrderId, "paid"));
    } else {
      // No ordinary order was charged in full under this exact
      // reference — the other two shapes a NotchPay reference can take
      // are a group-buy join charge (/api/group-buy/[id]/join) or one
      // of layaway's per-installment charges (/api/layaway/...), whose
      // reference is derived from but not equal to any order's own
      // payment_reference. Each helper is a no-op if the reference
      // doesn't match what it's looking for.
      const groupBuyResult = await completeGroupBuyJoin(admin, {
        paymentReference: reference,
        provider: "notchpay",
        eventType,
        rawPayload: payload,
      });
      if (!groupBuyResult) {
        await completeLayawayInstallment(admin, {
          paymentReference: reference,
          provider: "notchpay",
          eventType,
          rawPayload: payload,
        });
      }
    }
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
      .eq("payment_reference", reference)
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
