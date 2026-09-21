import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyShop } from "@/lib/supabase-admin";
import { formatFcfa } from "@/lib/format";

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
