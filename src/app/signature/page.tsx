import type { Metadata } from "next";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { ShelfShop } from "@/lib/home-shelves";
import { SIGNATURE_KINDS, isSignatureKind } from "@/lib/signature";
import { getLocale } from "@/lib/get-locale";
import { getDictionary } from "@/lib/i18n";
import { getSiteUrl } from "@/lib/site";
import { ShopCard } from "@/components/shop-card";
import { IconSeal, IconShield, IconLock, IconHeart } from "@/components/dash-icons";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return {
    title: `${t.signature.pageTitle} | Buyam Sellam`,
    description: t.signature.pageIntro,
    alternates: { canonical: `${getSiteUrl()}/signature` },
  };
}

const SHOP_SELECT =
  "id, shop_name, slug, city, logo_url, cover_url, is_verified, description, signature_status, signature_kind, signature_founder, signature_founded_year, made_in_cameroon, signature_story";

// Buyam Sellam Signature: the shops of names people already know —
// brands, designers, personalities, makers, reference boutiques — each
// checked by hand. Plus the shops buyers love most this month, ranked
// by what actually happened (sales, follows, views, reviews).
export default async function SignaturePage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { kind } = await searchParams;
  const activeKind = isSignatureKind(kind) ? kind : null;
  const kinds = t.signature.kinds as Record<string, string>;

  let signature: ShelfShop[] = [];
  let loved: ShelfShop[] = [];
  if (isSupabaseConfigured) {
    let query = supabase.from("shops").select(SHOP_SELECT).eq("is_active", true).eq("signature_status", "approved");
    if (activeKind) query = query.eq("signature_kind", activeKind);
    const [{ data: sigRows }, { data: scoreRows }] = await Promise.all([
      query.order("signature_reviewed_at", { ascending: false }).limit(60),
      supabase.rpc("shop_popularity", { p_days: 30, p_limit: 12 }),
    ]);
    signature = (sigRows ?? []) as ShelfShop[];
    const ids = ((scoreRows ?? []) as { shop_id: string }[]).map((r) => r.shop_id);
    if (ids.length) {
      const { data } = await supabase.from("shops").select(SHOP_SELECT).in("id", ids);
      loved = ids.map((id) => ((data ?? []) as ShelfShop[]).find((s) => s.id === id)).filter((s): s is ShelfShop => Boolean(s));
    }
  }

  return (
    <div>
      <section className="bg-neutral-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300 flex items-center gap-2">
            <IconSeal className="w-5 h-5" /> Buyam Sellam Signature
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold mt-3 max-w-2xl">{t.signature.pageHeadline}</h1>
          <p className="text-neutral-300 mt-3 max-w-xl">{t.signature.pageIntro}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/signature"
              className={`rounded-full px-4 py-1.5 text-sm border ${!activeKind ? "bg-amber-400 text-neutral-900 border-amber-400 font-semibold" : "border-white/30 hover:border-white"}`}
            >
              {t.browse.all}
            </Link>
            {SIGNATURE_KINDS.map((k) => (
              <Link
                key={k}
                href={`/signature?kind=${k}`}
                className={`rounded-full px-4 py-1.5 text-sm border ${activeKind === k ? "bg-amber-400 text-neutral-900 border-amber-400 font-semibold" : "border-white/30 hover:border-white"}`}
              >
                {kinds[k]}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        {signature.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
            <IconSeal className="w-8 h-8 mx-auto text-amber-600" />
            <p className="font-semibold mt-3">{t.signature.emptyTitle}</p>
            <p className="text-sm text-neutral-500 mt-1 max-w-md mx-auto">{t.signature.emptyBody}</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {signature.map((shop) => (
              <ShopCard key={shop.id} shop={shop} t={t} feature />
            ))}
          </div>
        )}
      </section>

      {loved.length > 0 && (
        <section id="loved" className="mx-auto max-w-6xl px-4 pb-10">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <IconHeart className="w-5 h-5 text-amber-600" /> {t.shelves.popularShopsTitle}
          </h2>
          <p className="text-sm text-neutral-500 mb-4">{t.signature.lovedExplain}</p>
          <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {loved.map((shop, i) => (
              <li key={shop.id} className="relative">
                <span className="absolute -top-2 -left-2 z-10 w-7 h-7 rounded-full bg-neutral-900 text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <ShopCard shop={shop} t={t} />
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="bg-white border-y border-neutral-200">
        <div className="mx-auto max-w-6xl px-4 py-10 grid sm:grid-cols-3 gap-8 text-sm">
          <div>
            <IconShield className="w-5 h-5" />
            <p className="font-semibold mt-2">{t.signature.why1Title}</p>
            <p className="text-neutral-500 mt-1">{t.signature.why1Body}</p>
          </div>
          <div>
            <IconSeal className="w-5 h-5" />
            <p className="font-semibold mt-2">{t.signature.why2Title}</p>
            <p className="text-neutral-500 mt-1">{t.signature.why2Body}</p>
          </div>
          <div>
            <IconLock className="w-5 h-5" />
            <p className="font-semibold mt-2">{t.signature.why3Title}</p>
            <p className="text-neutral-500 mt-1">{t.signature.why3Body}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 text-center">
        <p className="text-xl font-bold">{t.signature.ctaTitle}</p>
        <p className="text-sm text-neutral-500 mt-1 max-w-lg mx-auto">{t.signature.ctaBody}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard" className="rounded-full bg-neutral-900 text-white font-semibold px-6 py-2.5 text-sm hover:bg-neutral-700">
            {t.signature.ctaSeller}
          </Link>
          <Link href="/sell" className="rounded-full border border-neutral-300 font-semibold px-6 py-2.5 text-sm hover:border-neutral-900">
            {t.home.openShopCta}
          </Link>
        </div>
      </section>
    </div>
  );
}
