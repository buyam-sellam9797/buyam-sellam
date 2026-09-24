import { supabase, isSupabaseConfigured, PRODUCT_CARD_SELECT, type Product, type Shop } from "@/lib/supabase";
import { normalizeCondition } from "@/lib/conditions";

// Everything the homepage shelves need, from one product query plus two
// small popularity lookups. A shelf with fewer than MIN_SHELF items is
// left out rather than shown half-empty.
export const MIN_SHELF = 3;
const SHELF_SIZE = 10;
export const BUDGET_PRICE = 5000;

export type ShelfShop = Pick<
  Shop,
  "id" | "shop_name" | "slug" | "city" | "logo_url" | "cover_url" | "is_verified" | "description"
> &
  Partial<Pick<Shop, "signature_status" | "signature_kind" | "signature_founder" | "signature_founded_year" | "made_in_cameroon" | "signature_story">>;

export type HomeShelves = {
  justListed: Product[];
  trending: Product[];
  underBudget: Product[];
  newWithTags: Product[];
  openToOffers: Product[];
  onSale: Product[];
  signatureShops: ShelfShop[];
  popularShops: ShelfShop[];
};

const SHOP_CARD_SELECT =
  "id, shop_name, slug, city, logo_url, cover_url, is_verified, description, signature_status, signature_kind, signature_founder, signature_founded_year, made_in_cameroon, signature_story";

const price = (p: Product) => p.sale_price_fcfa ?? p.price_fcfa;

export async function getHomeShelves(): Promise<HomeShelves> {
  const empty: HomeShelves = {
    justListed: [],
    trending: [],
    underBudget: [],
    newWithTags: [],
    openToOffers: [],
    onSale: [],
    signatureShops: [],
    popularShops: [],
  };
  if (!isSupabaseConfigured) return empty;

  const [{ data: productRows }, { data: trendRows }, { data: signatureRows }, { data: shopScoreRows }] = await Promise.all([
    supabase
      .from("products")
      .select(PRODUCT_CARD_SELECT)
      .eq("is_active", true)
      .gt("stock_quantity", 0)
      .order("created_at", { ascending: false })
      .limit(240),
    supabase.rpc("product_popularity", { p_days: 7, p_limit: 30 }),
    supabase.from("shops").select(SHOP_CARD_SELECT).eq("is_active", true).eq("signature_status", "approved").limit(12),
    supabase.rpc("shop_popularity", { p_days: 30, p_limit: 12 }),
  ]);

  const products = (productRows ?? []) as unknown as Product[];
  const byId = new Map(products.map((p) => [p.id, p]));
  const pick = (list: Product[]) => (list.length >= MIN_SHELF ? list.slice(0, SHELF_SIZE) : []);

  const trending = ((trendRows ?? []) as { product_id: string }[])
    .map((r) => byId.get(r.product_id))
    .filter((p): p is Product => Boolean(p));

  let popularShops: ShelfShop[] = [];
  const shopIds = ((shopScoreRows ?? []) as { shop_id: string }[]).map((r) => r.shop_id);
  if (shopIds.length >= MIN_SHELF) {
    const { data } = await supabase.from("shops").select(SHOP_CARD_SELECT).in("id", shopIds);
    const rows = (data ?? []) as ShelfShop[];
    popularShops = shopIds.map((id) => rows.find((s) => s.id === id)).filter((s): s is ShelfShop => Boolean(s));
  }

  return {
    justListed: pick(products),
    trending: pick(trending),
    underBudget: pick(products.filter((p) => price(p) <= BUDGET_PRICE).sort((a, b) => price(a) - price(b))),
    newWithTags: pick(products.filter((p) => normalizeCondition(p.condition) === "new_with_tags")),
    openToOffers: pick(products.filter((p) => p.accepts_offers)),
    onSale: pick(products.filter((p) => p.sale_price_fcfa != null && p.sale_price_fcfa < p.price_fcfa)),
    signatureShops: (signatureRows ?? []) as ShelfShop[],
    popularShops: popularShops.length >= MIN_SHELF ? popularShops : [],
  };
}
