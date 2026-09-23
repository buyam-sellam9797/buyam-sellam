import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/i18n";
import { getSiteUrl } from "@/lib/site";
import { GUIDES, getGuide } from "@/lib/guides";

// Guides are static content, so every one is prerendered at build time.
export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  const site = getSiteUrl();
  const url = `${site}/guides/${guide.slug}`;
  const altUrl = `${site}/guides/${guide.altSlug}`;
  const enUrl = guide.lang === "en" ? url : altUrl;
  const frUrl = guide.lang === "fr" ? url : altUrl;
  return {
    title: `${guide.title} | Buyam Sellam`,
    description: guide.description,
    alternates: {
      canonical: url,
      languages: { en: enUrl, fr: frUrl, "x-default": enUrl },
    },
    openGraph: {
      title: guide.title,
      description: guide.description,
      url,
      type: "article",
      locale: guide.lang === "fr" ? "fr_CM" : "en_CM",
      modifiedTime: guide.updated,
    },
  };
}

function anchorId(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// One guide. The article is always shown in its own language (the
// English and French versions are separate pages), so its labels come
// from that language's dictionary rather than the visitor's interface
// language — a French article reads fully in French even for someone
// whose header is set to English.
export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const t = getDictionary(guide.lang);
  const site = getSiteUrl();
  const url = `${site}/guides/${guide.slug}`;
  const related = guide.related.map((s) => getGuide(s)).filter((g): g is NonNullable<typeof g> => Boolean(g));
  const updated = new Date(guide.updated).toLocaleDateString(guide.lang === "fr" ? "fr-FR" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const isSellerGuide = guide.topic === "sellers";

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    inLanguage: guide.lang,
    datePublished: guide.updated,
    dateModified: guide.updated,
    mainEntityOfPage: url,
    author: { "@type": "Organization", name: "Buyam Sellam", url: site },
    publisher: { "@type": "Organization", name: "Buyam Sellam", url: site },
  };
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: guide.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Buyam Sellam", item: site },
      { "@type": "ListItem", position: 2, name: t.guides.navLabel, item: `${site}/guides` },
      { "@type": "ListItem", position: 3, name: guide.title, item: url },
    ],
  };

  return (
    <article lang={guide.lang} className="mx-auto max-w-3xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <nav className="text-xs text-neutral-500 mb-4 flex flex-wrap items-center gap-x-1">
        <Link href="/" className="hover:text-amber-600">
          {t.guides.home}
        </Link>
        <span>/</span>
        <Link href="/guides" className="hover:text-amber-600">
          {t.guides.navLabel}
        </Link>
      </nav>

      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">{guide.title}</h1>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 mt-4 mb-8">
        <span>{t.guides.minRead.replace("{n}", String(guide.readMinutes))}</span>
        <span aria-hidden>·</span>
        <span>
          {t.guides.updated} {updated}
        </span>
        <span aria-hidden>·</span>
        <Link
          href={`/guides/${guide.altSlug}`}
          hrefLang={guide.lang === "en" ? "fr" : "en"}
          className="font-semibold text-neutral-900 underline underline-offset-2 hover:text-amber-600"
        >
          {t.guides.readInOther}
        </Link>
      </div>

      <div className="space-y-4 text-[17px] leading-relaxed text-neutral-800">
        {guide.intro.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      <nav className="my-8 rounded-2xl border border-neutral-200 bg-white p-5" aria-label={t.guides.contents}>
        <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">{t.guides.contents}</p>
        <ol className="space-y-1.5 text-sm list-decimal list-inside">
          {guide.sections.map((s) => (
            <li key={s.heading}>
              <a href={`#${anchorId(s.heading)}`} className="text-neutral-700 hover:text-amber-600">
                {s.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {guide.sections.map((s) => (
        <section key={s.heading} id={anchorId(s.heading)} className="mt-10 scroll-mt-20">
          <h2 className="text-2xl font-bold tracking-tight mb-4">{s.heading}</h2>
          <div className="space-y-4 text-[17px] leading-relaxed text-neutral-800">
            {s.paragraphs?.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {s.bullets && (
              <ul className="list-disc pl-6 space-y-2">
                {s.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
            {s.steps && (
              <ol className="list-decimal pl-6 space-y-2">
                {s.steps.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ol>
            )}
          </div>
        </section>
      ))}

      <aside className="mt-12 rounded-2xl bg-neutral-900 text-white p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3">{t.guides.keyTakeaways}</p>
        <ul className="space-y-2 text-sm text-neutral-200">
          {guide.keyTakeaways.map((k, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-amber-400" aria-hidden>
                ✓
              </span>
              <span>{k}</span>
            </li>
          ))}
        </ul>
      </aside>

      <section className="mt-12">
        <h2 className="text-2xl font-bold tracking-tight mb-4">{t.guides.faqTitle}</h2>
        <div className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white">
          {guide.faq.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="cursor-pointer font-semibold list-none flex justify-between gap-4">
                {f.q}
                <span className="text-neutral-400 group-open:rotate-45 transition" aria-hidden>
                  +
                </span>
              </summary>
              <p className="text-neutral-700 mt-3 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <aside className="mt-12 rounded-2xl border border-neutral-200 bg-amber-50 p-6">
        <p className="font-bold text-lg">{isSellerGuide ? t.guides.ctaSellerTitle : t.guides.ctaBuyerTitle}</p>
        <p className="text-sm text-neutral-700 mt-2 mb-4">{isSellerGuide ? t.guides.ctaSellerBody : t.guides.ctaBuyerBody}</p>
        <Link
          href={isSellerGuide ? "/signup?role=seller" : "/browse"}
          className="inline-block rounded-full bg-neutral-900 text-white text-sm font-semibold px-5 py-2.5 hover:bg-neutral-700"
        >
          {isSellerGuide ? t.guides.ctaSellerButton : t.guides.ctaBuyerButton}
        </Link>
      </aside>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">{t.guides.relatedTitle}</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {related.map((g) => (
              <Link
                key={g.slug}
                href={`/guides/${g.slug}`}
                className="rounded-xl border border-neutral-200 bg-white p-4 text-sm font-semibold hover:border-neutral-900"
              >
                {g.title}
              </Link>
            ))}
          </div>
          <Link href="/guides" className="inline-block mt-4 text-sm text-neutral-600 hover:text-amber-600 underline underline-offset-2">
            {t.guides.allGuides}
          </Link>
        </section>
      )}
    </article>
  );
}
