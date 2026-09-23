"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-provider";

// One login, two clearly separate spaces. This switch sits at the top
// of the buyer's account page and in the seller dashboard's sidebar so
// people always see which side they are on and can move between them
// on purpose. "Selling" goes to the dashboard for people who already
// run a shop, and to the Become-a-seller page for everyone else.
export function SpaceSwitch({
  active,
  hasShop,
  className = "",
}: {
  active: "buying" | "selling";
  hasShop: boolean;
  className?: string;
}) {
  const { t } = useLocale();
  const base = "flex-1 text-center rounded-full px-4 py-1.5 text-sm font-semibold transition";
  const on = "bg-neutral-900 text-white";
  const off = "text-neutral-600 hover:text-neutral-900";
  return (
    <div
      role="tablist"
      aria-label={t.spaces.switchLabel}
      className={`inline-flex w-full max-w-xs rounded-full border border-neutral-300 bg-white p-1 ${className}`}
    >
      <Link
        href="/account"
        role="tab"
        aria-selected={active === "buying"}
        className={`${base} ${active === "buying" ? on : off}`}
      >
        {t.spaces.buying}
      </Link>
      <Link
        href={hasShop ? "/dashboard" : "/become-seller"}
        role="tab"
        aria-selected={active === "selling"}
        className={`${base} ${active === "selling" ? on : off}`}
      >
        {t.spaces.selling}
      </Link>
    </div>
  );
}
