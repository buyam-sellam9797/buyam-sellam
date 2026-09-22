import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActiveProducts } from "@/lib/supabase";
import { getCityBySlug, CITIES } from "@/lib/cities";
import { formatFcfa } from "@/lib/format";
import { getLocale } from "@/lib/get-locale";
import { getDictionary, plural } from "@/lib/i18n";
import { getSiteUrl } from "@/lib/site";
import { IconBag, IconPin, StatusDot } from "@/components/dash-icons";
import { FavoriteButton } from "@/components/favorite-button";

export const dynamic = "force-dynamic";

// A dedicated landing page per Cameroonian city (see src/lib/cities.ts
// for the curated list) — real, live listings from sellers based there
// when there are any, and an honest "not yet, but delivery still
// reaches you" page when there aren't. Exists mainly so the site has
// something to rank for "buy <product> in <city>" searches ahead of
// actual seller coverage, without pretending inventory exists where it
// doesn't (see the noindex logic below).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city: slug } = await params;
  const city = getCityBySlug(slug);
  if (!city) return {};

  const products = await getActiveProducts(undefined, { city: city.name });
  const url = `${getSiteUrl()}/shop-in/${slug}`;
  const title = `Buy Fashion & Beauty Online in ${city.name} | Buyam Sellam`;
  const description =
    products.length > 0
      ? `Shop fashion and beauty products from sellers in ${city.name}, Cameroon on Buyam Sellam. Pay by MTN MoMo or Orange Money, held safely until you confirm delivery.`
      : `Buyam Sellam ships to ${city.name}, Cameroon — pay by MTN MoMo or Orange Money, held safely in escrow until delivery is confirmed with the seller over WhatsApp.`;

  return {
    title,
    description,
    alternates: { canonical: url },
    // No point indexing "0 sellers in <city>" as a search result — see
    // the matching comment on the category page's generateMetadata for
    // why this stays live and linked rather than being removed outright.
    robots: products.length > 0 ? undefined : { index: false, follow: true },
    openGraph: { title, description, url, type: "website" },
  };
}

export default async function CityPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { city: slug } = await params;
  const city = getCityBySlug(slug);
  if (!city) notFound();

  const products = await getActiveProducts(undefined, { city: city.name });
  const otherCities = CITIES.filter((c) => c.slug !== slug).slice(0, 8);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Buyam Sellam", item: getSiteUrl() },
      { "@type": "ListItem", position: 2, name: city.name, item: `${getSiteUrl()}/shop-in/${slug}` },
    ],
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <nav className="text-xs text-neutral-500 mb-3">
        <Link href="/" className="hover:text-amber-600">
          Buyam Sellam
        </Link>{" "}
        / {city.name}
      </nav>

      <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
        <IconPin className="w-5 h-5 text-amber-600 shrink-0" /> {city.name}
      </h1>
      <p className="text-xs text-neutral-500 mb-4">
        {t.cities.regionLabel}: {city.region}, Cameroon
      </p>
      <p className="text-neutral-600 text-sm max-w-2xl mb-6">
        {(products.length > 0 ? t.cities.pageIntro : t.cities.pageIntroEmpty).replace("{city}", city.name)}
      </p>

      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center mb-10">
          <Link
            href="/sell"
            className="inline-block rounded-full bg-amber-500 text-neutral-900 font-semibold px-5 py-2.5 text-sm hover:bg-amber-400 mr-2"
          >
            {t.cities.openShopCta.replace("{city}", city.name)}
          </Link>
          <Link
            href="/browse"
            className="inline-block rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold hover:border-neutral-900 mt-2 sm:mt-0"
          >
            {t.cities.browseAllCta}
          </Link>
        </div>
      ) : (
        <>
          <p className="text-neutral-500 text-sm mb-4">
            {products.length} {plural(products.length, locale, t.browse.itemOne, t.browse.itemOther)}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
            {products.map((p) => (
              <Link
                key={p.id}
                href={`/product/${p.id}`}
                className="rounded-xl border border-neutral-200 bg-white overflow-hidden hover:shadow-md transition"
              >
                <div className="relative aspect-square bg-neutral-100 flex items-center justify-center overflow-hidden">
                  <div className="absolute top-2 right-2 z-10">
                    <FavoriteButton productId={p.id} size="sm" />
                  </div>
                  {p.image_urls?.[0] ? (
                    <Image
                      src={p.image_urls[0]}
                      alt={p.title}
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-cover"
                    />
                  ) : (
                    <IconBag className="w-10 h-10 text-neutral-300" />
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium line-clamp-1">{p.title}</p>
                  <p className="text-xs text-neutral-500 mt-0.5 flex items-center gap-1">
                    {p.shop?.shop_name}
                    {p.shop?.is_verified && (
                      <StatusDot tone="success" className="inline-block w-1.5 h-1.5 rounded-full shrink-0" />
                    )}
                  </p>
                  <p className="text-sm font-semibold mt-1">{formatFcfa(p.price_fcfa)}</p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="border-t border-neutral-200 pt-6">
        <p className="text-xs font-semibold text-neutral-500 mb-3">{t.cities.otherCities}</p>
        <div className="flex flex-wrap gap-2">
          {otherCities.map((c) => (
            <Link
              key={c.slug}
              href={`/shop-in/${c.slug}`}
              className="text-sm rounded-full px-4 py-1.5 border border-neutral-300 hover:border-neutral-900"
            >
              {c.name}
            </Link>
          ))}
          <Link
            href="/cities"
            className="text-sm rounded-full px-4 py-1.5 border border-neutral-300 hover:border-neutral-900 text-amber-600"
          >
            {t.cities.hubTitle}
          </Link>
        </div>
      </div>
    </div>
  );
}
