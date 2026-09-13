import { notFound } from "next/navigation";
import { getProductById } from "@/lib/supabase";
import { formatFcfa } from "@/lib/format";
import CheckoutForm from "./checkout-form";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-xl font-bold mb-6">Confirm your order</h1>

      <div className="rounded-xl border border-neutral-200 bg-white p-4 flex gap-3 items-center mb-6">
        <div className="w-14 h-14 rounded-lg bg-neutral-100 flex items-center justify-center overflow-hidden">
          {product.image_urls?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_urls[0]} alt={product.title} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl">🛍️</span>
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{product.title}</p>
          <p className="text-xs text-neutral-500">{product.shop?.shop_name}</p>
        </div>
        <p className="text-sm font-semibold">{formatFcfa(product.price_fcfa)}</p>
      </div>

      <CheckoutForm product={product} />
    </div>
  );
}
