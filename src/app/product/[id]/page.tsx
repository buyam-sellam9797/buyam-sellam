import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductById, getShopRatingSummary } from "@/lib/supabase";
import { formatFcfa } from "@/lib/format";
import { getLocale } from "@/lib/get-locale";
import { getDictionary, plural } from "@/lib/i18n";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { getSiteUrl } from "@/lib/site";
import { ShareButton } from "@/components/share-button";
import { BuyNowButton } from "@/components/buy-now-button";

const conditionKey = {
  new: "conditionNew",
  like_new: "conditionLikeNew",
  used: "conditionUsed",
} as const;

export const dynamic = "force-dynamic";

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
  const shareUrl = `${getSiteUrl()}/product/${product.id}`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 grid sm:grid-cols-2 gap-8">
      <div className="aspect-square bg-neutral-100 rounded-xl flex items-center justify-center overflow-hidden">
        {product.image_urls?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_urls[0]}
            alt={product.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-8xl">🛍️</span>
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

        <p className="text-2xl font-semibold mt-4">
          {formatFcfa(product.price_fcfa)}
        </p>

        {product.shop && (
          <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 text-sm">
            <Link
              href={`/shop/${product.shop.slug}`}
              className="font-medium hover:text-amber-600 flex items-center gap-1.5 flex-wrap"
            >
              {product.shop.shop_name}
              {product.shop.is_verified && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                  🛡️ {t.product.verified}
                </span>
              )}
            </Link>
            <p className="text-neutral-500 mt-1">
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
            <p className="text-neutral-500 mt-1">📍 {product.shop.city}</p>
            <p className="text-neutral-500 mt-1">
              🚚 {product.shop.delivery_info || t.product.deliveryAvailable}
            </p>
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
              📱 MTN MoMo
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium">
              📱 Orange Money
            </span>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
          <p className="font-semibold mb-1">🛡️ {t.product.buyerProtectionTitle}</p>
          {t.product.escrowNotice}
        </div>

        <BuyNowButton productId={product.id} stock={product.stock_quantity} />

        {product.shop?.whatsapp_number && (
          <a
            href={buildWhatsAppLink(
              product.shop.whatsapp_number,
              t.product.whatsappMessage
                .replace("{title}", product.title)
                .replace("{price}", formatFcfa(product.price_fcfa))
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block w-full text-center rounded-full border border-green-600 text-green-700 font-semibold px-6 py-3 hover:bg-green-50"
          >
            {t.product.chatOnWhatsapp}
          </a>
        )}

        <ShareButton
          title={product.title}
          url={shareUrl}
          message={t.product.shareMessage
            .replace("{title}", product.title)
            .replace("{price}", formatFcfa(product.price_fcfa))}
        />
      </div>
    </div>
  );
}
