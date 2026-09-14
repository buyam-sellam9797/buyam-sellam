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
  is_verified: boolean;
  is_active: boolean;
};

export type ProductCondition = "new" | "like_new" | "used";

export type Product = {
  id: string;
  shop_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  price_fcfa: number;
  stock_quantity: number;
  image_urls: string[];
  condition: ProductCondition;
  sizes: string[];
  colors: string[];
  is_active: boolean;
  shop?: Pick<Shop, "id" | "shop_name" | "slug" | "city" | "whatsapp_number" | "is_verified"> | null;
  category?: Pick<Category, "name" | "slug"> | null;
};

export type Review = {
  id: string;
  order_id: string;
  shop_id: string;
  buyer_id: string | null;
  buyer_phone: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type ShopRatingSummary = { average: number; count: number };

export type Order = {
  id: string;
  shop_id: string;
  status: string;
  total_amount_fcfa: number;
  payment_provider: string | null;
  payment_reference: string | null;
  buyer_phone: string | null;
  payout_sent: boolean;
  payout_sent_at: string | null;
  created_at: string;
};

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

export async function getActiveProducts(
  categorySlug?: string,
  filters?: { q?: string; minPrice?: number; maxPrice?: number }
): Promise<Product[]> {
  if (!isSupabaseConfigured) return [];
  let query = supabase
    .from("products")
    .select(
      "id, shop_id, category_id, title, description, price_fcfa, stock_quantity, image_urls, condition, sizes, colors, is_active, shop:shops(id, shop_name, slug, city, is_verified), category:categories(name, slug)"
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false });

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

  const { data, error } = await query;
  if (error) {
    console.error("getActiveProducts error:", error.message);
    return [];
  }
  // Supabase's embedded filter syntax above can be unreliable across
  // versions, so filter defensively here too when a category was requested.
  const rows = (data ?? []) as unknown as Product[];
  if (categorySlug) {
    return rows.filter((p) => p.category?.slug === categorySlug);
  }
  return rows;
}

export async function getProductById(id: string): Promise<Product | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, shop_id, category_id, title, description, price_fcfa, stock_quantity, image_urls, condition, sizes, colors, is_active, shop:shops(id, shop_name, slug, city, whatsapp_number, is_verified), category:categories(name, slug)"
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

// Average + count of a shop's reviews, for the trust badges shown on
// product and shop pages ("⭐ 4.8 · 12 reviews"). Computed client-side
// from the raw ratings rather than a DB aggregate — review volume per
// shop is small enough that this is simpler than adding a view/RPC.
export async function getShopRatingSummary(shopId: string): Promise<ShopRatingSummary> {
  if (!isSupabaseConfigured) return { average: 0, count: 0 };
  const { data, error } = await supabase
    .from("reviews")
    .select("rating")
    .eq("shop_id", shopId);
  if (error || !data || data.length === 0) return { average: 0, count: 0 };
  const sum = data.reduce((s, r) => s + r.rating, 0);
  return { average: sum / data.length, count: data.length };
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

export async function deleteProduct(productId: string) {
  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) throw new Error(error.message);
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
      "id, shop_id, status, total_amount_fcfa, payment_provider, payment_reference, buyer_phone, payout_sent, payout_sent_at, created_at"
    )
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getMyOrders error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function markOrderShipped(orderId: string) {
  const { error } = await supabase
    .from("orders")
    .update({ status: "shipped", updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
}
