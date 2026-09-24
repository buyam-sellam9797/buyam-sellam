"use client";

import Link from "next/link";
import { useBag, bagCount } from "@/lib/bag";
import { useLocale } from "./locale-provider";
import { IconBag } from "./dash-icons";

// Header bag icon with the number of items waiting in the bag.
export function BagNavLink() {
  const { t } = useLocale();
  const lines = useBag();
  const count = bagCount(lines);
  return (
    <Link href="/bag" className="relative inline-flex items-center mr-1.5 hover:text-amber-600" aria-label={`${t.bag.navLabel}${count ? ` (${count})` : ""}`}>
      <IconBag className="w-5 h-5" />
      {count > 0 && (
        <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-neutral-900 text-[10px] font-bold flex items-center justify-center">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
