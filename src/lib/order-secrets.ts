import type { SupabaseClient } from "@supabase/supabase-js";

// Server-only access to an order's delivery code and buyer view key
// (public.order_secrets has no RLS policies, so only the service role
// can read it). Rows are created by a database trigger on every order.
export type OrderSecrets = { delivery_code: string; view_key: string; handover_attempts: number };

export async function getOrderSecrets(admin: SupabaseClient, orderId: string): Promise<OrderSecrets | null> {
  const { data } = await admin
    .from("order_secrets")
    .select("delivery_code, view_key, handover_attempts")
    .eq("order_id", orderId)
    .maybeSingle();
  return (data as OrderSecrets | null) ?? null;
}

export const MAX_HANDOVER_ATTEMPTS = 5;

/**
 * Is this request from the order's buyer? Either it carries the order's
 * private view key (the `k` in the payment email / checkout link, sent
 * as ?k= or the x-order-key header) or the signed-in buyer's session.
 * The shop that sold the order never counts as the buyer.
 */
export async function requestIsOrderBuyer(
  admin: SupabaseClient,
  req: Request,
  orderId: string
): Promise<boolean> {
  const url = new URL(req.url);
  const key = req.headers.get("x-order-key") || url.searchParams.get("k");
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null;

  const { data: order } = await admin
    .from("orders")
    .select("buyer_id, shop:shops(owner_id)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return false;
  const shop = (Array.isArray(order.shop) ? order.shop[0] : order.shop) as { owner_id: string } | null;

  let userId: string | null = null;
  if (token) {
    const { data } = await admin.auth.getUser(token);
    userId = data?.user?.id ?? null;
  }
  if (userId && shop?.owner_id === userId) return false;
  if (userId && order.buyer_id === userId) return true;

  if (key) {
    const secrets = await getOrderSecrets(admin, orderId);
    if (secrets && secrets.view_key.length >= 16 && timingSafeEqualStr(key, secrets.view_key)) return true;
  }
  return false;
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
