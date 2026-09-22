import Link from "next/link";
import Image from "next/image";
import { getCategories, getActiveProducts, getHomeStats } from "@/lib/supabase";
import { formatFcfa } from "@/lib/format";
import { getLocale } from "@/lib/get-locale";
import { getDictionary, plural } from "@/lib/i18n";
import { IconStar, IconCard, IconLock, IconBag, StatusDot } from "@/components/dash-icons";

// This page lists live products/categories from Supabase — never cache
// it statically, or new sellers/listings wouldn't show up until the
// next deploy.
export const dynamic = "force-dynamic";

// The stats strip only ever shows real counts (see getHomeStats) — and
// only once there's actually something worth bragging about. A "0
// orders completed" badge would undercut trust rather than build it,
// so each figure has its own small threshold before it's shown, and
// the whole strip disappears if nothing clears it yet.
const MIN_PRODUCTS_TO_SHOW = 5;
const MIN_SELLERS_TO_SHOW = 3;
const MIN_ORDERS_TO_SHOW = 10;
const MIN_REVIEWS_TO_SHOW = 5;

export default async function Home() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const [categories, products, stats] = await Promise.all([
    getCategories(),
    getActiveProducts(),
    getHomeStats(),
  ]);
  const featured = products.slice(0, 4);

  const statItems = [
    stats.productCount >= MIN_PRODUCTS_TO_SHOW && {
      value: `${stats.productCount}+`,
      label: plural(stats.productCount, locale, t.home.statsProductsOne, t.home.statsProductsOther),
    },
    stats.verifiedShopCount >= MIN_SELLERS_TO_SHOW && {
      value: `${stats.verifiedShopCount}+`,
      label: plural(stats.verifiedShopCount, locale, t.home.statsSellersOne, t.home.statsSellersOther),
    },
    stats.completedOrderCount >= MIN_ORDERS_TO_SHOW && {
      value: `${stats.completedOrderCount}+`,
      label: plural(stats.completedOrderCount, locale, t.home.statsOrdersOne, t.home.statsOrdersOther),
    },
    stats.reviewCount >= MIN_REVIEWS_TO_SHOW && {
      value: `${stats.averageRating.toFixed(1)}/5`,
      label: t.home.statsRating,
      icon: true,
    },
  ].filter(Boolean) as { value: string; label: string; icon?: boolean }[];

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
          <div className="mt-6 pt-6 border-t border-white/10 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
            <span className="font-semibold inline-flex items-center gap-1.5">
              <IconLock className="w-4 h-4" /> {t.home.trustStripTitle}
            </span>
            <span className="text-neutral-300">{t.home.trustStripSteps}</span>
          </div>

          {statItems.length > 0 && (
            <div className="mt-2 pt-6 border-t border-white/10 grid grid-cols-2 sm:flex sm:flex-wrap gap-x-8 gap-y-4">
              {statItems.map((item, i) => (
                <div key={i}>
                  <p className="text-xl font-bold flex items-center gap-1">
                    {item.icon && <IconStar filled className="w-4 h-4 text-amber-400" />}
                    {item.value}
                  </p>
                  <p className="text-xs text-neutral-400">{item.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="bg-amber-50 border-b border-amber-100">
        <div className="mx-auto max-w-6xl px-4 py-5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
          <p className="text-xs font-bold tracking-wide text-amber-800">
            {t.home.payYourWayTitle}
          </p>
          <div className="flex items-center gap-3 text-sm font-semibold text-neutral-800">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-amber-200 px-3 py-1">
              <IconCard className="w-3.5 h-3.5" /> MTN MoMo
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-amber-200 px-3 py-1">
              <IconCard className="w-3.5 h-3.5" /> Orange Money
            </span>
          </div>
          <p className="text-xs text-amber-800 sm:ml-auto inline-flex items-center gap-1">
            <IconLock className="w-3.5 h-3.5" /> {t.home.payYourWayNote}
          </p>
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
                <div className="relative aspect-square bg-neutral-100 flex items-center justify-center overflow-hidden">
                  {p.image_urls?.[0] ? (
                    <Image
                      src={p.image_urls[0]}
                      alt={p.title}
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-cover"
                    />
                  ) : (
                    <IconBag className="w-10 h-10 text-neutral-300" />
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium line-clamp-1">{p.title}</p>
                  <p className="text-xs text-neutral-500 mt-0.5 flex items-center gap-1">
                    {p.shop?.shop_name}
                    {p.shop?.is_verified && <StatusDot tone="success" className="inline-block w-1.5 h-1.5 rounded-full shrink-0" />}
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
