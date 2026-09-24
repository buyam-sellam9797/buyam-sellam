import { notFound } from "next/navigation";
import { getProductById, getDeliveryZones } from "@/lib/supabase";
import { getAdminClient } from "@/lib/supabase-admin";
import { effectiveOfferStatus, type OfferRow } from "@/lib/offers";
import { getLocale } from "@/lib/get-locale";
import { getDictionary } from "@/lib/i18n";
import { getOperatorsForCountry, getCurrencyForCountry, isSebpayConfigured, SEBPAY_COUNTRY_CODE } from "@/lib/sebpay";
import CheckoutForm from "./checkout-form";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ qty?: string; offer?: string }>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { id } = await params;
  const { qty, offer: offerId } = await searchParams;
  const product = await getProductById(id);
  if (!product) notFound();

  // Paying a price agreed through an offer: the page only shows the
  // agreed amount; the payment route re-checks that it's this buyer's
  // deal, on this item, still within the time to pay.
  let offer: { id: string; unitPriceFcfa: number } | undefined;
  let offerProblem = false;
  if (offerId && /^[0-9a-f-]{36}$/i.test(offerId)) {
    const admin = getAdminClient();
    const { data } = admin
      ? await admin.from("offers").select("id, product_id, status, agreed_fcfa, expires_at, pay_by").eq("id", offerId).maybeSingle()
      : { data: null };
    const row = data as Pick<OfferRow, "id" | "product_id" | "status" | "agreed_fcfa" | "expires_at" | "pay_by"> | null;
    if (row && row.product_id === product.id && effectiveOfferStatus(row) === "accepted" && row.agreed_fcfa) {
      offer = { id: row.id, unitPriceFcfa: row.agreed_fcfa };
    } else {
      offerProblem = true;
    }
  }

  const requestedQty = Number(qty);
  const initialQuantity = Number.isInteger(requestedQty)
    ? Math.min(Math.max(1, requestedQty), Math.max(1, product.stock_quantity))
    : 1;
  const deliveryFee = product.shop?.delivery_fee_fcfa ?? 0;
  const deliveryZones = await getDeliveryZones(product.shop_id);

  // SebPay is a second, optional payment gateway alongside NotchPay.
  // Nothing about which operators/currency it supports for Cameroon is
  // assumed — it's looked up live from SebPay's own account here, and
  // the whole option simply doesn't render if this account isn't
  // configured for SebPay yet, or SebPay has nothing enabled for
  // Cameroon. See src/lib/sebpay.ts.
  const [sebpayOperators, sebpayCurrency] = isSebpayConfigured()
    ? await Promise.all([
        getOperatorsForCountry(SEBPAY_COUNTRY_CODE),
        getCurrencyForCountry(SEBPAY_COUNTRY_CODE),
      ])
    : [[], null];

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-xl font-bold mb-6">{t.checkout.confirmOrder}</h1>
      {offerProblem && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t.offers.checkoutOfferGone}
        </p>
      )}
      <CheckoutForm
        product={product}
        initialQuantity={initialQuantity}
        deliveryFee={deliveryFee}
        deliveryZones={deliveryZones}
        sebpayOperators={sebpayCurrency ? sebpayOperators : []}
        cardsEnabled={process.env.NOTCHPAY_CARDS_ENABLED === "true"}
        offer={offer}
      />
    </div>
  );
}
