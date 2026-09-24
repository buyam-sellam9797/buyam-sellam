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
