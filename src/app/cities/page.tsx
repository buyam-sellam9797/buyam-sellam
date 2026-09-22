import Link from "next/link";
import type { Metadata } from "next";
import { getActiveProducts } from "@/lib/supabase";
import { CITIES } from "@/lib/cities";
import { getLocale } from "@/lib/get-locale";
import { getDictionary, plural } from "@/lib/i18n";
import { getSiteUrl } from "@/lib/site";
import { IconPin } from "@/components/dash-icons";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const url = `${getSiteUrl()}/cities`;
  const title = "Shop by City — Buyam Sellam";
  const description =
    "Find Buyam Sellam sellers and shop fashion and beauty products by city across Cameroon, from Douala and Yaoundé to Bamenda and Buea.";
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
  };
}

// The hub linking every city landing page (see /shop-in/[city]) — this
// is what lets search engines (and buyers) discover the full set of
// city pages from one place instead of needing every one of them
// linked from the homepage. Counts are real, live numbers, not
// decoration: a city with zero listings says so plainly instead of
// looking identical to one with active sellers.
export default async function CitiesPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  const counts = await Promise.all(
    CITIES.map((c) => getActiveProducts(undefined, { city: c.name }).then((p) => p.length))
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">{t.cities.hubTitle}</h1>
      <p className="text-neutral-500 text-sm mb-8">{t.cities.hubSubtitle}</p>

      <div className="grid sm:grid-cols-2 gap-3">
        {CITIES.map((c, i) => {
          const count = counts[i];
          return (
            <Link
              key={c.slug}
              href={`/shop-in/${c.slug}`}
              className="rounded-xl border border-neutral-200 bg-white p-4 flex items-center justify-between hover:border-amber-500 transition"
            >
              <span>
                <span className="font-semibold flex items-center gap-1.5">
                  <IconPin className="w-3.5 h-3.5 text-amber-600 shrink-0" /> {c.name}
                </span>
                <span className="text-xs text-neutral-500">{c.region}</span>
              </span>
              <span className="text-xs font-medium text-neutral-500">
                {count > 0
                  ? `${count} ${plural(count, locale, t.browse.itemOne, t.browse.itemOther)}`
                  : t.cities.comingSoon}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
