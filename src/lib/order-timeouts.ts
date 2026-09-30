import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyShop } from "@/lib/supabase-admin";
import { sendOrderEmails } from "@/lib/order-emails";
import { putBackStock } from "@/lib/order-fulfillment";
import { formatFcfa } from "@/lib/format";

// Run once a day by /api/cron/auto-confirm-orders. Nothing here moves
// money by itself: anything that needs a refund becomes a dispute in the
// admin queue, where the refund is sent and confirmed by a person.

const DAY = 24 * 60 * 60 * 1000;
export const SHIP_REMINDER_AFTER_DAYS = 2;
export const SHIP_DEADLINE_DAYS = 7;
export const LAYAWAY_GRACE_DAYS = 7;
const STALE_UNPAID_DAYS = 2;

const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

/** Paid but not sent: remind the seller, then cancel for a refund. */
export async function handleUnshippedOrders(admin: SupabaseClient) {
  let reminded = 0;
  let cancelled = 0;

  // 1. Reminder, once, two days after payment.
  const { data: toRemind } = await admin
    .from("orders")
    .update({ ship_reminded_at: new Date().toISOString() })
    .eq("status", "paid_held")
    .is("ship_reminded_at", null)
    .lt("paid_at", ago(SHIP_REMINDER_AFTER_DAYS))
    .gte("paid_at", ago(SHIP_DEADLINE_DAYS))
    .select("id, shop_id, total_amount_fcfa");
  for (const o of toRemind ?? []) {
    await notifyShop(admin, {
      shopId: o.shop_id,
      type: "ship_reminder",
      title: "Please send this order",
      body: `An order of ${formatFcfa(o.total_amount_fcfa)} was paid ${SHIP_REMINDER_AFTER_DAYS} days ago and isn't marked as sent. If it isn't sent within ${SHIP_DEADLINE_DAYS} days of payment it is cancelled and the buyer refunded.`,
      orderId: o.id,
    });
    reminded++;
  }

  // 2. Deadline passed: cancel into the refund queue.
  const { data: overdue } = await admin
    .from("orders")
    .select("id, shop_id, buyer_phone, total_amount_fcfa")
    .eq("status", "paid_held")
    .lt("paid_at", ago(SHIP_DEADLINE_DAYS));
  for (const o of overdue ?? []) {
    const { data: claimed } = await admin
      .from("orders")
      .update({ status: "disputed", updated_at: new Date().toISOString() })
      .eq("id", o.id)
      .eq("status", "paid_held")
      .select("id")
      .maybeSingle();
    if (!claimed) continue;
    await admin.from("disputes").insert({
      order_id: o.id,
      shop_id: o.shop_id,
      buyer_phone: o.buyer_phone,
      reason: "seller_not_responding",
      description: `Automatic: paid ${SHIP_DEADLINE_DAYS}+ days ago and never marked as sent. Refund the buyer ${formatFcfa(o.total_amount_fcfa)} (resolve as "refunded"), unless the seller proves delivery.`,
      status: "open",
    });
    await notifyShop(admin, {
      shopId: o.shop_id,
      type: "order_cancelled",
      title: "Order cancelled — not sent in time",
      body: `An order of ${formatFcfa(o.total_amount_fcfa)} was not marked as sent within ${SHIP_DEADLINE_DAYS} days, so it was cancelled and the buyer will be refunded.`,
      orderId: o.id,
    });
    await sendOrderEmails(admin, o.id, "unshipped_cancelled");
    cancelled++;
  }
  return { reminded, cancelled };
}

type OverdueInstallment = {
  id: string;
  order_id: string;
  due_at: string;
  reminded_at: string | null;
  order: { status: string; payment_plan: string; stock_taken: boolean; shop_id: string; buyer_phone: string | null } | null;
};

/** Pay-in-parts plans with a missed payment: remind, then close. */
export async function handleOverdueLayaway(admin: SupabaseClient) {
  let reminded = 0;
  let closed = 0;

  const { data } = await admin
    .from("layaway_installments")
    .select("id, order_id, due_at, reminded_at, order:orders(status, payment_plan, stock_taken, shop_id, buyer_phone)")
    .eq("status", "pending")
    .lt("due_at", new Date().toISOString())
    .order("due_at", { ascending: true })
    .limit(500);

  const rows = ((data ?? []) as unknown as (OverdueInstallment & { order: OverdueInstallment["order"] | OverdueInstallment["order"][] })[]).map(
    (r) => ({ ...r, order: Array.isArray(r.order) ? r.order[0] ?? null : r.order })
  );
  const handled = new Set<string>();

  for (const inst of rows) {
    const order = inst.order;
    // Only live plans whose deposit was paid (it reserved the stock).
    if (!order || order.status !== "pending_payment" || order.payment_plan !== "layaway" || !order.stock_taken) continue;
    if (handled.has(inst.order_id)) continue;
    handled.add(inst.order_id);

    const overdueDays = (Date.now() - new Date(inst.due_at).getTime()) / DAY;
    if (overdueDays < LAYAWAY_GRACE_DAYS) {
      if (inst.reminded_at) continue;
      const { data: marked } = await admin
        .from("layaway_installments")
        .update({ reminded_at: new Date().toISOString() })
        .eq("id", inst.id)
        .is("reminded_at", null)
        .select("id")
        .maybeSingle();
      if (marked) {
        await sendOrderEmails(admin, inst.order_id, "layaway_due");
        reminded++;
      }
      continue;
    }

    const { data: claimed } = await admin
      .from("orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", inst.order_id)
      .eq("status", "pending_payment")
      .select("id")
      .maybeSingle();
    if (!claimed) continue;
    await putBackStock(admin, inst.order_id);

    const { data: paidRows } = await admin
      .from("layaway_installments")
      .select("amount_fcfa")
      .eq("order_id", inst.order_id)
      .eq("status", "paid");
    const paid = (paidRows ?? []).reduce((s, r) => s + r.amount_fcfa, 0);
    if (paid > 0) {
      await admin.from("disputes").insert({
        order_id: inst.order_id,
        shop_id: order.shop_id,
        buyer_phone: order.buyer_phone,
        reason: "other",
        description: `Automatic: pay-in-parts plan abandoned (payment ${LAYAWAY_GRACE_DAYS}+ days overdue). Refund the buyer the ${formatFcfa(paid)} already paid (resolve as "refunded").`,
        status: "open",
      });
    }
    await notifyShop(admin, {
      shopId: order.shop_id,
      type: "order_cancelled",
      title: "Pay-in-parts plan closed",
      body: "A buyer stopped paying their plan. It's closed and the item is back in your stock.",
      orderId: inst.order_id,
    });
    await sendOrderEmails(admin, inst.order_id, "layaway_cancelled");
    closed++;
  }
  return { reminded, closed };
}

/** Housekeeping: abandoned checkouts and old rate-limit counters. */
export async function cleanUp(admin: SupabaseClient) {
  const { data: stale } = await admin
    .from("orders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("status", "pending_payment")
    .eq("stock_taken", false)
    .lt("created_at", ago(STALE_UNPAID_DAYS))
    .select("id");
  await admin.from("rate_limits").delete().lt("window_start", ago(1));
  return { staleCheckoutsCancelled: stale?.length ?? 0 };
}
