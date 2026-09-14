import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductById } from "@/lib/supabase";
import { formatFcfa } from "@/lib/format";
import { getLocale } from "@/lib/get-locale";
import { getDictionary } from "@/lib/i18n";
import { buildWhatsAppLink } from "@/lib/whatsapp";

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

        <span className="inline-block mt-2 text-xs font-semibold rounded-full bg-neutral-100 px-2.5 py-1">
          {t.product[conditionKey[product.condition] ?? "conditionNew"]}
        </span>

        {product.description && (
          <p className="text-sm text-neutral-600 mt-2">{product.description}</p>
        )}
        {product.shop && (
          <Link
            href={`/shop/${product.shop.slug}`}
            className="text-sm text-neutral-500 hover:text-amber-600 mt-1 inline-block"
          >
            {t.product.soldBy} {product.shop.shop_name}
          </Link>
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

        <Link
          href={`/checkout/${product.id}`}
          className="mt-6 inline-block w-full text-center rounded-full bg-neutral-900 text-white font-semibold px-6 py-3 hover:bg-neutral-700"
        >
          {t.product.buyNow}
        </Link>

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

        <div className="mt-6 rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
          {t.product.escrowNotice}
        </div>
      </div>
    </div>
  );
}
