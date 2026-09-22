import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductById, getShopRatingSummary, getActiveGroupBuyForProduct } from "@/lib/supabase";
import { getSellerResponseStats } from "@/lib/supabase-admin";
import { formatFcfa, formatResponseTime } from "@/lib/format";
import { getLocale } from "@/lib/get-locale";
import { getDictionary, plural } from "@/lib/i18n";
import { getSiteUrl } from "@/lib/site";
import { ShareButton } from "@/components/share-button";
import { BuyNowButton } from "@/components/buy-now-button";
import { ChatWidget } from "@/components/chat-widget";
import { FavoriteButton } from "@/components/favorite-button";
import { RestockNotifyButton } from "@/components/restock-notify-button";
import { IconBag, IconShield, IconStar, IconPin, IconTruck, IconCard, IconChat, StatusDot } from "@/components/dash-icons";

const conditionKey = {
  new: "conditionNew",
  like_new: "conditionLikeNew",
  used: "conditionUsed",
} as const;

export const dynamic = "force-dynamic";

// Without this, every single product page showed the same generic
// site title/description in search results and when shared as a link
// (see layout.tsx's root `metadata`) — so a shared product looked
// identical to the homepage on Google, WhatsApp, and Facebook. This
// gives each product its own title, description, and preview image
// instead.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) return {};

  const title = `${product.title} — ${formatFcfa(product.price_fcfa)} | Buyam Sellam`;
  const description =
    product.description?.trim() ||
    `${product.title}${product.shop ? ` from ${product.shop.shop_name} in ${product.shop.city}` : ""}. Pay by MTN MoMo or Orange Money, held safely until you confirm delivery.`;
  const image = product.image_urls?.[0];
  const url = `${getSiteUrl()}/product/${product.id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) notFound();

  const rating = product.shop
    ? await getShopRatingSummary(product.shop.id)
    : { average: 0, count: 0, completedOrders: 0 };
  const responseStats = product.shop ? await getSellerResponseStats(product.shop.id) : null;
  const activeGroupBuy = await getActiveGroupBuyForProduct(product.id);
  const shareUrl = `${getSiteUrl()}/product/${product.id}`;

  // Tells Google this is a product listing (price, availability, who
  // sells it) so it can show that directly in search results instead
  // of treating this as a plain article. Deliberately leaves out
  // "aggregateRating"/"review" — the ratings we have are per-shop, not
  // per-product, and Google penalizes structured data that claims a
  // rating for something it doesn't actually measure.
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description || undefined,
    image: product.image_urls?.length ? product.image_urls : undefined,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    offers: {
      "@type": "Offer",
      url: shareUrl,
      priceCurrency: "XAF",
      price: product.sale_price_fcfa ?? product.price_fcfa,
      availability:
        product.stock_quantity > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      ...(product.shop
        ? { seller: { "@type": "Organization", name: product.shop.shop_name } }
        : {}),
    },
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 grid sm:grid-cols-2 gap-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <div className="relative aspect-square bg-neutral-100 rounded-xl flex items-center justify-center overflow-hidden">
        <div className="absolute top-3 right-3 z-10">
          <FavoriteButton productId={product.id} />
        </div>
        {product.image_urls?.[0] ? (
          <Image
            src={product.image_urls[0]}
            alt={product.title}
            fill
            sizes="(max-width: 640px) 100vw, 448px"
            preload
            className="object-cover"
          />
        ) : (
          <IconBag className="w-16 h-16 text-neutral-300" />
        )}
      </div>
      <div>
        {product.category && (
          <p className="text-xs uppercase tracking-wide text-amber-600 font-semibold">
            {product.category.name}
          </p>
        )}
        <h1 className="text-2xl font-bold mt-1">{product.title}</h1>
        {product.brand && (
          <p className="text-sm text-neutral-500 mt-0.5">{product.brand}</p>
        )}

        <span className="inline-block mt-2 text-xs font-semibold rounded-full bg-neutral-100 px-2.5 py-1">
          {t.product[conditionKey[product.condition] ?? "conditionNew"]}
        </span>

        {product.description && (
          <p className="text-sm text-neutral-600 mt-2">{product.description}</p>
        )}

        {product.sizes?.length > 0 && (
          <p className="text-sm mt-3">
            <span className="text-neutral-500">{t.product.sizesLabel}: </span>
            {product.sizes.join(", ")}
          </p>
        )}
        {product.colors?.length > 0 && (
          <p className="text-sm mt-1">
            <span className="text-neutral-500">{t.product.colorsLabel}: </span>
            {product.colors.join(", ")}
          </p>
        )}

        {product.sale_price_fcfa != null ? (
          <p className="flex items-center gap-2 mt-4">
            <span className="text-base text-neutral-400 line-through">{formatFcfa(product.price_fcfa)}</span>
            <span className="text-2xl font-semibold text-red-600">{formatFcfa(product.sale_price_fcfa)}</span>
          </p>
        ) : (
          <p className="text-2xl font-semibold mt-4">
            {formatFcfa(product.price_fcfa)}
          </p>
        )}

        {product.shop && (
          <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 text-sm">
            <Link
              href={`/shop/${product.shop.slug}`}
              className="font-medium hover:text-amber-600 flex items-center gap-1.5 flex-wrap"
            >
              {product.shop.shop_name}
              {product.shop.is_verified && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                  <IconShield className="w-3 h-3" /> {t.product.verified}
                </span>
              )}
            </Link>
            <p className="text-neutral-500 mt-1 flex items-center gap-1">
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
            <p className="text-neutral-500 mt-1 flex items-center gap-1">
              <IconPin className="w-3.5 h-3.5 shrink-0" /> {product.shop.city}
            </p>
            <p className="text-neutral-500 mt-1 flex items-center gap-1">
              <IconTruck className="w-3.5 h-3.5 shrink-0" /> {product.shop.delivery_info || t.product.deliveryAvailable}
            </p>
            {responseStats && (
              <p className="text-neutral-500 mt-1 flex items-center gap-1">
                <IconChat className="w-3.5 h-3.5 shrink-0" />
                {t.product.responseTimeBadge.replace(
                  "{time}",
                  formatResponseTime(responseStats.avgResponseMinutes, t.product)
                )}
              </p>
            )}
            {(product.shop.delivery_fee_fcfa != null || product.shop.delivery_eta_text) && (
              <p className="text-neutral-500 mt-1">
                {product.shop.delivery_fee_fcfa != null &&
                  `${t.product.deliveryFeeLabel}: ${formatFcfa(product.shop.delivery_fee_fcfa)}`}
                {product.shop.delivery_fee_fcfa != null && product.shop.delivery_eta_text && " · "}
                {product.shop.delivery_eta_text &&
                  `${t.product.deliveryEtaLabel}: ${product.shop.delivery_eta_text}`}
              </p>
            )}
          </div>
        )}

        <div className="mt-4">
          <p className="text-xs font-semibold text-neutral-500 mb-1.5">{t.product.paymentLabel}</p>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium">
              <IconCard className="w-3.5 h-3.5" /> MTN MoMo
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium">
              <IconCard className="w-3.5 h-3.5" /> Orange Money
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-1.5">{t.product.layawayAvailableNote}</p>
        </div>

        <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
          <p className="font-semibold mb-1 flex items-center gap-1.5">
            <IconShield className="w-4 h-4" /> {t.product.buyerProtectionTitle}
          </p>
          {t.product.escrowNotice}
        </div>

        {activeGroupBuy && (
          <div className="mt-4 rounded-lg bg-neutral-50 border border-neutral-200 p-4 text-sm">
            <p className="font-semibold mb-1">{t.groupBuyJoin.bannerTitle}</p>
            <p className="text-neutral-600 mb-2">
              {t.groupBuyJoin.bannerBody
                .replace("{joined}", String(activeGroupBuy.joined_quantity ?? 0))
                .replace("{target}", String(activeGroupBuy.target_quantity))
                .replace("{price}", formatFcfa(activeGroupBuy.group_price_fcfa))}
            </p>
            <div className="mb-2 h-1.5 rounded-full overflow-hidden bg-neutral-200">
              <div
                className="h-full rounded-full bg-amber-500"
                style={{
                  width: `${Math.min(100, Math.round(((activeGroupBuy.joined_quantity ?? 0) / activeGroupBuy.target_quantity) * 100))}%`,
                }}
              />
            </div>
            <Link
              href={`/group-buy/${activeGroupBuy.id}`}
              className="inline-block w-full text-center rounded-full bg-neutral-900 text-white font-semibold px-6 py-2.5 hover:bg-neutral-700"
            >
              {t.groupBuyJoin.bannerCta}
            </Link>
          </div>
        )}

        {product.shop?.is_open === false ? (
          <div className="mt-6 w-full text-center rounded-full bg-red-50 border border-red-200 text-red-700 font-semibold px-6 py-3 inline-flex items-center justify-center gap-1.5">
            <StatusDot tone="danger" /> {product.shop.closed_message || t.shop.temporarilyClosed}
          </div>
        ) : (
          <>
            <BuyNowButton productId={product.id} stock={product.stock_quantity} />
            {product.stock_quantity <= 0 && product.shop && (
              <RestockNotifyButton productId={product.id} shopId={product.shop.id} />
            )}
          </>
        )}

        {product.shop && (
          <div className="mt-3">
            <ChatWidget shopId={product.shop.id} shopName={product.shop.shop_name} productId={product.id} productTitle={product.title} />
          </div>
        )}

        <ShareButton
          title={product.title}
          url={shareUrl}
          message={t.product.shareMessage
            .replace("{title}", product.title)
            .replace("{price}", formatFcfa(product.sale_price_fcfa ?? product.price_fcfa))}
        />
      </div>
    </div>
  );
}
