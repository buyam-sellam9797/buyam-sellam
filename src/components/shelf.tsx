import Link from "next/link";
import type { ReactNode } from "react";

// A homepage shelf: a titled row that scrolls sideways on phones (snap
// to each card) and becomes a tidy grid on larger screens.
export function Shelf({
  title,
  subtitle,
  href,
  seeAll,
  icon,
  children,
  tone = "plain",
  rows = 1,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  seeAll?: string;
  icon?: ReactNode;
  children: ReactNode;
  tone?: "plain" | "dark";
  // On larger screens: 1 = a single full row (extra items stay in the
  // phone's swipe row only), 2 = up to two rows.
  rows?: 1 | 2;
}) {
  const dark = tone === "dark";
  return (
    <section className={dark ? "bg-neutral-900 text-white" : ""}>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {icon}
              {title}
            </h2>
            {subtitle && <p className={`text-sm mt-0.5 ${dark ? "text-neutral-400" : "text-neutral-500"}`}>{subtitle}</p>}
          </div>
          {href && seeAll && (
            <Link href={href} className={`text-sm shrink-0 hover:underline ${dark ? "text-amber-300" : "text-amber-600"}`}>
              {seeAll}
            </Link>
          )}
        </div>
        <div
          className={`-mx-4 px-4 scroll-px-4 flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0 sm:grid sm:grid-cols-4 lg:grid-cols-5 sm:gap-4 sm:overflow-visible ${
            rows === 1
              ? "sm:[&>*:nth-child(n+5)]:hidden lg:[&>*:nth-child(5)]:block"
              : "sm:[&>*:nth-child(n+9)]:hidden lg:[&>*:nth-child(9)]:block lg:[&>*:nth-child(10)]:block"
          }`}
        >
          {children}
        </div>
      </div>
    </section>
  );
}

// Wraps one card so it has a phone-friendly width inside a Shelf.
export function ShelfItem({ children }: { children: ReactNode }) {
  return <div className="w-[44vw] max-w-[220px] shrink-0 snap-start sm:w-auto sm:max-w-none">{children}</div>;
}
