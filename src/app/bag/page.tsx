"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase, type Product } from "@/lib/supabase";
import { useBag, setBagQuantity, removeFromBag } from "@/lib/bag";
import { encodeBagItems } from "@/lib/bag-items";
import { formatFcfa, formatEurFromFcfa } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";
import { plural } from "@/lib/i18n";
import { IconBag, IconGift, IconLock, IconShield } from "@/components/dash-icons";

type BagProduct = Pick<Product, "id" | "shop_id" | "title" | "price_fcfa" | "sale_price_fcfa" | "stock_quantity" | "image_urls" | "is_active"> & {
  shop: { id: string; shop_name: string; slug: string; city: string; is_verified: boolean; is_open: boolean } | null;
};

// The bag: items saved from any shop, grouped by shop because each
// shop delivers its own items and is paid in its own protected order.
// Each group can be paid right away, or sent to someone else to pay.
export default function BagPage() {
  const { t, locale } = useLocale();
  const lines = useBag();
  const [products, setProducts] = useState<Map<string, BagProduct>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const idsKey = lines.map((l) => l.productId).sort().join(",");

  useEffect(() => {
    let cancelled = false;
    const ids = idsKey ? idsKey.split(",") : [];
    (async () => {
      if (ids.length === 0) {
        if (!cancelled) {
          setProducts(new Map());
          setLoaded(true);
        }
        return;
      }
      const { data } = await supabase
        .from("products")
        .select("id, shop_id, title, price_fcfa, sale_price_fcfa, stock_quantity, image_urls, is_active, shop:shops(id, shop_name, slug, city, is_verified, is_open)")
        .in("id", ids);
      if (cancelled) return;
      const map = new Map<string, BagProduct>();
      for (const row of (data ?? []) as unknown as BagProduct[]) map.set(row.id, row);
      setProducts(map);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  const groups = useMemo(() => {
    const byShop = new Map<string, { shopId: string; items: { productId: string; quantity: number; product: BagProduct | null }[] }>();
    for (const line of lines) {
      const product = products.get(line.productId) ?? null;
      const shopId = product?.shop_id ?? line.shopId;
      const group = byShop.get(shopId) ?? { shopId, items: [] };
      group.items.push({ productId: line.productId, quantity: line.quantity, product });
      byShop.set(shopId, group);
    }
    return [...byShop.values()];
  }, [lines, products]);

  if (loaded && lines.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center">
          <IconBag className="w-7 h-7 text-neutral-400" />
        </div>
        <h1 className="text-xl font-bold mb-2">{t.bag.title}</h1>
        <p className="text-sm text-neutral-500 mb-6">{t.bag.empty}</p>
        <Link href="/browse" className="rounded-full bg-neutral-900 text-white font-semibold px-6 py-2.5 text-sm hover:bg-neutral-700">
          {t.bag.emptyCta}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t.bag.title}</h1>
      <p className="text-sm text-neutral-500 mt-1 mb-6">{t.bag.perShopNote}</p>

      <div className="flex flex-col gap-6">
        {groups.map((group) => {
          const shop = group.items.find((i) => i.product?.shop)?.product?.shop ?? null;
          const payable = group.items.filter(
            (i) => i.product && i.product.is_active && i.product.stock_quantity > 0
          );
          const subtotal = payable.reduce(
            (sum, i) => sum + (i.product!.sale_price_fcfa ?? i.product!.price_fcfa) * Math.min(i.quantity, i.product!.stock_quantity),
            0
          );
          const itemsParam = encodeBagItems(
            payable.map((i) => ({ productId: i.productId, quantity: Math.min(i.quantity, i.product!.stock_quantity) }))
          );
          const count = payable.reduce((n, i) => n + Math.min(i.quantity, i.product!.stock_quantity), 0);
          const shopClosed = shop?.is_open === false;
          return (
            <section key={group.shopId} className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
              <header className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-neutral-100 bg-neutral-50">
                {shop ? (
                  <Link href={`/shop/${shop.slug}`} className="font-semibold hover:text-amber-600 inline-flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{shop.shop_name}</span>
                    {shop.is_verified && <IconShield className="w-3.5 h-3.5 text-green-700 shrink-0" />}
                  </Link>
                ) : (
                  <span className="h-4 w-32 rounded bg-neutral-200 animate-pulse" />
                )}
                {shop && <span className="text-xs text-neutral-500 shrink-0">{shop.city}</span>}
              </header>

              <ul className="divide-y divide-neutral-100">
                {group.items.map(({ productId, quantity, product }) => {
                  const unavailable = loaded && (!product || !product.is_active || product.stock_quantity <= 0);
                  const price = product ? (product.sale_price_fcfa ?? product.price_fcfa) : 0;
                  const max = product ? Math.max(1, product.stock_quantity) : 1;
                  return (
                    <li key={productId} className={`flex gap-3 px-4 sm:px-5 py-4 ${unavailable ? "opacity-60" : ""}`}>
                      <Link href={`/product/${productId}`} className="relative w-20 h-20 rounded-xl bg-neutral-100 overflow-hidden shrink-0 flex items-center justify-center">
                        {product?.image_urls?.[0] ? (
                          <Image src={product.image_urls[0]} alt={product.title} fill sizes="80px" className="object-cover" />
                        ) : (
                          <IconBag className="w-7 h-7 text-neutral-300" />
                        )}
                      </Link>
                      <div className="flex-1 min-w-0 flex flex-col">
                        <Link href={`/product/${productId}`} className="text-sm font-medium line-clamp-2 hover:text-amber-600">
                          {product?.title ?? " "}
                        </Link>
                        {product && (
                          <p className="text-sm mt-0.5">
                            {product.sale_price_fcfa != null && (
                              <span className="text-neutral-400 line-through text-xs mr-1.5">{formatFcfa(product.price_fcfa)}</span>
                            )}
                            <span className="font-semibold">{formatFcfa(price)}</span>
                          </p>
                        )}
                        {unavailable ? (
                          <p className="text-xs text-red-700 mt-1">{t.bag.unavailable}</p>
                        ) : product && product.stock_quantity <= 3 ? (
                          <p className="text-xs text-amber-700 mt-1">{t.bag.onlyLeft.replace("{n}", String(product.stock_quantity))}</p>
                        ) : null}
                        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                          {!unavailable && product ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setBagQuantity(productId, Math.max(1, quantity - 1))}
                                className="w-7 h-7 rounded-full border border-neutral-300 text-sm font-semibold hover:border-neutral-900"
                                aria-label="Decrease quantity"
                              >
                                −
                              </button>
                              <span className="w-6 text-center text-sm font-semibold">{Math.min(quantity, max)}</span>
                              <button
                                type="button"
                                onClick={() => setBagQuantity(productId, Math.min(max, quantity + 1))}
                                className="w-7 h-7 rounded-full border border-neutral-300 text-sm font-semibold hover:border-neutral-900"
                                aria-label="Increase quantity"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <span />
                          )}
                          <button type="button" onClick={() => removeFromBag(productId)} className="text-xs font-semibold text-neutral-500 underline hover:text-neutral-900">
                            {t.bag.remove}
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {payable.length > 0 && (
                <footer className="px-4 sm:px-5 py-4 border-t border-neutral-100 bg-neutral-50/60">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-neutral-600">
                      {count} {plural(count, locale, t.bag.itemCountOne, t.bag.itemCountOther)}
                    </span>
                    <span className="text-right">
                      <span className="block text-lg font-bold">{formatFcfa(subtotal)}</span>
                      <span className="block text-xs text-neutral-500">≈ {formatEurFromFcfa(subtotal, locale)}</span>
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">{t.bag.deliveryAtCheckout}</p>
                  {shopClosed ? (
                    <p className="mt-3 text-sm text-red-700">{t.shop.temporarilyClosed}</p>
                  ) : (
                    <div className="mt-3 grid sm:grid-cols-2 gap-2">
                      <Link
                        href={`/checkout/bag?items=${itemsParam}`}
                        className="rounded-full bg-neutral-900 text-white font-semibold px-5 py-3 text-sm text-center hover:bg-neutral-700 inline-flex items-center justify-center gap-1.5"
                      >
                        <IconLock className="w-4 h-4" />
                        {t.bag.checkout.replace("{amount}", formatFcfa(subtotal))}
                      </Link>
                      <Link
                        href={`/bag/share?items=${itemsParam}`}
                        className="rounded-full border border-neutral-300 bg-white font-semibold px-5 py-3 text-sm text-center hover:border-neutral-900 inline-flex items-center justify-center gap-1.5"
                      >
                        <IconGift className="w-4 h-4" />
                        {t.bag.askToPay}
                      </Link>
                    </div>
                  )}
                  <p className="text-xs text-neutral-500 mt-2">{t.bag.askToPayHint}</p>
                </footer>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
