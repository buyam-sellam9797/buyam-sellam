import Link from "next/link";
import { notFound } from "next/navigation";
import { products, formatFcfa } from "@/lib/mock-data";

export default async function ShopPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const shopProducts = products.filter((p) => p.shopSlug === slug);
  if (shopProducts.length === 0) notFound();

  const shopName = shopProducts[0].shopName;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="rounded-xl bg-white border border-neutral-200 p-6 mb-8 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-2xl font-bold text-amber-700">
          {shopName.charAt(0)}
        </div>
        <div>
          <h1 className="text-xl font-bold">{shopName}</h1>
          <p className="text-sm text-neutral-500">Douala &middot; Buyam Sellam verified shop</p>
        </div>
      </div>

      <h2 className="text-sm font-semibold text-neutral-500 mb-3">
        {shopProducts.length} listing{shopProducts.length === 1 ? "" : "s"}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {shopProducts.map((p) => (
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
              <p className="text-sm font-semibold mt-1">
                {formatFcfa(p.priceFcfa)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
