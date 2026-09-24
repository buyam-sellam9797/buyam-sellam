import Link from "next/link";
import { getCategories, getHomeStats } from "@/lib/supabase";
import { getHomeShelves, BUDGET_PRICE } from "@/lib/home-shelves";
import { formatFcfa } from "@/lib/format";
import { getLocale } from "@/lib/get-locale";
import { getDictionary, plural } from "@/lib/i18n";
import { IconStar, IconCard, IconLock, IconTrendingUp, IconHandshake, IconTag, IconSeal, IconHeart } from "@/components/dash-icons";
import { Shelf, ShelfItem } from "@/components/shelf";
import { ProductCard } from "@/components/product-card";
import { ShopCard } from "@/components/shop-card";

const BUDGETS = [2000, 5000, 10000, 25000];

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
  const [categories, shelves, stats] = await Promise.all([getCategories(), getHomeShelves(), getHomeStats()]);
  const cardSizes = "(max-width: 640px) 44vw, 20vw";

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
              href={`/category/${c.slug}`}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-6 text-center text-sm font-medium hover:border-amber-500 hover:text-amber-600 transition"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-2">
        <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">{t.shelves.budgetTitle}</p>
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4 sm:mx-0 sm:px-0">
          {BUDGETS.map((b) => (
            <Link
              key={b}
              href={`/browse?maxPrice=${b}&sort=price_asc`}
              className="shrink-0 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold hover:border-neutral-900"
            >
              {t.shelves.underPrice.replace("{price}", formatFcfa(b))}
            </Link>
          ))}
          <Link
            href="/browse?offers=1"
            className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:border-amber-600 inline-flex items-center gap-1.5"
          >
            <IconHandshake className="w-4 h-4" /> {t.offers.openToOffers}
          </Link>
        </div>
      </section>

      {shelves.trending.length > 0 && (
        <Shelf
          title={t.shelves.trendingTitle}
          subtitle={t.shelves.trendingSubtitle}
          href="/browse?sort=popular"
          seeAll={t.home.seeAll}
          icon={<IconTrendingUp className="w-5 h-5 text-amber-600" />}
        >
          {shelves.trending.map((p) => (
            <ShelfItem key={p.id}>
              <ProductCard product={p} t={t} compact sizes={cardSizes} />
            </ShelfItem>
          ))}
        </Shelf>
      )}

      {shelves.justListed.length > 0 ? (
        <Shelf title={t.home.justListed} subtitle={t.shelves.justListedSubtitle} href="/browse" seeAll={t.home.seeAll} rows={2}>
          {shelves.justListed.map((p) => (
            <ShelfItem key={p.id}>
              <ProductCard product={p} t={t} compact sizes={cardSizes} />
            </ShelfItem>
          ))}
        </Shelf>
      ) : (
        <section className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">
            {t.home.noProductsYet}{" "}
            <Link href="/sell" className="text-amber-600 hover:underline">
              {t.home.beFirstToOpenShop}
            </Link>
            .
          </div>
        </section>
      )}

      {shelves.signatureShops.length > 0 && (
        <Shelf
          tone="dark"
          title={t.signature.shelfTitle}
          subtitle={t.signature.shelfSubtitle}
          href="/signature"
          seeAll={t.home.seeAll}
          icon={<IconSeal className="w-5 h-5 text-amber-300" />}
        >
          {shelves.signatureShops.map((shop) => (
            <ShelfItem key={shop.id}>
              <ShopCard shop={shop} t={t} tone="dark" />
            </ShelfItem>
          ))}
        </Shelf>
      )}

      {shelves.underBudget.length > 0 && (
        <Shelf
          title={t.shelves.underPrice.replace("{price}", formatFcfa(BUDGET_PRICE))}
          subtitle={t.shelves.underBudgetSubtitle}
          href={`/browse?maxPrice=${BUDGET_PRICE}&sort=price_asc`}
          seeAll={t.home.seeAll}
        >
          {shelves.underBudget.map((p) => (
            <ShelfItem key={p.id}>
              <ProductCard product={p} t={t} compact sizes={cardSizes} />
            </ShelfItem>
          ))}
        </Shelf>
      )}

      {shelves.openToOffers.length > 0 && (
        <Shelf
          title={t.shelves.offersTitle}
          subtitle={t.shelves.offersSubtitle}
          href="/browse?offers=1"
          seeAll={t.home.seeAll}
          icon={<IconHandshake className="w-5 h-5 text-amber-600" />}
        >
          {shelves.openToOffers.map((p) => (
            <ShelfItem key={p.id}>
              <ProductCard product={p} t={t} compact sizes={cardSizes} />
            </ShelfItem>
          ))}
        </Shelf>
      )}

      {shelves.newWithTags.length > 0 && (
        <Shelf
          title={t.conditions.grades.new_with_tags}
          subtitle={t.shelves.newWithTagsSubtitle}
          href="/browse?condition=new_with_tags"
          seeAll={t.home.seeAll}
          icon={<IconTag className="w-5 h-5 text-amber-600" />}
        >
          {shelves.newWithTags.map((p) => (
            <ShelfItem key={p.id}>
              <ProductCard product={p} t={t} compact sizes={cardSizes} />
            </ShelfItem>
          ))}
        </Shelf>
      )}

      {shelves.onSale.length > 0 && (
        <Shelf title={t.shelves.onSaleTitle} subtitle={t.shelves.onSaleSubtitle} href="/browse?sale=1" seeAll={t.home.seeAll}>
          {shelves.onSale.map((p) => (
            <ShelfItem key={p.id}>
              <ProductCard product={p} t={t} compact sizes={cardSizes} />
            </ShelfItem>
          ))}
        </Shelf>
      )}

      {shelves.popularShops.length > 0 && (
        <Shelf
          title={t.shelves.popularShopsTitle}
          subtitle={t.shelves.popularShopsSubtitle}
          href="/signature#loved"
          seeAll={t.home.seeAll}
          icon={<IconHeart className="w-5 h-5 text-amber-600" />}
        >
          {shelves.popularShops.map((shop) => (
            <ShelfItem key={shop.id}>
              <ShopCard shop={shop} t={t} />
            </ShelfItem>
          ))}
        </Shelf>
      )}

      <div className="pb-8" />

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
