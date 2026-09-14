"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "./locale-provider";

// A quantity stepper + "Buy now" button. Kept as one small client
// component so the product page around it can stay a server component
// — only the interactive bit (picking a quantity before checkout)
// needs the browser.
export function BuyNowButton({ productId, stock }: { productId: string; stock: number }) {
  const { t } = useLocale();
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);

  if (stock <= 0) {
    return (
      <div className="mt-6 w-full text-center rounded-full bg-neutral-100 text-neutral-400 font-semibold px-6 py-3">
        {t.product.outOfStock}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-neutral-700">{t.product.quantityLabel}</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="w-8 h-8 rounded-full border border-neutral-300 text-neutral-700 font-semibold hover:border-neutral-900"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="w-6 text-center text-sm font-semibold">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(stock, q + 1))}
            className="w-8 h-8 rounded-full border border-neutral-300 text-neutral-700 font-semibold hover:border-neutral-900"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
      </div>
      <p className="text-xs text-neutral-500 mb-3 text-right">
        {stock} {t.product.availableOther}
      </p>
      <button
        type="button"
        onClick={() => router.push(`/checkout/${productId}?qty=${quantity}`)}
        className="w-full text-center rounded-full bg-neutral-900 text-white font-semibold px-6 py-3 hover:bg-neutral-700"
      >
        {t.product.buyNow}
      </button>
    </div>
  );
}
