import Link from "next/link";
import Image from "next/image";
import type { Dictionary } from "@/lib/i18n";
import type { ShelfShop } from "@/lib/home-shelves";
import { IconSeal, IconShield } from "./dash-icons";

// Shop tile for the Signature and "shops people love" shelves and the
// /signature page: cover strip, logo, name, what kind of Signature shop
// it is, and its city.
export function ShopCard({
  shop,
  t,
  tone = "light",
  feature = false,
}: {
  shop: ShelfShop;
  t: Dictionary;
  tone?: "light" | "dark";
  // Larger editorial card with the shop's story (the /signature page).
  feature?: boolean;
}) {
  const signature = shop.signature_status === "approved";
  const kinds = t.signature.kinds as Record<string, string>;
  const dark = tone === "dark";
  return (
    <Link
      href={`/shop/${shop.slug}`}
      className={`group block rounded-xl overflow-hidden border transition hover:shadow-md ${
        dark ? "border-white/10 bg-white/5 hover:bg-white/10" : "border-neutral-200 bg-white"
      }`}
    >
      <div className={`relative ${feature ? "h-36" : "h-20"} ${dark ? "bg-neutral-800" : "bg-neutral-100"}`}>
        {shop.cover_url && <Image src={shop.cover_url} alt="" fill sizes="240px" className="object-cover opacity-90" />}
        {signature && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-neutral-900/90 text-amber-300 text-[10px] font-bold px-2 py-0.5">
            <IconSeal className="w-3 h-3" /> {t.signature.badge}
          </span>
        )}
      </div>
      <div className="px-3 pb-3 -mt-6 relative">
        <div className={`${feature ? "w-14 h-14" : "w-12 h-12"} rounded-xl overflow-hidden border-2 flex items-center justify-center font-bold ${dark ? "border-neutral-900 bg-neutral-700 text-white" : "border-white bg-neutral-900 text-white"}`}>
          {shop.logo_url ? (
            <Image src={shop.logo_url} alt="" width={48} height={48} className="object-cover w-full h-full" />
          ) : (
            shop.shop_name.charAt(0).toUpperCase()
          )}
        </div>
        <p className="mt-2 text-sm font-semibold line-clamp-1 flex items-center gap-1">
          {shop.shop_name}
          {!signature && shop.is_verified && <IconShield className="w-3.5 h-3.5 text-green-600 shrink-0" />}
        </p>
        <p className={`text-xs line-clamp-1 ${dark ? "text-neutral-400" : "text-neutral-500"}`}>
          {signature && shop.signature_kind && kinds[shop.signature_kind] ? `${kinds[shop.signature_kind]} · ` : ""}
          {shop.city}
        </p>
        {feature && (shop.signature_founder || shop.signature_founded_year) && (
          <p className={`text-xs mt-1 ${dark ? "text-neutral-300" : "text-neutral-700"}`}>
            {shop.signature_founder}
            {shop.signature_founder && shop.signature_founded_year ? " · " : ""}
            {shop.signature_founded_year ? `${t.signature.sinceLabel} ${shop.signature_founded_year}` : ""}
          </p>
        )}
        {feature && shop.signature_story && (
          <p className={`text-sm mt-2 line-clamp-3 leading-relaxed ${dark ? "text-neutral-300" : "text-neutral-600"}`}>“{shop.signature_story}”</p>
        )}
        {signature && shop.made_in_cameroon && (
          <p className={`mt-1 text-[10px] font-semibold uppercase tracking-wide ${dark ? "text-amber-300" : "text-amber-700"}`}>
            {t.signature.madeInCameroon}
          </p>
        )}
      </div>
    </Link>
  );
}
