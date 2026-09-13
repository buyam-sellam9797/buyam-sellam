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

export type Product = {
  id: string;
  shop_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  price_fcfa: number;
  stock_quantity: number;
  image_urls: string[];
  is_active: boolean;
  shop?: Pick<Shop, "shop_name" | "slug" | "city"> | null;
  category?: Pick<Category, "name" | "slug"> | null;
};

export type Order = {
  id: string;
  shop_id: string;
  status: string;
  total_amount_fcfa: number;
  payment_provider: string | null;
  payment_reference: string | null;
  buyer_phone: string | null;
  created_at: string;
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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

export async function getActiveProducts(categorySlug?: string): Promise<Product[]> {
  if (!isSupabaseConfigured) return [];
  let query = supabase
    .from("products")
    .select(
      "id, shop_id, category_id, title, description, price_fcfa, stock_quantity, image_urls, is_active, shop:shops(shop_name, slug, city), category:categories(name, slug)"
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (categorySlug) {
    query = query.eq("category.slug", categorySlug);
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
      "id, shop_id, category_id, title, description, price_fcfa, stock_quantity, image_urls, is_active, shop:shops(shop_name, slug, city), category:categories(name, slug)"
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
      "id, shop_id, category_id, title, description, price_fcfa, stock_quantity, image_urls, is_active, category:categories(name, slug)"
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
}) {
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
  });
  if (signUpError) throw new Error(signUpError.message);
  const user = signUpData.user;
  if (!user) {
    throw new Error(
      "Account created — check your email to confirm it, then log in."
    );
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    role: "seller",
    full_name: input.fullName,
    phone_number: input.whatsappNumber,
    city: input.city,
  });
  if (profileError) throw new Error(profileError.message);

  const baseSlug = slugify(input.shopName) || "shop";
  let slug = baseSlug;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error: shopError } = await supabase.from("shops").insert({
      owner_id: user.id,
      shop_name: input.shopName,
      slug,
      description: input.description || null,
      whatsapp_number: input.whatsappNumber,
      city: input.city,
    });
    if (!shopError) return { userId: user.id, slug };
    // 23505 = unique_violation (slug already taken) — try a suffixed slug.
    if (shopError.code === "23505") {
      slug = `${baseSlug}-${Math.floor(Math.random() * 1000)}`;
      continue;
    }
    throw new Error(shopError.message);
  }
  throw new Error("Could not create your shop — please try again.");
}

export async function createProduct(input: {
  shopId: string;
  categoryId: string | null;
  title: string;
  description: string;
  priceFcfa: number;
  stockQuantity: number;
  imageUrls: string[];
}) {
  const { error } = await supabase.from("products").insert({
    shop_id: input.shopId,
    category_id: input.categoryId,
    title: input.title,
    description: input.description || null,
    price_fcfa: input.priceFcfa,
    stock_quantity: input.stockQuantity,
    image_urls: input.imageUrls,
  });
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
    .select("id, shop_id, status, total_amount_fcfa, payment_provider, payment_reference, buyer_phone, created_at")
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
