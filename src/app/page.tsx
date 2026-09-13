import Link from "next/link";
import { categories, products, formatFcfa } from "@/lib/mock-data";

export default function Home() {
  const featured = products.slice(0, 4);

  return (
    <div>
      <section className="bg-neutral-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 flex flex-col gap-4">
          <h1 className="text-3xl sm:text-4xl font-bold max-w-xl">
            Real Douala sellers. Real fashion &amp; beauty. Pay safely by
            mobile money.
          </h1>
          <p className="text-neutral-300 max-w-lg">
            Your payment is held until you confirm you received your order —
            so you can shop with sellers you don&apos;t know yet, safely.
          </p>
          <div className="flex flex-wrap gap-3 mt-2">
            <Link
              href="/browse"
              className="rounded-full bg-amber-500 text-neutral-900 font-semibold px-6 py-2.5 hover:bg-amber-400"
            >
              Browse products
            </Link>
            <Link
              href="/sell"
              className="rounded-full border border-white/40 px-6 py-2.5 hover:bg-white/10"
            >
              Open your shop, it&apos;s free
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-lg font-semibold mb-4">Shop by category</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {categories.map((c) => (
            <Link
              key={c}
              href={`/browse?category=${encodeURIComponent(c)}`}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-6 text-center text-sm font-medium hover:border-amber-500 hover:text-amber-600 transition"
            >
              {c}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-lg font-semibold">Just listed</h2>
          <Link href="/browse" className="text-sm text-amber-600 hover:underline">
            See all
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {featured.map((p) => (
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
        </div>
      </section>

      <section className="bg-white border-t border-neutral-200">
        <div className="mx-auto max-w-6xl px-4 py-12 grid sm:grid-cols-3 gap-8 text-sm">
          <div>
            <p className="font-semibold mb-1">1. Pick a real seller</p>
            <p className="text-neutral-500">
              Verified shops from sellers around Douala — fashion, beauty,
              and accessories.
            </p>
          </div>
          <div>
            <p className="font-semibold mb-1">2. Pay by mobile money</p>
            <p className="text-neutral-500">
              MTN Mobile Money or Orange Money. Your payment is held by
              Buyam Sellam, not sent straight to the seller.
            </p>
          </div>
          <div>
            <p className="font-semibold mb-1">3. Confirm and release</p>
            <p className="text-neutral-500">
              Only once you confirm you received your order does the
              seller get paid.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
