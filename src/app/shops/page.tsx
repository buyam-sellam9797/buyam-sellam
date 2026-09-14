import Link from "next/link";
import Image from "next/image";
import { getVerifiedShops, getShopRatingSummary } from "@/lib/supabase";
import { getLocale } from "@/lib/get-locale";
import { getDictionary, plural } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function VerifiedShopsPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const shops = await getVerifiedShops();
  const ratings = await Promise.all(shops.map((s) => getShopRatingSummary(s.id)));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold mb-1">{t.shops.title}</h1>
      <p className="text-neutral-500 text-sm mb-8">{t.shops.subtitle}</p>

      {shops.length === 0 ? (
        <p className="text-neutral-500 text-sm rounded-xl border border-dashed border-neutral-300 p-10 text-center">
          {t.shops.noneYet}
        </p>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100">
          {shops.map((shop, i) => {
            const rating = ratings[i];
            return (
              <div key={shop.id} className="flex items-center gap-4 p-4">
                <div className="relative w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-lg font-bold text-amber-700 overflow-hidden shrink-0">
                  {shop.logo_url ? (
                    <Image src={shop.logo_url} alt={shop.shop_name} fill sizes="48px" className="object-cover" />
                  ) : (
                    shop.shop_name.charAt(0)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{shop.shop_name}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    📍 {shop.city}
                    {rating.count > 0 &&
                      ` · ⭐ ${rating.average.toFixed(1)} · ${rating.count} ${plural(
                        rating.count,
                        locale,
                        t.product.reviewOne,
                        t.product.reviewOther
                      )}`}
                    {rating.completedOrders > 0 &&
                      ` · ${rating.completedOrders} ${plural(
                        rating.completedOrders,
                        locale,
                        t.product.orderOne,
                        t.product.orderOther
                      )}`}
                  </p>
                </div>
                <Link
                  href={`/shop/${shop.slug}`}
                  className="text-sm font-semibold text-amber-600 hover:underline whitespace-nowrap"
                >
                  {t.shops.visitShop}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
