import { createClient } from "@supabase/supabase-js";

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
  delivery_info: string | null;
  delivery_fee_fcfa: number | null;
  delivery_eta_text: string | null;
  is_verified: boolean;
  is_active: boolean;
  verification_requested_at: string | null;
  view_count: number;
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
  > | null;
  shopRating?: number | null;
  category?: Pick<Category, "name" | "slug"> | null;
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
  payout_sent: boolean;
  payout_sent_at: string | null;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
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

export type ProductSort = "newest" | "price_asc" | "price_desc" | "rating_desc";

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
  }
): Promise<Product[]> {
  if (!isSupabaseConfigured) return [];
  let query = supabase
    .from("products")
    .select(
      "id, shop_id, category_id, title, description, brand, price_fcfa, stock_quantity, image_urls, condition, sizes, colors, is_active, shop:shops(id, shop_name, slug, city, is_verified), category:categories(name, slug)"
    )
    .eq("is_active", true);

  // "rating_desc" can't be pushed down as a DB-level order-by — rating
  // lives on the shop, aggregated from reviews, not a column on
  // products — so it's sorted client-side below instead.
  if (filters?.sort === "price_asc") {
    query = query.order("price_fcfa", { ascending: true });
  } else if (filters?.sort === "price_desc") {
    query = query.order("price_fcfa", { ascending: false });
  } else if (filters?.sort !== "rating_desc") {
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
      "id, shop_id, category_id, title, description, brand, price_fcfa, stock_quantity, image_urls, condition, sizes, colors, is_active, shop:shops(id, shop_name, slug, city, whatsapp_number, is_verified, delivery_info, delivery_fee_fcfa, delivery_eta_text), category:categories(name, slug)"
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
      "id, order_id, shop_id, buyer_id, buyer_phone, rating, product_rating, seller_rating, delivery_rating, comment, created_at"
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

export async function getShopProducts(shopId: string): Promise<Product[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, shop_id, category_id, title, description, price_fcfa, stock_quantity, image_urls, condition, sizes, colors, is_active, category:categories(name, slug)"
    )
    .eq("shop_id", shopId)
    .eq("is_active", true)
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
    whatsappNumber?: string;
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
      ...(input.whatsappNumber !== undefined ? { whatsapp_number: input.whatsappNumber } : {}),
    })
    .eq("id", shopId);
  if (error) throw new Error(error.message);
}

// Marks the shop as having asked a human at Buyam Sellam to review it
// for the verified badge — surfaced in the admin Sellers tab. Doesn't
// verify anything itself (that's still a manual admin decision), it
// just puts the shop on the list to look at.
export async function requestShopVerification(shopId: string) {
  const { error } = await supabase
    .from("shops")
    .update({ verification_requested_at: new Date().toISOString() })
    .eq("id", shopId);
  if (error) throw new Error(error.message);
}

export async function deleteProduct(productId: string) {
  const { error } = await supabase.from("products").delete().eq("id", productId);
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
      "id, shop_id, status, total_amount_fcfa, payment_provider, payment_reference, buyer_phone, delivery_name, delivery_city, delivery_neighborhood, delivery_address, delivery_notes, payout_sent, payout_sent_at, accepted_at, created_at, updated_at"
    )
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getMyOrders error:", error.message);
    return [];
  }
  return data ?? [];
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
  const { error } = await supabase
    .from("orders")
    .update({ status: "shipped", updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
}
