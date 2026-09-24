import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getAdminClient } from "@/lib/supabase-admin";
import { getSharedBagByToken, isSharedBagOpen, pricingInputFor, firstName } from "@/lib/shared-bags";
import { resolveBagPricing } from "@/lib/order-pricing";
import { formatFcfa, formatEurFromFcfa } from "@/lib/format";
import { getLocale } from "@/lib/get-locale";
import { getDictionary } from "@/lib/i18n";
import { IconBag, IconLock, IconShield, IconGift, IconCheckCircle } from "@/components/dash-icons";
import { PayForm } from "./pay-form";

export const dynamic = "force-dynamic";

// A private link, not a page for search engines or link previews to keep.
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Someone was asked to pay for a bag. They see what's in it, where it
// goes (first name and city only) and the total in FCFA and euros,
// then pay by Mobile Money or card. The order belongs to the person
// who asked.
export default async function PayForSomeonePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { token } = await params;
  const { paid } = await searchParams;
  const admin = getAdminClient();
  if (!admin) notFound();
  const bag = await getSharedBagByToken(admin, token);
  if (!bag) notFound();

  const name = firstName(bag.delivery.name) || "—";
  const fill = (s: string) => s.replaceAll("{name}", name);

  if (paid === "1" || bag.status === "paid") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-green-50 text-green-700 flex items-center justify-center">
          <IconCheckCircle className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold mb-2">{bag.status === "paid" && paid !== "1" ? t.payForMe.closedTitle : t.payForMe.paidTitle}</h1>
        <p className="text-sm text-neutral-600">
          {bag.status === "paid" && paid !== "1" ? t.payForMe.closedPaid : fill(t.payForMe.paidBody)}
        </p>
      </div>
    );
  }

  if (!isSharedBagOpen(bag)) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-bold mb-2">{t.payForMe.closedTitle}</h1>
        <p className="text-sm text-neutral-600">{t.payForMe.closedExpired}</p>
      </div>
    );
  }

  const pricing = await resolveBagPricing(admin, pricingInputFor(bag));
  const { data: shop } = await admin.from("shops").select("shop_name, city, is_verified").eq("id", bag.shop_id).maybeSingle();
  const { data: images } = await admin.from("products").select("id, image_urls").in("id", bag.items.map((i) => i.productId));
  const imageFor = (id: string) => ((images ?? []).find((p) => p.id === id)?.image_urls as string[] | undefined)?.[0];

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="rounded-2xl bg-neutral-900 text-white p-5 mb-5">
        <p className="text-xs font-semibold tracking-wide text-amber-300 uppercase inline-flex items-center gap-1.5">
          <IconGift className="w-4 h-4" /> Buyam Sellam
        </p>
        <h1 className="text-xl font-bold mt-2">{fill(t.payForMe.payTitle)}</h1>
        <p className="text-sm text-neutral-300 mt-2">{fill(t.payForMe.payIntro).replace("{city}", bag.delivery.city)}</p>
        {bag.note && (
          <div className="mt-4 rounded-xl bg-white/10 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-neutral-400 mb-1">{fill(t.payForMe.payNote)}</p>
            <p className="text-sm">“{bag.note}”</p>
          </div>
        )}
      </div>

      {!pricing.ok ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{pricing.error}</p>
      ) : (
        <>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 mb-5">
            <p className="text-xs font-semibold text-neutral-500 mb-3 inline-flex items-center gap-1.5">
              {shop?.shop_name}
              {shop?.is_verified && <IconShield className="w-3.5 h-3.5 text-green-700" />}
              <span className="font-normal">· {shop?.city}</span>
            </p>
            <ul className="flex flex-col gap-3">
              {pricing.lines.map((l) => {
                const img = imageFor(l.product.id);
                return (
                  <li key={l.product.id} className="flex items-center gap-3">
                    <div className="relative w-12 h-12 rounded-lg bg-neutral-100 overflow-hidden flex items-center justify-center shrink-0">
                      {img ? <Image src={img} alt={l.product.title} fill sizes="48px" className="object-cover" /> : <IconBag className="w-5 h-5 text-neutral-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{l.product.title}</p>
                      <p className="text-xs text-neutral-500">
                        {l.quantity} × {formatFcfa(l.unitPriceFcfa)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold">{formatFcfa(l.unitPriceFcfa * l.quantity)}</span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 pt-3 border-t border-neutral-100 text-sm flex flex-col gap-1">
              {pricing.deliveryFeeFcfa > 0 && (
                <p className="flex justify-between">
                  <span className="text-neutral-500">{t.checkout.deliveryFeeLabel}</span>
                  <span>{formatFcfa(pricing.deliveryFeeFcfa)}</span>
                </p>
              )}
              <p className="flex justify-between font-bold text-base">
                <span>{t.checkout.totalLabel}</span>
                <span>{formatFcfa(pricing.totalAmountFcfa)}</span>
              </p>
              <p className="text-right text-xs text-neutral-500">
                {t.payForMe.euroNote.replace("{eur}", formatEurFromFcfa(pricing.totalAmountFcfa, locale))}
              </p>
            </div>
          </div>
          <PayForm
            token={bag.token}
            recipient={name}
            total={pricing.totalAmountFcfa}
            cardsEnabled={process.env.NOTCHPAY_CARDS_ENABLED === "true"}
          />
          <p className="mt-4 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 inline-flex items-start gap-1.5">
            <IconLock className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {t.checkout.protectionNotice}
          </p>
        </>
      )}
    </div>
  );
}
