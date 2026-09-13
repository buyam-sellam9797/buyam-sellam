import { notFound } from "next/navigation";
import { products, formatFcfa } from "@/lib/mock-data";
import CheckoutForm from "./checkout-form";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = products.find((p) => p.id === id);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-xl font-bold mb-6">Confirm your order</h1>

      <div className="rounded-xl border border-neutral-200 bg-white p-4 flex gap-3 items-center mb-6">
        <div className="w-14 h-14 rounded-lg bg-neutral-100 flex items-center justify-center text-2xl">
          {product.imageEmoji}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{product.title}</p>
          <p className="text-xs text-neutral-500">{product.shopName}</p>
        </div>
        <p className="text-sm font-semibold">{formatFcfa(product.priceFcfa)}</p>
      </div>

      <CheckoutForm product={product} />
    </div>
  );
}
