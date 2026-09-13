import Link from "next/link";
import { notFound } from "next/navigation";
import { getShopBySlug, getShopProducts } from "@/lib/supabase";
import { formatFcfa } from "@/lib/format";
import { getLocale } from "@/lib/get-locale";
import { getDictionary, plural } from "@/lib/i18n";

export const dynamic = "force-dynamic";

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

  const shopProducts = await getShopProducts(shop.id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="rounded-xl bg-white border border-neutral-200 p-6 mb-8 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-2xl font-bold text-amber-700 overflow-hidden">
          {shop.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shop.logo_url} alt={shop.shop_name} className="w-full h-full object-cover" />
          ) : (
            shop.shop_name.charAt(0)
          )}
        </div>
        <div>
          <h1 className="text-xl font-bold">{shop.shop_name}</h1>
          <p className="text-sm text-neutral-500">
            {shop.city}
            {shop.is_verified ? ` · ${t.shop.verified}` : ""}
          </p>
        </div>
      </div>

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
            <div className="aspect-square bg-neutral-100 flex items-center justify-center overflow-hidden">
              {p.image_urls?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_urls[0]} alt={p.title} className="w-full h-full object-cover" />
              ) : (
                <span className="text-5xl">🛍️</span>
              )}
            </div>
            <div className="p-3">
              <p className="text-sm font-medium line-clamp-1">{p.title}</p>
              <p className="text-sm font-semibold mt-1">
                {formatFcfa(p.price_fcfa)}
              </p>
            </div>
          </Link>
        ))}
        {shopProducts.length === 0 && (
          <p className="text-neutral-500 text-sm col-span-full py-12 text-center">
            {t.shop.noListings}
          </p>
        )}
      </div>
    </div>
  );
}
