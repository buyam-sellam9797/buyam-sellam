import Link from "next/link";
import { getProductsByIds, getDeliveryZones } from "@/lib/supabase";
import { decodeBagItems } from "@/lib/bag-items";
import { getLocale } from "@/lib/get-locale";
import { getDictionary } from "@/lib/i18n";
import CheckoutForm from "../[id]/checkout-form";

export const dynamic = "force-dynamic";

// Pays one shop's bag in one order. The bag page hands the items over
// in the URL (?items=pid:qty,...); prices, stock and delivery are all
// re-checked on the server when the payment starts.
export default async function BagCheckoutPage({ searchParams }: { searchParams: Promise<{ items?: string }> }) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { items } = await searchParams;
  const wanted = decodeBagItems(items);
  const products = await getProductsByIds(wanted.map((w) => w.productId));
  const shopIds = new Set(products.map((p) => p.shop_id));

  if (products.length === 0 || shopIds.size !== 1) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm text-neutral-600 mb-4">{t.bag.checkoutUnavailable}</p>
        <Link href="/bag" className="rounded-full bg-neutral-900 text-white font-semibold px-6 py-2.5 text-sm">
          {t.bag.backToBag}
        </Link>
      </div>
    );
  }

  const lines = wanted
    .map((w) => {
      const product = products.find((p) => p.id === w.productId);
      return product && product.stock_quantity > 0 ? { product, quantity: w.quantity } : null;
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);
  const first = lines[0]?.product ?? products[0];
  const deliveryZones = await getDeliveryZones(first.shop_id);

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-xl font-bold mb-1">{t.checkout.confirmOrder}</h1>
      <p className="text-sm text-neutral-500 mb-6">
        {t.bag.checkoutFrom.replace("{shop}", first.shop?.shop_name ?? "")}
      </p>
      {lines.length === 0 ? (
        <p className="text-sm text-neutral-600">{t.bag.checkoutUnavailable}</p>
      ) : (
        <CheckoutForm
          product={first}
          bagLines={lines}
          deliveryFee={first.shop?.delivery_fee_fcfa ?? 0}
          deliveryZones={deliveryZones}
          cardsEnabled={process.env.NOTCHPAY_CARDS_ENABLED === "true"}
        />
      )}
    </div>
  );
}
