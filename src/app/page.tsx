import Link from "next/link";
import { getCategories, getActiveProducts } from "@/lib/supabase";
import { formatFcfa } from "@/lib/format";
import { getLocale } from "@/lib/get-locale";
import { getDictionary } from "@/lib/i18n";

// This page lists live products/categories from Supabase — never cache
// it statically, or new sellers/listings wouldn't show up until the
// next deploy.
export const dynamic = "force-dynamic";

export default async function Home() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const [categories, products] = await Promise.all([
    getCategories(),
    getActiveProducts(),
  ]);
  const featured = products.slice(0, 4);

  return (
    <div>
      <section className="bg-neutral-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 flex flex-col gap-4">
          <h1 className="text-3xl sm:text-4xl font-bold max-w-xl">
            {t.home.heroTitle}
          </h1>
          <p className="text-neutral-300 max-w-lg">{t.home.heroSubtitle}</p>
          <div className="flex flex-wrap gap-3 mt-2">
            <Link
              href="/browse"
              className="rounded-full bg-amber-500 text-neutral-900 font-semibold px-6 py-2.5 hover:bg-amber-400"
            >
              {t.home.browseCta}
            </Link>
            <Link
              href="/sell"
              className="rounded-full border border-white/40 px-6 py-2.5 hover:bg-white/10"
            >
              {t.home.openShopCta}
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-lg font-semibold mb-4">{t.home.shopByCategory}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/browse?category=${encodeURIComponent(c.slug)}`}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-6 text-center text-sm font-medium hover:border-amber-500 hover:text-amber-600 transition"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-lg font-semibold">{t.home.justListed}</h2>
          <Link href="/browse" className="text-sm text-amber-600 hover:underline">
            {t.home.seeAll}
          </Link>
        </div>
        {featured.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">
            {t.home.noProductsYet}{" "}
            <Link href="/sell" className="text-amber-600 hover:underline">
              {t.home.beFirstToOpenShop}
            </Link>
            .
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {featured.map((p) => (
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
          </div>
        )}
      </section>

      <section className="bg-white border-t border-neutral-200">
        <div className="mx-auto max-w-6xl px-4 py-12 grid sm:grid-cols-3 gap-8 text-sm">
          <div>
            <p className="font-semibold mb-1">{t.home.how1Title}</p>
            <p className="text-neutral-500">{t.home.how1Body}</p>
          </div>
          <div>
            <p className="font-semibold mb-1">{t.home.how2Title}</p>
            <p className="text-neutral-500">{t.home.how2Body}</p>
          </div>
          <div>
            <p className="font-semibold mb-1">{t.home.how3Title}</p>
            <p className="text-neutral-500">{t.home.how3Body}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
