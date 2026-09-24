import type { SupabaseClient } from "@supabase/supabase-js";

// Suggestions for someone listing a single item: a category guessed
// from words in the title (English, French and common Cameroonian
// terms), and a price range taken from similar items already on the
// site. Plain keyword matching — no AI — so it is fast, free and
// predictable; when there aren't enough similar items it says so
// instead of guessing a price.

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "womens-fashion": ["robe", "dress", "jupe", "skirt", "blouse", "kaba", "kabba", "pagne", "wax", "ankara", "legging", "femme", "women", "woman", "lady", "ladies", "boubou", "combinaison", "jumpsuit", "crop", "brassiere"],
  "mens-fashion": ["chemise", "shirt", "pantalon", "trouser", "trousers", "jean", "jeans", "costume", "suit", "homme", "men", "man", "tshirt", "polo", "veste", "jacket", "short", "survetement", "tracksuit", "agbada", "gandoura"],
  "shoes-accessories": ["chaussure", "chaussures", "shoe", "shoes", "basket", "baskets", "sneaker", "sneakers", "sandale", "sandales", "sandal", "sandals", "talon", "talons", "heel", "heels", "sac", "sacoche", "bag", "handbag", "montre", "watch", "ceinture", "belt", "lunette", "lunettes", "glasses", "bijou", "bijoux", "jewel", "jewellery", "jewelry", "collier", "necklace", "bracelet", "boucle", "earrings", "casquette", "cap", "chapeau", "hat", "portefeuille", "wallet"],
  "hair-wigs": ["perruque", "perruques", "wig", "wigs", "meche", "meches", "tissage", "weave", "braid", "braids", "tresse", "tresses", "hair", "cheveux", "lace", "frontal", "closure", "bundle", "bundles", "rajout", "extension"],
  "beauty-cosmetics": ["creme", "cream", "lotion", "parfum", "perfume", "maquillage", "makeup", "rouge", "lipstick", "gloss", "savon", "soap", "huile", "oil", "beaute", "beauty", "vernis", "serum", "gel", "shampoing", "shampoo", "deodorant", "fond", "foundation", "mascara", "eyeliner"],
};

export function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w.length >= 3);
}

export function guessCategorySlug(title: string): string | null {
  const words = new Set(normalizeWords(title));
  let best: { slug: string; score: number } | null = null;
  for (const [slug, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter((k) => words.has(k)).length;
    if (score > 0 && (!best || score > best.score)) best = { slug, score };
  }
  return best?.slug ?? null;
}

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo));
}

// Rounds to a price people actually use (nearest 500 FCFA, or 100 under 5,000).
const roundPrice = (n: number) => (n < 5000 ? Math.round(n / 100) * 100 : Math.round(n / 500) * 500);

export type ListingSuggestion = {
  category: { id: string; slug: string; name: string } | null;
  price: { low: number; typical: number; high: number; basedOn: number } | null;
};

export async function suggestForTitle(admin: SupabaseClient, title: string): Promise<ListingSuggestion> {
  const words = [...new Set(normalizeWords(title))].slice(0, 6);
  const { data: categories } = await admin.from("categories").select("id, slug, name");

  let categorySlug = guessCategorySlug(title);
  let price: ListingSuggestion["price"] = null;

  if (words.length > 0) {
    const { data: candidates } = await admin
      .from("products")
      .select("title, price_fcfa, sale_price_fcfa, category_id")
      .eq("is_active", true)
      .or(words.map((w) => `title.ilike.%${w}%`).join(","))
      .limit(200);

    // Keep items sharing at least half the title's words (min. 1).
    const need = Math.max(1, Math.ceil(words.length / 2));
    const similar = (candidates ?? []).filter((p) => {
      const pw = new Set(normalizeWords(p.title as string));
      return words.filter((w) => pw.has(w)).length >= need;
    });

    if (!categorySlug && similar.length > 0) {
      const counts = new Map<string, number>();
      for (const p of similar) if (p.category_id) counts.set(p.category_id as string, (counts.get(p.category_id as string) ?? 0) + 1);
      const topId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      categorySlug = categories?.find((c) => c.id === topId)?.slug ?? null;
    }

    // Only suggest a price when there are enough comparable items.
    if (similar.length >= 3) {
      const prices = similar
        .map((p) => (p.sale_price_fcfa != null && (p.sale_price_fcfa as number) < (p.price_fcfa as number) ? p.sale_price_fcfa : p.price_fcfa) as number)
        .filter((n) => n > 0)
        .sort((a, b) => a - b);
      if (prices.length >= 3) {
        price = {
          low: roundPrice(percentile(prices, 0.25)),
          typical: roundPrice(percentile(prices, 0.5)),
          high: roundPrice(percentile(prices, 0.75)),
          basedOn: prices.length,
        };
      }
    }
  }

  const category = categorySlug ? categories?.find((c) => c.slug === categorySlug) ?? null : null;
  return { category: category ? { id: category.id, slug: category.slug, name: category.name } : null, price };
}
