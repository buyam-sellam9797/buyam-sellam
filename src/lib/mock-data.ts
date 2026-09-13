// Placeholder catalog so every page renders something real-looking
// before the Supabase project is connected. Swap for live queries later.

export type Product = {
  id: string;
  title: string;
  priceFcfa: number;
  shopName: string;
  shopSlug: string;
  category: string;
  imageEmoji: string; // stand-in for a real product photo
};

export const categories = [
  "Women's Fashion",
  "Men's Fashion",
  "Shoes & Accessories",
  "Beauty & Cosmetics",
  "Hair & Wigs",
];

export const products: Product[] = [
  {
    id: "1",
    title: "Ankara Print Wrap Dress",
    priceFcfa: 15000,
    shopName: "Mama Clara Fashion",
    shopSlug: "mama-clara-fashion",
    category: "Women's Fashion",
    imageEmoji: "👗",
  },
  {
    id: "2",
    title: "Men's Slim Fit Kaba Set",
    priceFcfa: 22000,
    shopName: "Douala Threads",
    shopSlug: "douala-threads",
    category: "Men's Fashion",
    imageEmoji: "🧥",
  },
  {
    id: "3",
    title: "Handmade Leather Sandals",
    priceFcfa: 9000,
    shopName: "Akwa Shoe Corner",
    shopSlug: "akwa-shoe-corner",
    category: "Shoes & Accessories",
    imageEmoji: "👡",
  },
  {
    id: "4",
    title: "Shea Butter & Black Soap Set",
    priceFcfa: 5000,
    shopName: "Naturelle Beauty",
    shopSlug: "naturelle-beauty",
    category: "Beauty & Cosmetics",
    imageEmoji: "🧴",
  },
  {
    id: "5",
    title: "Human Hair Bundle Wig",
    priceFcfa: 45000,
    shopName: "Bonaberi Hair Studio",
    shopSlug: "bonaberi-hair-studio",
    category: "Hair & Wigs",
    imageEmoji: "💇🏾‍♀️",
  },
  {
    id: "6",
    title: "Beaded Statement Necklace",
    priceFcfa: 7000,
    shopName: "Mama Clara Fashion",
    shopSlug: "mama-clara-fashion",
    category: "Shoes & Accessories",
    imageEmoji: "📿",
  },
];

export function formatFcfa(amount: number) {
  return new Intl.NumberFormat("fr-CM", {
    style: "currency",
    currency: "XAF",
    maximumFractionDigits: 0,
  }).format(amount);
}
