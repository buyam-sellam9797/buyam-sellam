import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyShop } from "@/lib/supabase-admin";
import { formatFcfa } from "@/lib/format";
import { after } from "next/server";
import { sendOrderEmails } from "@/lib/order-emails";

// Shared by every place that can hear "this order's payment was
// confirmed" — a gateway's webhook, or the buyer's own browser polling
// for a result — so a paid order always gets the exact same treatment
// (escrow transition + timestamp + payment event row + seller alert)
// no matter which of those told us first. See order-pricing.ts for the
// same idea applied to how an order's price is computed.
export async function markOrderPaid(
  admin: SupabaseClient,
  input: { paymentReference: string; provider: string; eventType: string; rawPayload: unknown }
): Promise<{ id: string; shop_id: string; total_amount_fcfa: number } | null> {
  const { data: updatedOrder } = await admin
    .from("orders")
    .update({
      status: "paid_held",
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("payment_reference", input.paymentReference)
    .eq("status", "pending_payment")
    .select("id, shop_id, total_amount_fcfa")
    .maybeSingle();

  if (!updatedOrder) return null;

  await admin.from("payment_events").insert({
    order_id: updatedOrder.id,
    provider: input.provider,
    event_type: input.eventType,
    raw_payload: input.rawPayload as object,
  });

  await notifyShop(admin, {
    shopId: updatedOrder.shop_id,
    type: "new_order",
    title: "New order — payment received",
    body: `A buyer just paid ${formatFcfa(updatedOrder.total_amount_fcfa)}. It's held safely until you ship and they confirm delivery.`,
    orderId: updatedOrder.id,
  });

  after(() => sendOrderEmails(admin, updatedOrder.id, "paid"));

  return updatedOrder;
}

// Stock is only taken off the shelf once payment is actually confirmed
// — never at checkout start — so an abandoned mobile money prompt never
// permanently reserves inventory. A simple read-then-write (not an
// atomic decrement), an accepted simplification at this order volume.
export async function decrementStockAndNotify(
  admin: SupabaseClient,
  orderId: string,
  shopId: string
): Promise<void> {
  const { data: items } = await admin
    .from("order_items")
    .select("product_id, quantity")
    .eq("order_id", orderId);

  for (const item of items ?? []) {
    const { data: prod } = await admin
      .from("products")
      .select("stock_quantity, title")
      .eq("id", item.product_id)
      .maybeSingle();
    if (!prod) continue;

    const newStock = Math.max(0, prod.stock_quantity - item.quantity);
    await admin.from("products").update({ stock_quantity: newStock }).eq("id", item.product_id);

    // Only fire the moment stock crosses into "needs attention" (<=3,
    // same threshold as the dashboard's low-stock badge) — never
    // re-fire on every later checkout of an already-low item.
    if (newStock <= 3 && prod.stock_quantity > 3) {
      await notifyShop(admin, {
        shopId,
        type: "low_stock",
        title: newStock === 0 ? "Out of stock" : "Low stock",
        body:
          newStock === 0 ? `"${prod.title}" just sold out.` : `"${prod.title}" has only ${newStock} left.`,
      });
    }
  }
}

// Marks a single layaway installment paid, given the NotchPay
// reference that was just confirmed — and, if that was the order's
// last unpaid installment, finishes the order through the exact same
// markOrderPaid() every other payment gateway uses, so escrow and
// seller notification for a fully-paid layaway order are identical to
// a normal order's.
//
// Shared between three callers that can all learn "this charge went
// through" independently: the buyer's own browser polling right after
// each installment charge (see /api/layaway/route.ts and
// /api/layaway/[orderId]/installment/route.ts), and the NotchPay
// webhook (/api/webhooks/notchpay) — the same "more than one path can
// hear about the same payment" situation markOrderPaid itself exists
// to handle for full-payment orders. Returns null when the reference
// doesn't match any pending installment (the normal case for a
// full-payment order's webhook delivery, which the caller falls back
// to handling itself).
export async function completeLayawayInstallment(
  admin: SupabaseClient,
  input: { paymentReference: string; provider: string; eventType: string; rawPayload: unknown }
): Promise<{ orderId: string; installmentNumber: number; fullyPaid: boolean } | null> {
  const { data: installment } = await admin
    .from("layaway_installments")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("payment_reference", input.paymentReference)
    .eq("status", "pending")
    .select("id, order_id, installment_number, amount_fcfa")
    .maybeSingle();

  if (!installment) return null;

  await admin.from("payment_events").insert({
    order_id: installment.order_id,
    provider: input.provider,
    event_type: input.eventType,
    raw_payload: input.rawPayload as object,
  });

  const { data: remaining } = await admin
    .from("layaway_installments")
    .select("id")
    .eq("order_id", installment.order_id)
    .eq("status", "pending");
  const fullyPaid = !remaining || remaining.length === 0;

  if (installment.installment_number === 1) {
    // Deposit received — reserve the stock now (same helper a normal
    // order uses once IT is paid) and let the seller know money is
    // coming, without implying they should ship: the order isn't
    // paid_held yet, so nothing downstream treats it as ready to ship.
    const { data: order } = await admin.from("orders").select("shop_id, total_amount_fcfa").eq("id", installment.order_id).maybeSingle();
    if (order) {
      await decrementStockAndNotify(admin, installment.order_id, order.shop_id);
      if (!fullyPaid) {
        await notifyShop(admin, {
          shopId: order.shop_id,
          type: "new_order",
          title: "New layaway order — deposit received",
          body: `A buyer paid a ${formatFcfa(installment.amount_fcfa)} deposit. The rest is due before you'll be asked to ship — you'll be notified once it's fully paid.`,
          orderId: installment.order_id,
        });
      }
    }
  }

  if (fullyPaid) {
    const { data: order } = await admin.from("orders").select("payment_reference").eq("id", installment.order_id).maybeSingle();
    if (order?.payment_reference) {
      await markOrderPaid(admin, {
        paymentReference: order.payment_reference,
        provider: input.provider,
        eventType: "layaway.completed",
        rawPayload: input.rawPayload,
      });
    }
  }

  return { orderId: installment.order_id, installmentNumber: installment.installment_number, fullyPaid };
}

// --- Njangi-style group buy (see /api/group-buy/...) — a campaign
// only ships if enough buyers join by its deadline. Each participant's
// order is charged for real, immediately, the moment they join (same
// NotchPay flow as a normal checkout) but is NOT treated as a normal
// paid order the instant that charge clears: it sits in a distinct
// "group_buy_pending" status — money collected, but contingent on the
// group succeeding — until the campaign either reaches its target
// (tryFinalizeGroupBuy, called right after every join) or its deadline
// passes without reaching it (expireGroupBuy, called by the daily
// cron). This is deliberately its own small state machine rather than
// a reuse of markOrderPaid: markOrderPaid's job is "this order's own
// single payment cleared, escrow it" — a group-buy order's payment
// clearing is necessary but not sufficient, since shipping still
// depends on everyone else's payments too. ---

// Marks a group-buy participant's order paid (pending group success)
// once their own NotchPay charge clears, records their spot in the
// campaign, and checks whether that was the join that tipped the
// campaign over its target. Shared between the buyer's own browser
// polling right after joining (see /api/group-buy/[id]/join) and the
// NotchPay webhook — same "more than one path can hear about the same
// payment" situation as markOrderPaid and completeLayawayInstallment.
// Returns null when the reference doesn't match a pending group-buy
// order (the normal case for every other kind of payment's webhook
// delivery, which the caller falls back to handling itself).
export async function completeGroupBuyJoin(
  admin: SupabaseClient,
  input: { paymentReference: string; provider: string; eventType: string; rawPayload: unknown }
): Promise<{ orderId: string; groupBuyId: string } | null> {
  const { data: order } = await admin
    .from("orders")
    .update({ status: "group_buy_pending", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("payment_reference", input.paymentReference)
    .eq("status", "pending_payment")
    .not("group_buy_id", "is", null)
    .select("id, group_buy_id")
    .maybeSingle();

  if (!order?.group_buy_id) return null;

  await admin.from("payment_events").insert({
    order_id: order.id,
    provider: input.provider,
    event_type: input.eventType,
    raw_payload: input.rawPayload as object,
  });

  const { data: items } = await admin.from("order_items").select("quantity").eq("order_id", order.id);
  const quantity = (items ?? []).reduce((sum, i) => sum + i.quantity, 0) || 1;
  await admin.from("group_buy_participants").insert({ group_buy_id: order.group_buy_id, order_id: order.id, quantity });

  await tryFinalizeGroupBuy(admin, order.group_buy_id);

  return { orderId: order.id, groupBuyId: order.group_buy_id };
}

// Checks whether a campaign has reached its target quantity yet and,
// if so, finishes every participant's order the same way a normal
// order finishes once paid: escrowed, seller notified, stock taken off
// the shelf. The status update this starts with
// (`open` → `succeeded`, guarded by `.eq("status", "open")`) is what
// makes it safe to call after every single join without risking a
// campaign being finalized twice if two joins somehow both push it
// over the target at nearly the same moment.
export async function tryFinalizeGroupBuy(admin: SupabaseClient, groupBuyId: string): Promise<void> {
  const { data: group } = await admin
    .from("group_buys")
    .select("id, target_quantity")
    .eq("id", groupBuyId)
    .eq("status", "open")
    .maybeSingle();
  if (!group) return;

  const { data: participants } = await admin
    .from("group_buy_participants")
    .select("order_id, quantity")
    .eq("group_buy_id", groupBuyId);
  const totalQuantity = (participants ?? []).reduce((sum, p) => sum + p.quantity, 0);
  if (totalQuantity < group.target_quantity) return;

  const { data: claimed } = await admin
    .from("group_buys")
    .update({ status: "succeeded", finalized_at: new Date().toISOString() })
    .eq("id", groupBuyId)
    .eq("status", "open")
    .select("id")
    .maybeSingle();
  if (!claimed) return;

  for (const p of participants ?? []) {
    const { data: order } = await admin
      .from("orders")
      .update({ status: "paid_held", updated_at: new Date().toISOString() })
      .eq("id", p.order_id)
      .eq("status", "group_buy_pending")
      .select("id, shop_id, total_amount_fcfa")
      .maybeSingle();
    if (!order) continue;

    await notifyShop(admin, {
      shopId: order.shop_id,
      type: "new_order",
      title: "Group buy succeeded — new order",
      body: `The group buy reached its target. A buyer's ${formatFcfa(order.total_amount_fcfa)} payment is now held safely and ready to ship.`,
      orderId: order.id,
    });
    await decrementStockAndNotify(admin, order.id, order.shop_id);
  }
}

// Called by the daily cron (see /api/cron/finalize-group-buys) for a
// campaign whose deadline has passed while it was still "open" — it
// never reached its target, so every participant is owed a refund.
// There's no automated NotchPay refund API anywhere in this codebase
// (disputes are refunded the same manual way — see the dispute
// resolution flow), so this files a dispute per affected order instead
// of trying to reverse the charge itself: that puts it directly in
// front of the admin dispute queue that already exists, with the
// buyer's phone and the amount owed, ready for a manual refund and a
// "resolved: refunded" click — no new admin UI needed for this at all.
export async function expireGroupBuy(admin: SupabaseClient, groupBuyId: string): Promise<void> {
  const { data: claimed } = await admin
    .from("group_buys")
    .update({ status: "failed", finalized_at: new Date().toISOString() })
    .eq("id", groupBuyId)
    .eq("status", "open")
    .select("id")
    .maybeSingle();
  if (!claimed) return;

  const { data: participants } = await admin
    .from("group_buy_participants")
    .select("order_id")
    .eq("group_buy_id", groupBuyId);

  for (const p of participants ?? []) {
    const { data: order } = await admin
      .from("orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", p.order_id)
      .eq("status", "group_buy_pending")
      .select("id, shop_id, buyer_phone, total_amount_fcfa")
      .maybeSingle();
    if (!order) continue;

    await admin.from("disputes").insert({
      order_id: order.id,
      shop_id: order.shop_id,
      buyer_phone: order.buyer_phone,
      reason: "other",
      description: `Group buy did not reach its target quantity by the deadline. The buyer paid ${formatFcfa(order.total_amount_fcfa)} and is owed a refund.`,
      status: "open",
    });
  }
}
