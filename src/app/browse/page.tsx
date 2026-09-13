import Link from "next/link";
import { categories, products, formatFcfa } from "@/lib/mock-data";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const filtered = category
    ? products.filter((p) => p.category === category)
    : products;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Browse Douala shops</h1>
      <p className="text-neutral-500 text-sm mb-6">
        {filtered.length} item{filtered.length === 1 ? "" : "s"}
        {category ? ` in ${category}` : ""}
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
            key={c}
            href={`/browse?category=${encodeURIComponent(c)}`}
            className={`text-sm rounded-full px-4 py-1.5 border ${
              category === c
                ? "bg-neutral-900 text-white border-neutral-900"
                : "border-neutral-300 hover:border-neutral-900"
            }`}
          >
            {c}
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
            <div className="aspect-square bg-neutral-100 flex items-center justify-center text-5xl">
              {p.imageEmoji}
            </div>
            <div className="p-3">
              <p className="text-sm font-medium line-clamp-1">{p.title}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{p.shopName}</p>
              <p className="text-sm font-semibold mt-1">
                {formatFcfa(p.priceFcfa)}
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
