import { notFound } from "next/navigation";
import { getProductById } from "@/lib/supabase";
import { getLocale } from "@/lib/get-locale";
import { getDictionary } from "@/lib/i18n";
import CheckoutForm from "./checkout-form";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ qty?: string }>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { id } = await params;
  const { qty } = await searchParams;
  const product = await getProductById(id);
  if (!product) notFound();

  const requestedQty = Number(qty);
  const initialQuantity = Number.isInteger(requestedQty)
    ? Math.min(Math.max(1, requestedQty), Math.max(1, product.stock_quantity))
    : 1;
  const deliveryFee = product.shop?.delivery_fee_fcfa ?? 0;

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-xl font-bold mb-6">{t.checkout.confirmOrder}</h1>
      <CheckoutForm product={product} initialQuantity={initialQuantity} deliveryFee={deliveryFee} />
    </div>
  );
}
