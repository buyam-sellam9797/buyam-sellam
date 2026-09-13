import Link from "next/link";
import { getCategories, getActiveProducts } from "@/lib/supabase";
import { formatFcfa } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const [categories, filtered] = await Promise.all([
    getCategories(),
    getActiveProducts(category),
  ]);
  const activeCategory = categories.find((c) => c.slug === category);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Browse Douala shops</h1>
      <p className="text-neutral-500 text-sm mb-6">
        {filtered.length} item{filtered.length === 1 ? "" : "s"}
        {activeCategory ? ` in ${activeCategory.name}` : ""}
      </p>

      <div className="flex flex-wrap gap-2 mb-8">
        <Link
          href="/browse"
          className={`text-sm rounded-full px-4 py-1.5 border ${
            !category
              ? "bg-neutral-900 text-white border-neutral-900"
              : "border-neutral-300 hover:border-neutral-900"
          }`}
        >
          All
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/browse?category=${encodeURIComponent(c.slug)}`}
            className={`text-sm rounded-full px-4 py-1.5 border ${
              category === c.slug
                ? "bg-neutral-900 text-white border-neutral-900"
                : "border-neutral-300 hover:border-neutral-900"
            }`}
          >
            {c.name}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {filtered.map((p) => (
          <Link
            key={p.id}
            href={`/product/${p.id}`}
            className="rounded-xl border border-neutral-200 bg-white overflow-hidden hover:shadow-md transition"
          >
            <div className="aspect-square bg-neutral-100 flex items-center justify-center overflow-hidden">
              {p.image_urls?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image_urls[0]}
                  alt={p.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-5xl">🛍️</span>
              )}
            </div>
            <div className="p-3">
              <p className="text-sm font-medium line-clamp-1">{p.title}</p>
              <p className="text-xs text-neutral-500 mt-0.5">
                {p.shop?.shop_name}
              </p>
              <p className="text-sm font-semibold mt-1">
                {formatFcfa(p.price_fcfa)}
              </p>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="text-neutral-500 text-sm col-span-full py-12 text-center">
            No listings in this category yet.
          </p>
        )}
      </div>
    </div>
  );
}
