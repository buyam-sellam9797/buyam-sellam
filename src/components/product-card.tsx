import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/lib/supabase";
import type { Dictionary } from "@/lib/i18n";
import { formatFcfa } from "@/lib/format";
import { normalizeCondition } from "@/lib/conditions";
import { FavoriteButton } from "./favorite-button";
import { IconBag, IconHandshake, IconSeal, StatusDot } from "./dash-icons";

// The one product card used across browse, category pages and the
// homepage shelves, so a listing looks the same everywhere: photo,
// sale price, condition, "open to offers", and the shop's trust marks.
export function ProductCard({
  product: p,
  t,
  compact = false,
  children,
  sizes = "(max-width: 640px) 50vw, 25vw",
}: {
  product: Product;
  t: Dictionary;
  compact?: boolean;
  children?: React.ReactNode;
  sizes?: string;
}) {
  const grade = normalizeCondition(p.condition);
  const onSale = p.sale_price_fcfa != null && p.sale_price_fcfa < p.price_fcfa;
  const salePct = onSale ? Math.round((1 - (p.sale_price_fcfa as number) / p.price_fcfa) * 100) : 0;
  const signature = p.shop?.signature_status === "approved";
  return (
    <Link
      href={`/product/${p.id}`}
      className="group rounded-xl border border-neutral-200 bg-white overflow-hidden hover:shadow-md transition flex flex-col"
    >
      <div className="relative aspect-square bg-neutral-100 flex items-center justify-center overflow-hidden">
        <div className="absolute top-2 right-2 z-10">
          <FavoriteButton productId={p.id} size="sm" />
        </div>
        {(onSale || grade === "new_with_tags") && (
          <div className="absolute top-2 left-2 z-10 flex flex-col items-start gap-1">
            {onSale && <span className="rounded-full bg-red-600 text-white text-[10px] font-bold px-2 py-0.5">−{salePct}%</span>}
            {grade === "new_with_tags" && (
              <span className="rounded-full bg-white/95 text-neutral-900 text-[10px] font-bold px-2 py-0.5 shadow-sm">
                {t.conditions.grades.new_with_tags}
              </span>
            )}
          </div>
        )}
        {p.image_urls?.[0] ? (
          <Image src={p.image_urls[0]} alt={p.title} fill sizes={sizes} className="object-cover group-hover:scale-[1.02] transition-transform" />
        ) : (
          <IconBag className="w-10 h-10 text-neutral-300" />
        )}
        {p.accepts_offers && p.stock_quantity > 0 && (
          <span className="absolute bottom-2 left-2 z-10 inline-flex items-center gap-1 rounded-full bg-amber-400 text-neutral-900 text-[10px] font-bold px-2 py-0.5">
            <IconHandshake className="w-3 h-3" /> {t.offers.openToOffers}
          </span>
        )}
      </div>
      <div className={compact ? "p-2.5" : "p-3"}>
        <p className="text-sm font-medium line-clamp-1">{p.title}</p>
        <p className="text-xs text-neutral-500 mt-0.5 flex items-center gap-1 min-w-0">
          <span className="truncate">{p.shop?.shop_name}</span>
          {signature ? (
            <IconSeal className="w-3.5 h-3.5 text-amber-600 shrink-0" title={t.signature.badge} />
          ) : (
            p.shop?.is_verified && <StatusDot tone="success" className="inline-block w-1.5 h-1.5 rounded-full shrink-0" />
          )}
        </p>
        {!compact && grade !== "new" && grade !== "new_with_tags" && (
          <span className="inline-block mt-1 text-[10px] font-semibold rounded-full bg-neutral-100 px-2 py-0.5">
            {t.conditions.grades[grade]}
          </span>
        )}
        <p className="text-sm font-semibold mt-1">
          {onSale ? (
            <>
              <span className="text-red-600">{formatFcfa(p.sale_price_fcfa as number)}</span>{" "}
              <span className="text-xs font-normal text-neutral-400 line-through">{formatFcfa(p.price_fcfa)}</span>
            </>
          ) : (
            formatFcfa(p.price_fcfa)
          )}
        </p>
        {children}
      </div>
    </Link>
  );
}
