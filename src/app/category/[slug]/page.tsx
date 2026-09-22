import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategories, getActiveProducts } from "@/lib/supabase";
import { formatFcfa } from "@/lib/format";
import { getLocale } from "@/lib/get-locale";
import { getDictionary, plural } from "@/lib/i18n";
import { getSiteUrl } from "@/lib/site";
import { IconBag, StatusDot } from "@/components/dash-icons";
import { FavoriteButton } from "@/components/favorite-button";

export const dynamic = "force-dynamic";

// A dedicated, crawlable landing page per category (beauty-cosmetics,
// hair-wigs, mens-fashion, shoes-accessories, womens-fashion) — the
// same filtered product set /browse?category=X already shows, but as
// its own indexable URL with real copy and its own <title>, instead of
// a query-string variant of the browse page that search engines treat
// as one interchangeable page. Linked from the homepage's "shop by
// category" grid.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const categories = await getCategories();
  const category = categories.find((c) => c.slug === slug);
  if (!category) return {};

  const products = await getActiveProducts(slug);
  const url = `${getSiteUrl()}/category/${slug}`;
  const title = `${category.name} — Buy Online in Cameroon | Buyam Sellam`;
  const description = `Shop ${category.name} from independent sellers across Cameroon on Buyam Sellam. Pay by MTN MoMo or Orange Money, held safely until you confirm delivery.`;

  return {
    title,
    description,
    alternates: { canonical: url },
    // A category with nothing listed yet is a real, permanent part of
    // the site's taxonomy, not a broken or abandoned page — but there's
    // no point asking search engines to index an empty results page.
    // It stays live and linked (so it's crawlable and ready to flip to
    // indexable the moment a seller lists something) with just this
    // one flag withholding it from search results until then.
    robots: products.length > 0 ? undefined : { index: false, follow: true },
    openGraph: { title, description, url, type: "website" },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { slug } = await params;
  const categories = await getCategories();
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();

  const products = await getActiveProducts(slug);
  const description = t.category.descriptions[slug as keyof typeof t.category.descriptions];
  const otherCategories = categories.filter((c) => c.slug !== slug);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Buyam Sellam", item: getSiteUrl() },
      { "@type": "ListItem", position: 2, name: category.name, item: `${getSiteUrl()}/category/${slug}` },
    ],
  };
  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: category.name,
    description,
    url: `${getSiteUrl()}/category/${slug}`,
    ...(products.length > 0
      ? {
          mainEntity: {
            "@type": "ItemList",
            itemListElement: products.slice(0, 24).map((p, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: `${getSiteUrl()}/product/${p.id}`,
            })),
          },
        }
      : {}),
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />

      <nav className="text-xs text-neutral-500 mb-3">
        <Link href="/" className="hover:text-amber-600">
          Buyam Sellam
        </Link>{" "}
        / {category.name}
      </nav>

      <h1 className="text-2xl font-bold mb-2">{category.name}</h1>
      {description && <p className="text-neutral-600 text-sm max-w-2xl mb-4">{description}</p>}
      <p className="text-neutral-500 text-sm mb-6">
        {products.length > 0
          ? t.category.itemsAvailable.replace("{count}", String(products.length))
          : `0 ${plural(0, locale, t.browse.itemOne, t.browse.itemOther)}`}
      </p>

      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center">
          <p className="font-semibold mb-1">{t.category.emptyStateTitle}</p>
          <p className="text-sm text-neutral-500 mb-4">{t.category.emptyStateBody}</p>
          <Link
            href="/browse"
            className="inline-block rounded-full bg-neutral-900 text-white px-5 py-2 text-sm font-semibold hover:bg-neutral-700"
          >
            {t.category.emptyStateCta}
          </Link>
        </div>
      ) : (
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
      )}

      <div className="border-t border-neutral-200 pt-6">
        <p className="text-xs font-semibold text-neutral-500 mb-3">{t.category.browseAll}</p>
        <div className="flex flex-wrap gap-2">
          {otherCategories.map((c) => (
            <Link
              key={c.id}
              href={`/category/${c.slug}`}
              className="text-sm rounded-full px-4 py-1.5 border border-neutral-300 hover:border-neutral-900"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
