import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveBagPricing, type BagLineInput, type BagPricingSuccess } from "@/lib/order-pricing";

// "Ask someone to pay": a signed-in buyer fills a bag from one shop,
// adds their own delivery details and gets a private link. Whoever
// opens the link (a relative abroad, a friend) sees what's in the bag
// and pays for it by Mobile Money or card; the order is delivered to,
// and tracked by, the person who asked. The payer only ever sees the
// recipient's first name and city, never their phone or address.

export const SHARED_BAG_DAYS = 14;

export type SharedBagDelivery = {
  name: string;
  phone: string;
  city: string;
  neighborhood?: string | null;
  address?: string | null;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  zoneId?: string | null;
};

export type SharedBagRow = {
  id: string;
  token: string;
  shop_id: string;
  creator_id: string;
  items: BagLineInput[];
  delivery: SharedBagDelivery;
  note: string | null;
  status: "open" | "paid" | "cancelled";
  order_id: string | null;
  created_at: string;
  expires_at: string;
};

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function cleanDelivery(input: Partial<SharedBagDelivery> | null | undefined): SharedBagDelivery | null {
  if (!input) return null;
  const d: SharedBagDelivery = {
    name: clean(input.name, 80),
    phone: clean(input.phone, 30),
    city: clean(input.city, 60),
    neighborhood: clean(input.neighborhood, 80) || null,
    address: clean(input.address, 200) || null,
    notes: clean(input.notes, 300) || null,
    latitude: num(input.latitude),
    longitude: num(input.longitude),
    zoneId: typeof input.zoneId === "string" && /^[0-9a-f-]{36}$/i.test(input.zoneId) ? input.zoneId : null,
  };
  if (!d.name || !d.phone || !d.city) return null;
  return d;
}

export function pricingInputFor(bag: Pick<SharedBagRow, "items" | "delivery">) {
  return {
    lines: bag.items,
    deliveryLatitude: bag.delivery.latitude ?? undefined,
    deliveryLongitude: bag.delivery.longitude ?? undefined,
    deliveryZoneId: bag.delivery.zoneId ?? undefined,
  };
}

export async function createSharedBag(
  admin: SupabaseClient,
  input: { creatorId: string; items: BagLineInput[]; delivery: Partial<SharedBagDelivery>; note?: string | null }
): Promise<{ ok: true; token: string; pricing: BagPricingSuccess } | { ok: false; error: string; status: number }> {
  const delivery = cleanDelivery(input.delivery);
  if (!delivery) return { ok: false, error: "Add the name, phone number and city for the delivery.", status: 400 };
  const items = (input.items ?? []).map((i) => ({ productId: i.productId, quantity: i.quantity }));
  const pricing = await resolveBagPricing(admin, pricingInputFor({ items, delivery }));
  if (!pricing.ok) return pricing;

  // Keep it tidy: at most 10 open links per person at a time.
  const { count } = await admin
    .from("shared_bags")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", input.creatorId)
    .eq("status", "open")
    .gt("expires_at", new Date().toISOString());
  if ((count ?? 0) >= 10) {
    return { ok: false, error: "You already have 10 open payment links. Cancel one from your account first.", status: 429 };
  }

  const { data, error } = await admin
    .from("shared_bags")
    .insert({
      shop_id: pricing.shopId,
      creator_id: input.creatorId,
      items: pricing.lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
      delivery,
      note: clean(input.note, 300) || null,
      expires_at: new Date(Date.now() + SHARED_BAG_DAYS * 86400_000).toISOString(),
    })
    .select("token")
    .single();
  if (error || !data) return { ok: false, error: "Could not create the link. Please try again.", status: 500 };
  return { ok: true, token: data.token as string, pricing };
}

export async function getSharedBagByToken(admin: SupabaseClient, token: string): Promise<SharedBagRow | null> {
  if (!/^[0-9a-f]{32}$/i.test(token)) return null;
  const { data } = await admin
    .from("shared_bags")
    .select("id, token, shop_id, creator_id, items, delivery, note, status, order_id, created_at, expires_at")
    .eq("token", token)
    .maybeSingle();
  return (data as SharedBagRow | null) ?? null;
}

export function isSharedBagOpen(bag: SharedBagRow): boolean {
  return bag.status === "open" && new Date(bag.expires_at).getTime() > Date.now();
}

export const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? "";
