import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// Shared service-role client for server-only code (Route Handlers and
// Server Components — never a "use client" file). It bypasses Row
// Level Security entirely, so every place that uses it must decide
// for itself exactly which rows it's allowed to touch.
export function getAdminClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// Bumps a shop's storefront view counter. Uses the admin client because
// anonymous visitors (everyone browsing storefronts) have no RLS write
// access to shops — this is the one narrow write a public page needs,
// so it goes through the service role rather than a broad write policy.
// Fire-and-forget from the shop page; a failed count bump should never
// break the page itself.
export async function incrementShopViews(shopId: string): Promise<void> {
  const admin = getAdminClient();
  if (!admin) return;
  const { data } = await admin.from("shops").select("view_count").eq("id", shopId).maybeSingle();
  if (!data) return;
  await admin
    .from("shops")
    .update({ view_count: (data.view_count ?? 0) + 1 })
    .eq("id", shopId);
}

// Records an in-app alert for a seller — a new paid order, a buyer's
// dispute — so they find out from the dashboard's own notification
// bell instead of only by refreshing it themselves. Always called from
// a trusted server route with the admin client already in hand there
// (checkout confirmation, the NotchPay webhook, dispute filing), and
// deliberately not awaited-and-checked by its callers: a failed insert
// here should never break the payment or dispute flow that triggered it.
export async function notifyShop(
  admin: SupabaseClient,
  input: {
    shopId: string;
    type: "new_order" | "dispute_filed" | "low_stock" | "payout_released";
    title: string;
    body?: string | null;
    orderId?: string | null;
  }
): Promise<void> {
  await admin.from("notifications").insert({
    shop_id: input.shopId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    order_id: input.orderId ?? null,
  });
}
