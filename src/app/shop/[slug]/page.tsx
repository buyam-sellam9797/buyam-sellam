import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getShopBySlug, getShopProducts, getShopRatingSummary, getShopReviews } from "@/lib/supabase";
import { incrementShopViews } from "@/lib/supabase-admin";
import { formatFcfa } from "@/lib/format";
import { getLocale } from "@/lib/get-locale";
import { getDictionary, plural } from "@/lib/i18n";
import { getSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

// Same reasoning as the product page's generateMetadata: without this,
// every shop's storefront shared the homepage's generic title, so a
// shop owner sharing their own page on WhatsApp had nothing that told
// people whose shop it was.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const shop = await getShopBySlug(slug);
  if (!shop) return {};

  const title = `${shop.shop_name} — ${shop.city} | Buyam Sellam`;
  const description =
    shop.description?.trim() ||
    `${shop.shop_name}'s shop on Buyam Sellam, based in ${shop.city}. Pay by MTN MoMo or Orange Money, held safely until you confirm delivery.`;
  const url = `${getSiteUrl()}/shop/${shop.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      images: shop.logo_url ? [{ url: shop.logo_url }] : undefined,
    },
    twitter: {
      card: shop.logo_url ? "summary_large_image" : "summary",
      title,
      description,
      images: shop.logo_url ? [shop.logo_url] : undefined,
    },
  };
}

export default async function ShopPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { slug } = await params;
  const shop = await getShopBySlug(slug);
  if (!shop) notFound();

  // Fire-and-forget: a storefront visit is worth counting for the
  // seller's dashboard, but should never slow down or break the page
  // if the write fails for any reason.
  incrementShopViews(shop.id).catch(() => {});

  const [shopProducts, rating, reviews] = await Promise.all([
    getShopProducts(shop.id),
    getShopRatingSummary(shop.id),
    getShopReviews(shop.id),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="rounded-xl bg-white border border-neutral-200 p-6 mb-8 flex items-center gap-4">
        <div className="relative w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-2xl font-bold text-amber-700 overflow-hidden">
          {shop.logo_url ? (
            <Image src={shop.logo_url} alt={shop.shop_name} fill sizes="64px" className="object-cover" />
          ) : (
            shop.shop_name.charAt(0)
          )}
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">{shop.shop_name}</h1>
            {shop.is_verified && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
                🛡️ {t.shop.verified}
              </span>
            )}
          </div>
          <p className="text-sm text-neutral-500 mt-1">📍 {shop.city}</p>
          <p className="text-sm text-neutral-500 mt-0.5">
            {rating.count > 0
              ? `⭐ ${rating.average.toFixed(1)} · ${rating.count} ${plural(
                  rating.count,
                  locale,
                  t.product.reviewOne,
                  t.product.reviewOther
                )}`
              : t.product.newSeller}
            {rating.completedOrders > 0 &&
              ` · ${rating.completedOrders} ${plural(
                rating.completedOrders,
                locale,
                t.product.orderOne,
                t.product.orderOther
              )}`}
          </p>
        </div>
      </div>

      {!shop.is_open && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm mb-6">
          🔴 {shop.closed_message || t.shop.temporarilyClosed}
        </div>
      )}

      {shop.description && (
        <p className="text-sm text-neutral-600 mb-4 -mt-4">{shop.description}</p>
      )}

      {(shop.facebook_url || shop.instagram_url || shop.tiktok_url) && (
        <div className="flex items-center gap-4 mb-8 text-sm">
          {shop.facebook_url && (
            <a href={shop.facebook_url} target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-neutral-900 underline underline-offset-2">
              Facebook
            </a>
          )}
          {shop.instagram_url && (
            <a href={shop.instagram_url} target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-neutral-900 underline underline-offset-2">
              Instagram
            </a>
          )}
          {shop.tiktok_url && (
            <a href={shop.tiktok_url} target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-neutral-900 underline underline-offset-2">
              TikTok
            </a>
          )}
        </div>
      )}

      {shop.return_policy && (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600 mb-8">
          <p className="font-semibold text-neutral-800 mb-1">{t.shop.returnPolicyTitle}</p>
          <p className="whitespace-pre-line">{shop.return_policy}</p>
        </div>
      )}

      <h2 className="text-sm font-semibold text-neutral-500 mb-3">
        {shopProducts.length} {plural(shopProducts.length, locale, t.shop.listingOne, t.shop.listingOther)}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {shopProducts.map((p) => (
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
                <span className="text-5xl">🛍️</span>
              )}
              {p.is_featured && (
                <span className="absolute top-2 left-2 text-[10px] font-semibold bg-amber-500 text-white rounded-full px-2 py-0.5">
                  ⭐ {t.product.featuredBadge}
                </span>
              )}
              {p.sale_price_fcfa != null && (
                <span className="absolute top-2 right-2 text-[10px] font-semibold bg-red-600 text-white rounded-full px-2 py-0.5">
                  {t.product.saleBadge}
                </span>
              )}
            </div>
            <div className="p-3">
              <p className="text-sm font-medium line-clamp-1">{p.title}</p>
              {p.sale_price_fcfa != null ? (
                <p className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs text-neutral-400 line-through">{formatFcfa(p.price_fcfa)}</span>
                  <span className="text-sm font-semibold text-red-600">{formatFcfa(p.sale_price_fcfa)}</span>
                </p>
              ) : (
                <p className="text-sm font-semibold mt-1">
                  {formatFcfa(p.price_fcfa)}
                </p>
              )}
            </div>
          </Link>
        ))}
        {shopProducts.length === 0 && (
          <p className="text-neutral-500 text-sm col-span-full py-12 text-center">
            {t.shop.noListings}
          </p>
        )}
      </div>

      <h2 className="text-sm font-semibold text-neutral-500 mt-10 mb-3">{t.shop.reviewsTitle}</h2>
      {reviews.length === 0 ? (
        <p className="text-neutral-500 text-sm">{t.shop.noReviews}</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-xl border border-neutral-200 bg-white p-4">
              <p className="text-sm">{"⭐".repeat(r.rating)}</p>
              {r.product_rating != null && r.seller_rating != null && r.delivery_rating != null && (
                <p className="text-xs text-neutral-500 mt-1">
                  {t.shop.reviewProductLabel} {r.product_rating}/5 · {t.shop.reviewSellerLabel}{" "}
                  {r.seller_rating}/5 · {t.shop.reviewDeliveryLabel} {r.delivery_rating}/5
                </p>
              )}
              {r.comment && <p className="text-sm text-neutral-600 mt-1">{r.comment}</p>}
              {r.seller_reply && (
                <div className="mt-2 rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2">
                  <p className="text-xs font-semibold text-neutral-700">{t.shop.sellerReplyLabel}</p>
                  <p className="text-xs text-neutral-600 mt-0.5">{r.seller_reply}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
