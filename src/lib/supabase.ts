import { createClient } from "@supabase/supabase-js";
import { haversineDistanceKm } from "@/lib/delivery";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Single browser/server client using the public (anon/publishable) key.
// Safe to use in client components — RLS policies in supabase/schema.sql
// decide what it's allowed to read or write. Sessions persist in
// localStorage automatically so sellers stay logged in.
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key"
);

export type Category = {
  id: string;
  name: string;
  slug: string;
};

export type Shop = {
  id: string;
  owner_id: string;
  shop_name: string;
  slug: string;
  description: string | null;
  whatsapp_number: string | null;
  city: string;
  logo_url: string | null;
  cover_url: string | null;
  delivery_info: string | null;
  delivery_fee_fcfa: number | null;
  delivery_eta_text: string | null;
  latitude: number | null;
  longitude: number | null;
  is_verified: boolean;
  is_active: boolean;
  verification_requested_at: string | null;
  view_count: number;
  verification_id_photo_path: string | null;
  verification_note: string | null;
  verification_rejected_reason: string | null;
  // Automatic ID + live-selfie verification via Didit (src/lib/didit.ts) —
  // a separate path from the manual fields above; either one being
  // approved sets is_verified true.
  identity_verification_status: "none" | "pending" | "in_review" | "approved" | "declined" | null;
  identity_verification_session_id: string | null;
  identity_verified_at: string | null;
  is_open: boolean;
  closed_message: string | null;
  business_hours: BusinessHours | null;
  payout_provider: "mtn" | "orange" | null;
  payout_phone_number: string | null;
  // "Ma boutique" social links + return policy — all optional, shown on
  // the shop's public page only when set.
  facebook_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  return_policy: string | null;
};

export type BusinessHoursDay = { closed: boolean; open?: string; close?: string };
export type BusinessHours = {
  mon: BusinessHoursDay;
  tue: BusinessHoursDay;
  wed: BusinessHoursDay;
  thu: BusinessHoursDay;
  fri: BusinessHoursDay;
  sat: BusinessHoursDay;
  sun: BusinessHoursDay;
};

export type BuyerProfile = {
  id: string;
  role: string;
  full_name: string | null;
  phone_number: string | null;
  city: string | null;
};

export type BuyerAddress = {
  id: string;
  buyer_id: string;
  label: string | null;
  full_name: string;
  phone: string;
  city: string;
  neighborhood: string | null;
  address: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
  created_at: string;
};

export type ProductCondition = "new" | "like_new" | "used";

export type Product = {
  id: string;
  shop_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  brand: string | null;
  price_fcfa: number;
  stock_quantity: number;
  image_urls: string[];
  condition: ProductCondition;
  sizes: string[];
  colors: string[];
  is_active: boolean;
  // Promotions: null = not on sale, price_fcfa applies as normal.
  sale_price_fcfa: number | null;
  // Boosting: a free "pin to top of my own shop" toggle.
  is_featured: boolean;
  shop?: Pick<
    Shop,
    | "id"
    | "shop_name"
    | "slug"
    | "city"
    | "whatsapp_number"
    | "is_verified"
    | "delivery_info"
    | "delivery_fee_fcfa"
    | "delivery_eta_text"
    | "latitude"
    | "longitude"
    | "is_open"
    | "closed_message"
  > | null;
  shopRating?: number | null;
  distanceKm?: number | null;
  category?: Pick<Category, "name" | "slug"> | null;
};

export type DeliveryZone = {
  id: string;
  shop_id: string;
  name: string;
  fee_fcfa: number;
  eta_text: string | null;
  sort_order: number;
  created_at: string;
};

export type Review = {
  id: string;
  order_id: string;
  shop_id: string;
  buyer_id: string | null;
  buyer_phone: string | null;
  rating: number;
  product_rating: number | null;
  seller_rating: number | null;
  delivery_rating: number | null;
  comment: string | null;
  created_at: string;
  seller_reply: string | null;
  seller_reply_at: string | null;
};

export type ShopRatingSummary = { average: number; count: number; completedOrders: number };

export type Order = {
  id: string;
  shop_id: string;
  status: string;
  total_amount_fcfa: number;
  payment_provider: string | null;
  payment_reference: string | null;
  buyer_phone: string | null;
  delivery_name: string | null;
  delivery_city: string | null;
  delivery_neighborhood: string | null;
  delivery_address: string | null;
  delivery_notes: string | null;
  delivery_fee_fcfa: number | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  delivery_distance_km: number | null;
  delivery_zone_name: string | null;
  payout_sent: boolean;
  payout_sent_at: string | null;
  accepted_at: string | null;
  paid_at: string | null;
  shipped_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // Only present when fetched via getMyOrders (the seller dashboard) —
  // other order reads (buyer order history, guest tracking) don't join
  // this in, so it's optional rather than always required.
  items?: OrderLineItem[];
};

// One line of a seller's order — which product, how many, and the
// price it was bought at (kept even if the seller later changes the
// product's price, since this is what was actually charged). Only
// populated on getMyOrders (the seller dashboard) for now — this is
// the "what do I actually pack in the box" information that was
// missing before.
export type OrderLineItem = {
  quantity: number;
  unit_price_fcfa: number;
  product: { id: string; title: string; image_urls: string[] } | null;
};

export type BuyerOrder = Order & {
  shop: Pick<Shop, "shop_name" | "slug"> | null;
};

export type DisputeReason =
  | "not_arrived"
  | "wrong_product"
  | "damaged"
  | "different_than_described"
  | "seller_not_responding"
  | "other";

export type Dispute = {
  id: string;
  order_id: string;
  shop_id: string;
  buyer_phone: string | null;
  reason: DisputeReason;
  description: string | null;
  photo_url: string | null;
  status: "open" | "resolved";
  resolution: string | null;
  resolved_action: "refunded" | "released" | null;
  created_at: string;
  resolved_at: string | null;
};

// Distinct cities with at least one active shop, for the browse page's
// location filter — computed client-side from a small select rather
// than a DB-level DISTINCT, since the number of active shops is small.
export async function getActiveShopCities(): Promise<string[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from("shops").select("city").eq("is_active", true);
  if (error || !data) return [];
  return Array.from(new Set(data.map((s) => s.city).filter(Boolean))).sort();
}

export async function getCategories(): Promise<Category[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug")
    .order("name");
  if (error) {
    console.error("getCategories error:", error.message);
    return [];
  }
  return data ?? [];
}

export type ProductSort = "newest" | "price_asc" | "price_desc" | "rating_desc" | "nearest";

export async function getActiveProducts(
  categorySlug?: string,
  filters?: {
    q?: string;
    minPrice?: number;
    maxPrice?: number;
    condition?: ProductCondition;
    sort?: ProductSort;
    verifiedOnly?: boolean;
    city?: string;
    brand?: string;
    size?: string;
    color?: string;
    nearLat?: number;
    nearLng?: number;
  }
): Promise<Product[]> {
  if (!isSupabaseConfigured) return [];
  let query = supabase
    .from("products")
    .select(
      "id, shop_id, category_id, title, description, brand, price_fcfa, stock_quantity, image_urls, condition, sizes, colors, is_active, shop:shops(id, shop_name, slug, city, is_verified, latitude, longitude), category:categories(name, slug)"
    )
    .eq("is_active", true);

  // "rating_desc" and "nearest" can't be pushed down as a DB-level
  // order-by — rating is aggregated from reviews (not a products
  // column) and distance depends on the buyer's own coordinates — so
  // both are sorted client-side below instead.
  if (filters?.sort === "price_asc") {
    query = query.order("price_fcfa", { ascending: true });
  } else if (filters?.sort === "price_desc") {
    query = query.order("price_fcfa", { ascending: false });
  } else if (filters?.sort !== "rating_desc" && filters?.sort !== "nearest") {
    query = query.order("created_at", { ascending: false });
  }

  if (categorySlug) {
    query = query.eq("category.slug", categorySlug);
  }
  if (filters?.q) {
    query = query.ilike("title", `%${filters.q}%`);
  }
  if (filters?.minPrice !== undefined) {
    query = query.gte("price_fcfa", filters.minPrice);
  }
  if (filters?.maxPrice !== undefined) {
    query = query.lte("price_fcfa", filters.maxPrice);
  }
  if (filters?.condition) {
    query = query.eq("condition", filters.condition);
  }
  if (filters?.brand) {
    query = query.ilike("brand", `%${filters.brand}%`);
  }
  if (filters?.size) {
    query = query.contains("sizes", [filters.size]);
  }
  if (filters?.color) {
    query = query.contains("colors", [filters.color]);
  }
  if (filters?.city) {
    query = query.eq("shop.city", filters.city);
  }

  const { data, error } = await query;
  if (error) {
    console.error("getActiveProducts error:", error.message);
    return [];
  }
  // Supabase's embedded filter syntax above can be unreliable across
  // versions, so filter defensively here too when a category/city was
  // requested via an embedded-table condition.
  let rows = (data ?? []) as unknown as Product[];
  if (categorySlug) {
    rows = rows.filter((p) => p.category?.slug === categorySlug);
  }
  if (filters?.city) {
    rows = rows.filter((p) => p.shop?.city === filters.city);
  }
  if (filters?.verifiedOnly) {
    rows = rows.filter((p) => p.shop?.is_verified);
  }

  if (filters?.sort === "rating_desc") {
    const shopIds = Array.from(new Set(rows.map((p) => p.shop_id)));
    const ratings = await getShopRatingsByIds(shopIds);
    rows = rows
      .map((p) => ({ ...p, shopRating: ratings.get(p.shop_id) ?? 0 }))
      .sort((a, b) => (b.shopRating ?? 0) - (a.shopRating ?? 0));
  } else if (
    filters?.sort === "nearest" &&
    typeof filters?.nearLat === "number" &&
    typeof filters?.nearLng === "number"
  ) {
    const nearLat = filters.nearLat;
    const nearLng = filters.nearLng;
    // Products whose shop never pinned a location sort to the end
    // (null distance) rather than being dropped — a shop with no
    // location is still a real listing, just not distance-sortable.
    rows = rows
      .map((p) => ({
        ...p,
        distanceKm:
          p.shop?.latitude != null && p.shop?.longitude != null
            ? haversineDistanceKm(p.shop.latitude, p.shop.longitude, nearLat, nearLng)
            : null,
      }))
      .sort((a, b) => {
        if (a.distanceKm == null && b.distanceKm == null) return 0;
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      });
  } else if (!filters?.sort || filters.sort === "newest") {
    // One concrete advantage of verification: on the default browse
    // order, verified shops' listings float to the top. Array.sort is
    // stable, and rows already arrived newest-first from the DB query,
    // so within "verified" and "not verified" each group stays
    // newest-first — this only reorders the two groups relative to
    // each other. Skipped for price/rating sorts, where the buyer's
    // explicit sort choice should win over this.
    rows = [...rows].sort(
      (a, b) => Number(Boolean(b.shop?.is_verified)) - Number(Boolean(a.shop?.is_verified))
    );
  }

  return rows;
}

// Average rating per shop, for a batch of shop ids at once — used by
// the "best rated" browse sort so it's one extra query for the whole
// page rather than one per product.
async function getShopRatingsByIds(shopIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (shopIds.length === 0) return result;
  const { data, error } = await supabase.from("reviews").select("shop_id, rating").in("shop_id", shopIds);
  if (error || !data) return result;
  const totals = new Map<string, { sum: number; count: number }>();
  for (const row of data) {
    const entry = totals.get(row.shop_id) ?? { sum: 0, count: 0 };
    entry.sum += row.rating;
    entry.count += 1;
    totals.set(row.shop_id, entry);
  }
  for (const [shopId, { sum, count }] of totals) {
    result.set(shopId, count > 0 ? sum / count : 0);
  }
  return result;
}

export async function getProductById(id: string): Promise<Product | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, shop_id, category_id, title, description, brand, price_fcfa, stock_quantity, image_urls, condition, sizes, colors, is_active, sale_price_fcfa, is_featured, shop:shops(id, shop_name, slug, city, whatsapp_number, is_verified, delivery_info, delivery_fee_fcfa, delivery_eta_text, latitude, longitude, is_open, closed_message), category:categories(name, slug)"
    )
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    console.error("getProductById error:", error.message);
    return null;
  }
  return (data as unknown as Product) ?? null;
}

// Average + count of a shop's reviews, plus how many orders it has
// actually completed — the trust badges shown on product/shop pages
// ("🛡️ Verified · 43 orders · ⭐ 4.8 · 12 reviews"). Computed
// client-side from raw rows rather than a DB aggregate — review/order
// volume per shop is small enough that this is simpler than a view/RPC.
export async function getShopRatingSummary(shopId: string): Promise<ShopRatingSummary> {
  if (!isSupabaseConfigured) return { average: 0, count: 0, completedOrders: 0 };
  const [{ data: reviews, error: reviewsError }, { count: completedOrders }] = await Promise.all([
    supabase.from("reviews").select("rating").eq("shop_id", shopId),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("status", "completed"),
  ]);
  if (reviewsError || !reviews || reviews.length === 0) {
    return { average: 0, count: 0, completedOrders: completedOrders ?? 0 };
  }
  const sum = reviews.reduce((s, r) => s + r.rating, 0);
  return { average: sum / reviews.length, count: reviews.length, completedOrders: completedOrders ?? 0 };
}

// Most recent reviews for a shop's public page — capped, since a
// storefront needs a handful of representative reviews, not its
// entire history.
export async function getShopReviews(shopId: string, limit = 10): Promise<Review[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("reviews")
    .select(
      "id, order_id, shop_id, buyer_id, buyer_phone, rating, product_rating, seller_rating, delivery_rating, comment, created_at, seller_reply, seller_reply_at"
    )
    .eq("shop_id", shopId)
    .not("comment", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("getShopReviews error:", error.message);
    return [];
  }
  return data ?? [];
}

// Every review left on a shop, for the seller's own Reviews tab — no
// comment filter (a bare star rating with no text is still something
// a seller should see) and no small cap, since this is the seller's
// own full history rather than a storefront preview.
export async function getShopReviewsForDashboard(shopId: string): Promise<Review[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("reviews")
    .select(
      "id, order_id, shop_id, buyer_id, buyer_phone, rating, product_rating, seller_rating, delivery_rating, comment, created_at, seller_reply, seller_reply_at"
    )
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("getShopReviewsForDashboard error:", error.message);
    return [];
  }
  return data ?? [];
}

// Seller writes or edits their public reply to a review left on their
// own shop. RLS (see migration 016) only allows this for reviews on a
// shop the logged-in seller owns.
export async function replyToReview(reviewId: string, reply: string): Promise<void> {
  const { error } = await supabase
    .from("reviews")
    .update({ seller_reply: reply, seller_reply_at: new Date().toISOString() })
    .eq("id", reviewId);
  if (error) throw new Error(error.message);
}

export type ShopNotification = {
  id: string;
  shop_id: string;
  type: "new_order" | "dispute_filed" | "low_stock" | "payout_released";
  title: string;
  body: string | null;
  order_id: string | null;
  is_read: boolean;
  created_at: string;
};

// The dashboard's notification bell — a new paid order, a buyer's
// dispute (see migration 017). Capped at 50: this is a "what did I
// just miss" list, not a full history.
export async function getMyNotifications(shopId: string): Promise<ShopNotification[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("notifications")
    .select("id, shop_id, type, title, body, order_id, is_read, created_at")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("getMyNotifications error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(shopId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("shop_id", shopId)
    .eq("is_read", false);
  if (error) throw new Error(error.message);
}

// Shops that have earned the verified badge, for the "Verified Shops"
// directory page — ranked so the most established shops lead.
export async function getVerifiedShops(): Promise<Shop[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("shops")
    .select("*")
    .eq("is_verified", true)
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("getVerifiedShops error:", error.message);
    return [];
  }
  return data ?? [];
}

export type HomeStats = {
  productCount: number;
  verifiedShopCount: number;
  completedOrderCount: number;
  averageRating: number;
  reviewCount: number;
};

// Real, live counts for the homepage's social-proof strip. Only ever
// the actual numbers — the strip itself decides whether they're worth
// showing yet (see the homepage), rather than ever faking a number.
export async function getHomeStats(): Promise<HomeStats> {
  if (!isSupabaseConfigured) {
    return { productCount: 0, verifiedShopCount: 0, completedOrderCount: 0, averageRating: 0, reviewCount: 0 };
  }
  const [
    { count: productCount },
    { count: verifiedShopCount },
    { count: completedOrderCount },
    { data: ratingRows },
  ] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase
      .from("shops")
      .select("id", { count: "exact", head: true })
      .eq("is_verified", true)
      .eq("is_active", true),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("reviews").select("rating"),
  ]);
  const reviewCount = ratingRows?.length ?? 0;
  const averageRating =
    reviewCount > 0 ? ratingRows!.reduce((sum, r) => sum + r.rating, 0) / reviewCount : 0;
  return {
    productCount: productCount ?? 0,
    verifiedShopCount: verifiedShopCount ?? 0,
    completedOrderCount: completedOrderCount ?? 0,
    averageRating,
    reviewCount,
  };
}

export async function getShopBySlug(slug: string): Promise<Shop | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("shops")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    console.error("getShopBySlug error:", error.message);
    return null;
  }
  return data;
}

// By default this only returns live, buyable listings (used by the
// public shop page and the onboarding wizard's "do I have any
// products yet" check). Pass includeInactive: true for the seller's
// own dashboard, where a paused listing still needs to show up so the
// seller can turn it back on — it just shouldn't show to buyers.
export async function getShopProducts(
  shopId: string,
  opts?: { includeInactive?: boolean }
): Promise<Product[]> {
  if (!isSupabaseConfigured) return [];
  let query = supabase
    .from("products")
    .select(
      "id, shop_id, category_id, title, description, price_fcfa, stock_quantity, image_urls, condition, sizes, colors, is_active, sale_price_fcfa, is_featured, category:categories(name, slug)"
    )
    .eq("shop_id", shopId);
  if (!opts?.includeInactive) {
    query = query.eq("is_active", true);
  }
  // Featured (boosted) products first — a free, no-payment way for a
  // seller to pin their own products to the top of their own shop page.
  // Ties broken by newest first, same as before this existed.
  const { data, error } = await query
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getShopProducts error:", error.message);
    return [];
  }
  return (data ?? []) as unknown as Product[];
}

// --- Seller-side (requires an authenticated session) ---

export async function getMyShop(): Promise<Shop | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return null;
  const { data, error } = await supabase
    .from("shops")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("getMyShop error:", error.message);
    return null;
  }
  return data;
}

export async function createSellerAccount(input: {
  fullName: string;
  email: string;
  password: string;
  shopName: string;
  whatsappNumber: string;
  city: string;
  description?: string;
  locale?: "en" | "fr";
}): Promise<{ hasSession: boolean; slug: string }> {
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    // Stored as user metadata so the confirmation email template can
    // read it back (as {{ .Data.locale }}) and send French or English
    // depending on which language the person was signing up in.
    options: { data: { locale: input.locale ?? "en" } },
  });
  if (signUpError) throw new Error(signUpError.message);
  const user = signUpData.user;
  if (!user) {
    throw new Error("Could not create your account — please try again.");
  }

  // Done via a server route (service role) rather than a direct table
  // write from the browser: right after sign-up there may not be an
  // active session yet (e.g. if email confirmation is required), and
  // a session is what the usual per-user security rules need to allow
  // a write — this way shop creation always works regardless.
  const res = await fetch("/api/signup-seller", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: user.id,
      fullName: input.fullName,
      whatsappNumber: input.whatsappNumber,
      city: input.city,
      shopName: input.shopName,
      description: input.description,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Could not create your shop.");

  return { hasSession: Boolean(signUpData.session), slug: data.slug };
}

// Same shape of account as a seller (Supabase Auth + a profiles row),
// just role: 'buyer' and no shop. Also routed through a server route
// for the same reason as createSellerAccount: right after sign-up there
// may not be an active session yet if email confirmation is required.
export async function createBuyerAccount(input: {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  city: string;
  locale?: "en" | "fr";
}): Promise<{ hasSession: boolean }> {
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { locale: input.locale ?? "en" } },
  });
  if (signUpError) throw new Error(signUpError.message);
  const user = signUpData.user;
  if (!user) {
    throw new Error("Could not create your account — please try again.");
  }

  const res = await fetch("/api/signup-buyer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: user.id,
      fullName: input.fullName,
      phone: input.phone,
      city: input.city,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Could not finish creating your account.");

  return { hasSession: Boolean(signUpData.session) };
}

// Which role a signed-in account has, for the login page to route to
// the right dashboard (buyer/seller/admin all share one login form).
// Also used by the /account page itself and elsewhere to read the
// buyer's own name/phone/city for pre-filling forms.
export async function getMyProfile(): Promise<BuyerProfile | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, phone_number, city")
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    console.error("getMyProfile error:", error.message);
    return null;
  }
  return data;
}

export async function updateBuyerProfile(input: {
  fullName?: string;
  phone?: string;
  city?: string;
}): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) throw new Error("Not signed in.");
  const { error } = await supabase
    .from("profiles")
    .update({
      ...(input.fullName !== undefined ? { full_name: input.fullName || null } : {}),
      ...(input.phone !== undefined ? { phone_number: input.phone || null } : {}),
      ...(input.city !== undefined ? { city: input.city || null } : {}),
    })
    .eq("id", user.id);
  if (error) throw new Error(error.message);
}

// A logged-in buyer's own order history, across every shop — unlike
// the guest /track-order lookup (phone match, summary fields only),
// this is a real per-account read backed by the "Buyers view their own
// orders" RLS policy, so it can safely show full delivery details.
export async function getMyBuyerOrders(): Promise<BuyerOrder[]> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return [];
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, shop_id, status, total_amount_fcfa, payment_provider, payment_reference, buyer_phone, delivery_name, delivery_city, delivery_neighborhood, delivery_address, delivery_notes, delivery_fee_fcfa, delivery_latitude, delivery_longitude, delivery_distance_km, payout_sent, payout_sent_at, accepted_at, created_at, updated_at, shop:shops(shop_name, slug)"
    )
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getMyBuyerOrders error:", error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    ...row,
    shop: Array.isArray(row.shop) ? (row.shop[0] ?? null) : row.shop,
  })) as BuyerOrder[];
}

export async function getMyAddresses(): Promise<BuyerAddress[]> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return [];
  const { data, error } = await supabase
    .from("buyer_addresses")
    .select("*")
    .eq("buyer_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getMyAddresses error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function createAddress(input: {
  label?: string;
  fullName: string;
  phone: string;
  city: string;
  neighborhood?: string;
  address?: string;
  notes?: string;
  isDefault?: boolean;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) throw new Error("Not signed in.");

  // Only one address can be the default at a time.
  if (input.isDefault) {
    await supabase.from("buyer_addresses").update({ is_default: false }).eq("buyer_id", user.id);
  }

  const { error } = await supabase.from("buyer_addresses").insert({
    buyer_id: user.id,
    label: input.label || null,
    full_name: input.fullName,
    phone: input.phone,
    city: input.city,
    neighborhood: input.neighborhood || null,
    address: input.address || null,
    notes: input.notes || null,
    is_default: Boolean(input.isDefault),
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function deleteAddress(addressId: string): Promise<void> {
  const { error } = await supabase.from("buyer_addresses").delete().eq("id", addressId);
  if (error) throw new Error(error.message);
}

export async function createProduct(input: {
  shopId: string;
  categoryId: string | null;
  title: string;
  description: string;
  brand: string;
  priceFcfa: number;
  stockQuantity: number;
  imageUrls: string[];
  condition: ProductCondition;
  sizes: string[];
  colors: string[];
  salePriceFcfa?: number | null;
  isFeatured?: boolean;
}) {
  const { error } = await supabase.from("products").insert({
    shop_id: input.shopId,
    category_id: input.categoryId,
    title: input.title,
    description: input.description || null,
    brand: input.brand || null,
    price_fcfa: input.priceFcfa,
    stock_quantity: input.stockQuantity,
    image_urls: input.imageUrls,
    condition: input.condition,
    sizes: input.sizes,
    colors: input.colors,
    sale_price_fcfa: input.salePriceFcfa ?? null,
    is_featured: input.isFeatured ?? false,
  });
  if (error) throw new Error(error.message);
}

export async function updateProduct(
  productId: string,
  input: {
    categoryId: string | null;
    title: string;
    description: string;
    brand: string;
    priceFcfa: number;
    stockQuantity: number;
    imageUrls?: string[];
    condition: ProductCondition;
    sizes: string[];
    colors: string[];
    salePriceFcfa?: number | null;
    isFeatured?: boolean;
  }
) {
  const patch: Record<string, unknown> = {
    category_id: input.categoryId,
    title: input.title,
    description: input.description || null,
    brand: input.brand || null,
    price_fcfa: input.priceFcfa,
    stock_quantity: input.stockQuantity,
    condition: input.condition,
    sizes: input.sizes,
    colors: input.colors,
  };
  if (input.imageUrls) patch.image_urls = input.imageUrls;
  if (input.salePriceFcfa !== undefined) patch.sale_price_fcfa = input.salePriceFcfa;
  if (input.isFeatured !== undefined) patch.is_featured = input.isFeatured;
  const { error } = await supabase.from("products").update(patch).eq("id", productId);
  if (error) throw new Error(error.message);
}

// Sellers editing their own shop's storefront info — description and
// delivery details — from the dashboard (separate from the product
// form above, since this describes the shop as a whole, not one item).
// Every field here is optional and only touched when explicitly passed
// — the onboarding wizard saves one field per step (logo on its own
// step, description on its own, etc.), and a required field would mean
// each of those calls silently wipes out everything it didn't mention.
export async function updateShop(
  shopId: string,
  input: {
    description?: string;
    deliveryInfo?: string;
    deliveryFeeFcfa?: number | null;
    deliveryEtaText?: string;
    logoUrl?: string;
    coverUrl?: string;
    whatsappNumber?: string;
    latitude?: number | null;
    longitude?: number | null;
    isOpen?: boolean;
    closedMessage?: string;
    businessHours?: BusinessHours | null;
    payoutProvider?: "mtn" | "orange" | null;
    payoutPhoneNumber?: string;
    facebookUrl?: string;
    instagramUrl?: string;
    tiktokUrl?: string;
    returnPolicy?: string;
  }
) {
  const { error } = await supabase
    .from("shops")
    .update({
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.deliveryInfo !== undefined ? { delivery_info: input.deliveryInfo || null } : {}),
      ...(input.deliveryFeeFcfa !== undefined ? { delivery_fee_fcfa: input.deliveryFeeFcfa } : {}),
      ...(input.deliveryEtaText !== undefined
        ? { delivery_eta_text: input.deliveryEtaText || null }
        : {}),
      ...(input.logoUrl !== undefined ? { logo_url: input.logoUrl || null } : {}),
      ...(input.coverUrl !== undefined ? { cover_url: input.coverUrl || null } : {}),
      ...(input.whatsappNumber !== undefined ? { whatsapp_number: input.whatsappNumber } : {}),
      ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
      ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
      ...(input.isOpen !== undefined ? { is_open: input.isOpen } : {}),
      ...(input.closedMessage !== undefined ? { closed_message: input.closedMessage || null } : {}),
      ...(input.businessHours !== undefined ? { business_hours: input.businessHours } : {}),
      ...(input.payoutProvider !== undefined ? { payout_provider: input.payoutProvider } : {}),
      ...(input.payoutPhoneNumber !== undefined
        ? { payout_phone_number: input.payoutPhoneNumber || null }
        : {}),
      ...(input.facebookUrl !== undefined ? { facebook_url: input.facebookUrl || null } : {}),
      ...(input.instagramUrl !== undefined ? { instagram_url: input.instagramUrl || null } : {}),
      ...(input.tiktokUrl !== undefined ? { tiktok_url: input.tiktokUrl || null } : {}),
      ...(input.returnPolicy !== undefined ? { return_policy: input.returnPolicy || null } : {}),
    })
    .eq("id", shopId);
  if (error) throw new Error(error.message);
}

// Marks the shop as having asked a human at Buyam Sellam to review it
// for the verified badge — surfaced in the admin Sellers tab, along
// with whatever ID photo/note the seller submitted as evidence. This
// is always optional: a shop sells fine without ever calling this.
// Doesn't verify anything itself (that's still a manual admin
// decision) — it just puts the shop, and its evidence, in front of a
// human. Clears any previous rejection reason, since asking again is
// a fresh request.
export async function requestShopVerification(
  shopId: string,
  input?: { idPhotoPath?: string; note?: string }
) {
  const { error } = await supabase
    .from("shops")
    .update({
      verification_requested_at: new Date().toISOString(),
      verification_rejected_reason: null,
      ...(input?.idPhotoPath !== undefined ? { verification_id_photo_path: input.idPhotoPath } : {}),
      ...(input?.note !== undefined ? { verification_note: input.note || null } : {}),
    })
    .eq("id", shopId);
  if (error) throw new Error(error.message);
}

export async function deleteProduct(productId: string) {
  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) throw new Error(error.message);
}

// Pausing hides a listing from buyers (same effect as deleting, as far
// as the storefront is concerned) without losing it — a seller who's
// temporarily out of stock can flip it back on later instead of
// re-creating the whole listing from scratch.
export async function setProductActive(productId: string, isActive: boolean) {
  const { error } = await supabase.from("products").update({ is_active: isActive }).eq("id", productId);
  if (error) throw new Error(error.message);
}

export async function uploadShopLogo(file: File, shopId: string): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${shopId}/logo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, file, { cacheControl: "3600", upsert: true });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}

// Same bucket and pattern as the logo — just a wider image shown
// behind it on the shop's public page.
export async function uploadShopCover(file: File, shopId: string): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${shopId}/cover-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, file, { cacheControl: "3600", upsert: true });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}

// ID/business document for a verification request. The bucket is
// private, so unlike the other two upload helpers this returns the
// storage PATH, not a public URL — nothing can view it without a
// signed URL, which only the admin API generates on demand (see
// /api/admin/verification-photo).
export async function uploadVerificationDocument(file: File, shopId: string): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${shopId}/id-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("verification-documents")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export async function uploadProductImage(file: File, shopId: string): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${shopId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}

export async function getMyOrders(shopId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, shop_id, status, total_amount_fcfa, payment_provider, payment_reference, buyer_phone, delivery_name, delivery_city, delivery_neighborhood, delivery_address, delivery_notes, delivery_fee_fcfa, delivery_latitude, delivery_longitude, delivery_distance_km, delivery_zone_name, payout_sent, payout_sent_at, accepted_at, paid_at, shipped_at, completed_at, created_at, updated_at, order_items(quantity, unit_price_fcfa, product:products(id, title, image_urls))"
    )
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getMyOrders error:", error.message);
    return [];
  }
  // order_items comes back as its own array per order (a seller needed
  // an RLS policy added specifically to read it — see
  // migration_012_seller_order_items_policy.sql); product nested inside
  // each item can come back as an object or a single-item array
  // depending on how Supabase resolves the relationship, same quirk as
  // the shop join elsewhere in this file, so it's normalized the same way.
  return (data ?? []).map((row) => {
    const rawItems = (row as unknown as { order_items?: unknown }).order_items;
    const items: OrderLineItem[] = Array.isArray(rawItems)
      ? (rawItems as Array<{
          quantity: number;
          unit_price_fcfa: number;
          product:
            | { id: string; title: string; image_urls: string[] }
            | { id: string; title: string; image_urls: string[] }[]
            | null;
        }>).map((item) => ({
          quantity: item.quantity,
          unit_price_fcfa: item.unit_price_fcfa,
          product: Array.isArray(item.product) ? (item.product[0] ?? null) : item.product,
        }))
      : [];
    const { order_items: _omit, ...rest } = row as Record<string, unknown>;
    void _omit;
    return { ...rest, items } as Order;
  });
}

// Delivery zones — optional, seller-defined named delivery prices
// (e.g. "Douala centre-ville — 1500 FCFA"). A shop with none configured
// keeps using its flat/distance-based fee unchanged everywhere else in
// this file; these functions are the only thing that touches this table.
export async function getDeliveryZones(shopId: string): Promise<DeliveryZone[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("delivery_zones")
    .select("id, shop_id, name, fee_fcfa, eta_text, sort_order, created_at")
    .eq("shop_id", shopId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    console.error("getDeliveryZones error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function createDeliveryZone(input: {
  shopId: string;
  name: string;
  feeFcfa: number;
  etaText?: string;
  sortOrder?: number;
}): Promise<DeliveryZone> {
  const { data, error } = await supabase
    .from("delivery_zones")
    .insert({
      shop_id: input.shopId,
      name: input.name.trim(),
      fee_fcfa: input.feeFcfa,
      eta_text: input.etaText?.trim() || null,
      sort_order: input.sortOrder ?? 0,
    })
    .select("id, shop_id, name, fee_fcfa, eta_text, sort_order, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateDeliveryZone(
  zoneId: string,
  input: { name?: string; feeFcfa?: number; etaText?: string; sortOrder?: number }
) {
  const { error } = await supabase
    .from("delivery_zones")
    .update({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.feeFcfa !== undefined ? { fee_fcfa: input.feeFcfa } : {}),
      ...(input.etaText !== undefined ? { eta_text: input.etaText.trim() || null } : {}),
      ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
    })
    .eq("id", zoneId);
  if (error) throw new Error(error.message);
}

export async function deleteDeliveryZone(zoneId: string) {
  const { error } = await supabase.from("delivery_zones").delete().eq("id", zoneId);
  if (error) throw new Error(error.message);
}

// Seller taps "Accept order" on a freshly paid-held order — purely a
// visual "I've seen this, I'm preparing it" signal for the buyer's
// tracking page. It never changes orders.status (still paid_held), so
// it can't interfere with the payment/escrow state machine.
export async function markOrderAccepted(orderId: string) {
  const { error } = await supabase
    .from("orders")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
}

export async function markOrderShipped(orderId: string) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("orders")
    .update({ status: "shipped", shipped_at: now, updated_at: now })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
}
