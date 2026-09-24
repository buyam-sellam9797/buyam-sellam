import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getShopBySlug, getShopProducts, getShopRatingSummary, getShopReviews } from "@/lib/supabase";
import { incrementShopViews, getSellerResponseStats, getAdminClient } from "@/lib/supabase-admin";
import { FollowButton } from "@/components/follow-button";
import { formatFcfa, formatResponseTime } from "@/lib/format";
import { getLocale } from "@/lib/get-locale";
import { getDictionary, plural } from "@/lib/i18n";
import { getSiteUrl } from "@/lib/site";
import { isOpenNow, summarizeBusinessHours } from "@/lib/business-hours";
import { ChatWidget } from "@/components/chat-widget";
import { IconShield, IconPin, IconStar, IconCard, IconTruck, IconLock, IconBag, IconChat, StatusDot } from "@/components/dash-icons";

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
  const socialImage = shop.cover_url || shop.logo_url || undefined;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      images: socialImage ? [{ url: socialImage }] : undefined,
    },
    twitter: {
      card: socialImage ? "summary_large_image" : "summary",
      title,
      description,
      images: socialImage ? [socialImage] : undefined,
    },
  };
}

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { slug } = await params;
  const { category: activeCategorySlug } = await searchParams;
  const shop = await getShopBySlug(slug);
  if (!shop) notFound();

  // Fire-and-forget: a storefront visit is worth counting for the
  // seller's dashboard, but should never slow down or break the page
  // if the write fails for any reason.
  incrementShopViews(shop.id).catch(() => {});

  const [allShopProducts, rating, reviews, responseStats] = await Promise.all([
    getShopProducts(shop.id),
    getShopRatingSummary(shop.id),
    getShopReviews(shop.id),
    getSellerResponseStats(shop.id),
  ]);

  // Category chips: only the categories this shop actually has
  // something listed in, in the order those categories first appear
  // among the shop's products — never every category on the platform,
  // most of which would just be empty chips for a small shop.
  const categories: { slug: string; name: string }[] = [];
  for (const p of allShopProducts) {
    if (p.category && !categories.some((c) => c.slug === p.category!.slug)) {
      categories.push({ slug: p.category.slug, name: p.category.name });
    }
  }
  const shopProducts = activeCategorySlug
    ? allShopProducts.filter((p) => p.category?.slug === activeCategorySlug)
    : allShopProducts;
  const activeCategoryName = activeCategorySlug
    ? categories.find((c) => c.slug === activeCategorySlug)?.name
    : null;

  const openNow = isOpenNow(shop.is_open, shop.business_hours);
  const hoursSummary = shop.business_hours
    ? summarizeBusinessHours(shop.business_hours, t.dashboard.dayLabels, t.shop.closedDayLabel)
    : null;


  // Follower count for the Follow button (read with the service role:
  // each follow row is private to its follower).
  const followAdmin = getAdminClient();
  const { count: followerCount } = followAdmin
    ? await followAdmin.from("shop_follows").select("id", { count: "exact", head: true }).eq("shop_id", shop.id)
    : { count: 0 };
  return (
    <div className="flex flex-col">
      {/* Cover photo + overlapping circular logo, the way most buyers
          already recognize a shop front page — falls back to a plain
          brand-gradient when a shop hasn't uploaded a cover yet, so a
          shop with no cover still looks intentional, not broken. */}
      <div
        className="relative w-full h-40 sm:h-56"
        style={{ background: "linear-gradient(135deg, #fde68a, #f59e0b)" }}
      >
        {shop.cover_url && (
          <Image src={shop.cover_url} alt="" fill sizes="100vw" className="object-cover" priority />
        )}
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-12 w-full">
        <div className="flex flex-wrap items-end gap-4 -mt-10 sm:-mt-12 mb-4">
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-amber-100 flex items-center justify-center text-3xl font-bold text-amber-700 overflow-hidden border-4 border-white shrink-0 shadow-sm">
            {shop.logo_url ? (
              <Image src={shop.logo_url} alt={shop.shop_name} fill sizes="96px" className="object-cover" />
            ) : (
              shop.shop_name.charAt(0)
            )}
          </div>
          <div className="flex-1 min-w-[12rem] pb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{shop.shop_name}</h1>
              {shop.is_personal && (
                <span className="inline-flex items-center text-xs font-semibold text-neutral-700 bg-neutral-100 border border-neutral-200 rounded-full px-2.5 py-0.5">
                  {t.sellItem.privateSeller}
                </span>
              )}
              {shop.is_verified && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
                  <IconShield className="w-3.5 h-3.5" /> {t.shop.verified}
                </span>
              )}
            </div>
            <p className="text-sm text-neutral-500 mt-1 flex items-center gap-1">
              <IconPin className="w-3.5 h-3.5" /> {shop.city}
            </p>
            <p className="text-sm text-neutral-500 mt-0.5 flex items-center gap-1">
              {rating.count > 0 ? (
                <>
                  <IconStar filled className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  {rating.average.toFixed(1)} · {rating.count}{" "}
                  {plural(rating.count, locale, t.product.reviewOne, t.product.reviewOther)}
                </>
              ) : (
                t.product.newSeller
              )}
              {rating.completedOrders > 0 &&
                ` · ${rating.completedOrders} ${plural(
                  rating.completedOrders,
                  locale,
                  t.product.orderOne,
                  t.product.orderOther
                )}`}
            </p>
            <div className="mt-2">
              <FollowButton shopId={shop.id} initialCount={followerCount ?? 0} />
            </div>
          </div>
          <div className="shrink-0 w-full sm:w-64">
            <ChatWidget shopId={shop.id} shopName={shop.shop_name} />
          </div>
        </div>

        <p className="text-sm mb-4 flex items-center gap-1.5">
          {openNow ? (
            <span className="text-green-700 font-medium inline-flex items-center gap-1.5">
              <StatusDot tone="success" /> {t.shop.openNow}
            </span>
          ) : (
            <span className="text-red-600 font-medium inline-flex items-center gap-1.5">
              <StatusDot tone="danger" /> {t.shop.closedNow}
            </span>
          )}
          {hoursSummary && <span className="text-neutral-500"> · {hoursSummary}</span>}
        </p>

        {!shop.is_open && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm mb-6 flex items-center gap-1.5">
            <StatusDot tone="danger" /> {shop.closed_message || t.shop.temporarilyClosed}
          </div>
        )}

        {shop.description && (
          <p className="text-sm text-neutral-600 mb-4">{shop.description}</p>
        )}

        {(shop.facebook_url || shop.instagram_url || shop.tiktok_url) && (
          <div className="flex items-center gap-4 mb-6 text-sm">
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

        {/* Same trust cues the homepage already leads with — repeated
            here because a shop page, shared directly on WhatsApp, is
            often the very first page of the site a buyer ever sees. */}
        <div className="flex flex-wrap gap-2 mb-8">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 bg-neutral-100 rounded-full px-3 py-1.5">
            <IconCard className="w-3.5 h-3.5" /> {t.shop.trustPayment}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 bg-neutral-100 rounded-full px-3 py-1.5">
            <IconTruck className="w-3.5 h-3.5" /> {t.shop.trustDelivery}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 bg-neutral-100 rounded-full px-3 py-1.5">
            <IconLock className="w-3.5 h-3.5" /> {t.shop.trustEscrow}
          </span>
          {responseStats && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 bg-neutral-100 rounded-full px-3 py-1.5">
              <IconChat className="w-3.5 h-3.5" />
              {t.product.responseTimeBadge.replace(
                "{time}",
                formatResponseTime(responseStats.avgResponseMinutes, t.product)
              )}
            </span>
          )}
        </div>

        {shop.return_policy && (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600 mb-8">
            <p className="font-semibold text-neutral-800 mb-1">{t.shop.returnPolicyTitle}</p>
            <p className="whitespace-pre-line">{shop.return_policy}</p>
          </div>
        )}

        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <Link
              href={`/shop/${shop.slug}`}
              className={`text-xs font-semibold rounded-full px-3.5 py-1.5 border ${
                !activeCategorySlug
                  ? "bg-neutral-900 text-white border-neutral-900"
                  : "border-neutral-300 text-neutral-600 hover:border-neutral-900"
              }`}
            >
              {t.shop.allCategoriesChip}
            </Link>
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/shop/${shop.slug}?category=${encodeURIComponent(c.slug)}`}
                className={`text-xs font-semibold rounded-full px-3.5 py-1.5 border ${
                  activeCategorySlug === c.slug
                    ? "bg-neutral-900 text-white border-neutral-900"
                    : "border-neutral-300 text-neutral-600 hover:border-neutral-900"
                }`}
              >
                {c.name}
              </Link>
            ))}
          </div>
        )}

        <h2 className="text-sm font-semibold text-neutral-500 mb-3">
          {activeCategoryName ?? t.shop.allProductsTitle} · {shopProducts.length}{" "}
          {plural(shopProducts.length, locale, t.shop.listingOne, t.shop.listingOther)}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {shopProducts.map((p) => {
            const discountPct =
              p.sale_price_fcfa != null && p.price_fcfa > 0
                ? Math.round((1 - p.sale_price_fcfa / p.price_fcfa) * 100)
                : null;
            return (
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
                  {p.is_featured && (
                    <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-500 text-white rounded-full px-2 py-0.5">
                      <IconStar filled className="w-2.5 h-2.5" /> {t.product.featuredBadge}
                    </span>
                  )}
                  {discountPct != null && discountPct > 0 && (
                    <span className="absolute top-2 right-2 text-[10px] font-semibold bg-red-600 text-white rounded-full px-2 py-0.5">
                      -{discountPct}%
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
            );
          })}
          {shopProducts.length === 0 && (
            <p className="text-neutral-500 text-sm col-span-full py-12 text-center">
              {activeCategorySlug ? t.shop.noListingsInCategory : t.shop.noListings}
            </p>
          )}
        </div>

        <h2 className="text-sm font-semibold text-neutral-500 mt-10 mb-3">{t.shop.reviewsTitle}</h2>
        {reviews.length === 0 ? (
          <p className="text-neutral-500 text-sm">{t.shop.noReviews}</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3 mb-10">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                <p className="flex items-center gap-0.5 text-amber-500">
                  {Array.from({ length: r.rating }).map((_, i) => (
                    <IconStar key={i} filled className="w-3.5 h-3.5" />
                  ))}
                </p>
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
    </div>
  );
}
