import Link from "next/link";
import { notFound } from "next/navigation";
import { products, formatFcfa } from "@/lib/mock-data";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = products.find((p) => p.id === id);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 grid sm:grid-cols-2 gap-8">
      <div className="aspect-square bg-neutral-100 rounded-xl flex items-center justify-center text-8xl">
        {product.imageEmoji}
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-amber-600 font-semibold">
          {product.category}
        </p>
        <h1 className="text-2xl font-bold mt-1">{product.title}</h1>
        <Link
          href={`/shop/${product.shopSlug}`}
          className="text-sm text-neutral-500 hover:text-amber-600 mt-1 inline-block"
        >
          Sold by {product.shopName}
        </Link>
        <p className="text-2xl font-semibold mt-4">
          {formatFcfa(product.priceFcfa)}
        </p>

        <Link
          href={`/checkout/${product.id}`}
          className="mt-6 inline-block w-full text-center rounded-full bg-neutral-900 text-white font-semibold px-6 py-3 hover:bg-neutral-700"
        >
          Buy now with Mobile Money
        </Link>

        <div className="mt-6 rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
          Your payment is held by Buyam Sellam and only released to the
          seller once you confirm you received this order.
        </div>
      </div>
    </div>
  );
}
