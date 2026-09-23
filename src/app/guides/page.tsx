import Link from "next/link";
import type { Metadata } from "next";
import { getLocale } from "@/lib/get-locale";
import { getDictionary } from "@/lib/i18n";
import { getSiteUrl } from "@/lib/site";
import { getGuidesByLang, type Guide, type GuideTopic } from "@/lib/guides";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  const url = `${getSiteUrl()}/guides`;
  return {
    title: t.guides.metaTitle,
    description: t.guides.metaDescription,
    alternates: { canonical: url },
    openGraph: { title: t.guides.metaTitle, description: t.guides.metaDescription, url, type: "website" },
  };
}

const TOPICS: GuideTopic[] = ["buyers", "payments", "sellers"];

// Guides hub. Lists every guide in the visitor's language first,
// grouped by topic, then the same guides in the other language — so
// both language versions are always linked from one crawlable page.
export default async function GuidesPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const other = locale === "en" ? "fr" : "en";
  const mine = getGuidesByLang(locale);
  const theirs = getGuidesByLang(other);
  const topicLabel = (topic: GuideTopic) =>
    topic === "buyers" ? t.guides.topicBuyers : topic === "sellers" ? t.guides.topicSellers : t.guides.topicPayments;

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: [...mine, ...theirs].map((g, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${getSiteUrl()}/guides/${g.slug}`,
      name: g.title,
    })),
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <nav className="text-xs text-neutral-500 mb-3">
        <Link href="/" className="hover:text-amber-600">
          {t.guides.home}
        </Link>{" "}
        / {t.guides.navLabel}
      </nav>
      <h1 className="text-3xl font-bold tracking-tight mb-3 max-w-3xl">{t.guides.title}</h1>
      <p className="text-neutral-600 max-w-2xl mb-10">{t.guides.subtitle}</p>

      {TOPICS.map((topic) => {
        const list = mine.filter((g) => g.topic === topic);
        if (list.length === 0) return null;
        return (
          <section key={topic} className="mb-10">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">{topicLabel(topic)}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {list.map((g) => (
                <GuideCard key={g.slug} guide={g} minRead={t.guides.minRead} />
              ))}
            </div>
          </section>
        );
      })}

      <section className="border-t border-neutral-200 pt-8" lang={other}>
        <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">{t.guides.otherLangHeading}</h2>
        <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {theirs.map((g) => (
            <li key={g.slug}>
              <Link href={`/guides/${g.slug}`} className="text-neutral-700 hover:text-amber-600 underline-offset-2 hover:underline">
                {g.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function GuideCard({ guide, minRead }: { guide: Guide; minRead: string }) {
  return (
    <Link
      href={`/guides/${guide.slug}`}
      className="group rounded-2xl border border-neutral-200 bg-white p-5 hover:border-neutral-900 transition flex flex-col"
    >
      <p className="font-semibold leading-snug group-hover:text-amber-700">{guide.title}</p>
      <p className="text-sm text-neutral-600 mt-2 flex-1">{guide.excerpt}</p>
      <p className="text-xs text-neutral-400 mt-4">{minRead.replace("{n}", String(guide.readMinutes))}</p>
    </Link>
  );
}
