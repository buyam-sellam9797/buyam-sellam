import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductById } from "@/lib/supabase";
import { formatFcfa } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
        {product.description && (
          <p className="text-sm text-neutral-600 mt-2">{product.description}</p>
        )}
        {product.shop && (
          <Link
            href={`/shop/${product.shop.slug}`}
            className="text-sm text-neutral-500 hover:text-amber-600 mt-1 inline-block"
          >
            Sold by {product.shop.shop_name}
          </Link>
        )}
        <p className="text-2xl font-semibold mt-4">
          {formatFcfa(product.price_fcfa)}
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
