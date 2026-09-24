"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { formatFcfa } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";
import { offerErrorText, type OfferApiError } from "@/components/offer-sheet";
import { IconBag, IconHandshake, IconGift } from "@/components/dash-icons";

type T = ReturnType<typeof useLocale>["t"];

type OfferItem = {
  id: string;
  product_id: string;
  amount_fcfa: number;
  counter_fcfa: number | null;
  agreed_fcfa: number | null;
  status: "pending" | "countered" | "accepted" | "declined" | "withdrawn" | "expired" | "paid";
  expires_at: string;
  pay_by: string | null;
  created_at: string;
  product: { title: string; image_urls: string[]; price_fcfa: number; sale_price_fcfa: number | null } | null;
  shop: { shop_name: string } | null;
};

function liveStatus(o: Pick<OfferItem, "status" | "expires_at" | "pay_by">, now: number): OfferItem["status"] {
  if ((o.status === "pending" || o.status === "countered") && new Date(o.expires_at).getTime() < now) return "expired";
  if (o.status === "accepted" && o.pay_by && new Date(o.pay_by).getTime() < now) return "expired";
  return o.status;
}

const hours = (iso: string | null, now: number) => (iso ? Math.max(1, Math.ceil((new Date(iso).getTime() - now) / 3600_000)) : 0);

// Buyer's offers, newest first: what's waiting, what's countered, which
// deals are ready to pay (and how long is left).
export function MyOffersSection({ t }: { t: T }) {
  const [offers, setOffers] = useState<OfferItem[] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    const user = session.session?.user;
    if (!user) return;
    setToken(session.session?.access_token ?? null);
    const { data } = await supabase
      .from("offers")
      .select("id, product_id, amount_fcfa, counter_fcfa, agreed_fcfa, status, expires_at, pay_by, created_at, product:products(title, image_urls, price_fcfa, sale_price_fcfa), shop:shops(shop_name)")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setNow(Date.now());
    setOffers((data ?? []) as unknown as OfferItem[]);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function act(id: string, action: "accept_counter" | "decline_counter" | "withdraw") {
    if (!token) return;
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/offers/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) setError(offerErrorText(t, (await res.json().catch(() => ({}))) as OfferApiError));
    await load();
    setBusyId(null);
  }

  if (offers === null || offers.length === 0) {
    return offers === null ? null : (
      <section id="offers">
        <h2 className="text-sm font-semibold mb-3">{t.offers.accountTitle}</h2>
        <p className="text-sm text-neutral-500">{t.offers.accountEmpty}</p>
      </section>
    );
  }

  return (
    <section id="offers">
      <h2 className="text-sm font-semibold mb-3 inline-flex items-center gap-1.5">
        <IconHandshake className="w-4 h-4" /> {t.offers.accountTitle}
      </h2>
      {error && <p className="mb-3 text-sm text-red-700">{error}</p>}
      <ul className="flex flex-col divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
        {offers.map((o) => {
          const status = liveStatus(o, now);
          const img = o.product?.image_urls?.[0];
          let line: string;
          if (status === "accepted" && o.agreed_fcfa) line = `${t.offers.statusAccepted.replace("{amount}", formatFcfa(o.agreed_fcfa))} ${t.offers.statusAcceptedNote.replace("{hours}", String(hours(o.pay_by, now)))}`;
          else if (status === "countered" && o.counter_fcfa) line = `${t.offers.statusCountered.replace("{amount}", formatFcfa(o.counter_fcfa))} ${t.offers.statusCounteredNote.replace("{hours}", String(hours(o.expires_at, now)))}`;
          else if (status === "pending") line = `${t.offers.statusPending.replace("{amount}", formatFcfa(o.amount_fcfa))} ${t.offers.statusPendingLeft.replace("{hours}", String(hours(o.expires_at, now)))}`;
          else if (status === "paid" && o.agreed_fcfa) line = t.offers.statusPaid.replace("{amount}", formatFcfa(o.agreed_fcfa));
          else if (status === "declined") line = t.offers.statusDeclined.replace("{amount}", formatFcfa(o.amount_fcfa));
          else if (status === "expired") line = t.offers.statusExpired.replace("{amount}", formatFcfa(o.amount_fcfa));
          else line = t.offers.statusWithdrawn;
          return (
            <li key={o.id} className="flex gap-3 px-4 py-3">
              <Link href={`/product/${o.product_id}`} className="relative w-14 h-14 rounded-lg bg-neutral-100 overflow-hidden shrink-0 flex items-center justify-center">
                {img ? <Image src={img} alt={o.product?.title ?? ""} fill sizes="56px" className="object-cover" /> : <IconBag className="w-5 h-5 text-neutral-300" />}
              </Link>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{o.product?.title ?? "—"}</p>
                <p className="text-xs text-neutral-500">{o.shop?.shop_name}</p>
                <p className={`text-xs mt-1 ${status === "accepted" ? "text-green-800 font-semibold" : status === "countered" ? "text-amber-900 font-semibold" : "text-neutral-600"}`}>
                  {line}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {status === "accepted" && o.agreed_fcfa && (
                    <Link href={`/checkout/${o.product_id}?offer=${o.id}`} className="rounded-full bg-green-700 text-white text-xs font-semibold px-3 py-1.5">
                      {t.offers.payDeal.replace("{amount}", formatFcfa(o.agreed_fcfa))}
                    </Link>
                  )}
                  {status === "countered" && o.counter_fcfa && (
                    <>
                      <button type="button" disabled={busyId === o.id} onClick={() => act(o.id, "accept_counter")} className="rounded-full bg-neutral-900 text-white text-xs font-semibold px-3 py-1.5 disabled:opacity-50">
                        {t.offers.acceptCounter.replace("{amount}", formatFcfa(o.counter_fcfa))}
                      </button>
                      <button type="button" disabled={busyId === o.id} onClick={() => act(o.id, "decline_counter")} className="rounded-full border border-neutral-300 text-xs font-semibold px-3 py-1.5 disabled:opacity-50">
                        {t.offers.declineCounter}
                      </button>
                    </>
                  )}
                  {status === "pending" && (
                    <button type="button" disabled={busyId === o.id} onClick={() => act(o.id, "withdraw")} className="text-xs font-semibold underline text-neutral-600 disabled:opacity-50">
                      {t.offers.withdraw}
                    </button>
                  )}
                  {(status === "declined" || status === "expired" || status === "withdrawn") && (
                    <Link href={`/product/${o.product_id}`} className="text-xs font-semibold underline text-neutral-600">
                      {t.offers.accountSeeItem}
                    </Link>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type SharedBagItem = {
  id: string;
  token: string;
  status: "open" | "paid" | "cancelled";
  order_id: string | null;
  created_at: string;
  expires_at: string;
  items: { productId: string; quantity: number }[];
  shop: { shop_name: string } | null;
};

// "Pay for me" links this buyer created: open ones can be re-shared or
// cancelled, paid ones lead to the order.
export function SharedBagsSection({ t }: { t: T }) {
  const [bags, setBags] = useState<SharedBagItem[] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    const user = session.session?.user;
    if (!user) return;
    setToken(session.session?.access_token ?? null);
    const { data } = await supabase
      .from("shared_bags")
      .select("id, token, status, order_id, created_at, expires_at, items, shop:shops(shop_name)")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setNow(Date.now());
    setBags((data ?? []) as unknown as SharedBagItem[]);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function cancel(bagToken: string) {
    if (!token) return;
    setBusy(bagToken);
    await fetch(`/api/shared-bags/${bagToken}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    await load();
    setBusy(null);
  }

  if (!bags || bags.length === 0) return null;

  return (
    <section id="shared-bags">
      <h2 className="text-sm font-semibold mb-3 inline-flex items-center gap-1.5">
        <IconGift className="w-4 h-4" /> {t.payForMe.accountTitle}
      </h2>
      <ul className="flex flex-col divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
        {bags.map((b) => {
          const expired = b.status === "open" && new Date(b.expires_at).getTime() < now;
          const label =
            b.status === "paid"
              ? t.payForMe.accountStatusPaid
              : b.status === "cancelled"
                ? t.payForMe.accountStatusCancelled
                : expired
                  ? t.payForMe.accountStatusExpired
                  : t.payForMe.accountStatusOpen;
          const count = (b.items ?? []).reduce((n, i) => n + (Number(i.quantity) || 1), 0);
          return (
            <li key={b.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {b.shop?.shop_name ?? "—"} <span className="text-neutral-500 font-normal">· {count}</span>
                </p>
                <p className={`text-xs ${b.status === "paid" ? "text-green-700" : "text-neutral-500"}`}>{label}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                {b.status === "paid" && b.order_id && (
                  <Link href={`/order/${b.order_id}`} className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-semibold hover:border-neutral-900">
                    {t.payForMe.accountViewOrder}
                  </Link>
                )}
                {b.status === "open" && !expired && (
                  <>
                    <Link href={`/pay/${b.token}`} className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-semibold hover:border-neutral-900">
                      {t.payForMe.accountOpenLink}
                    </Link>
                    <button type="button" disabled={busy === b.token} onClick={() => cancel(b.token)} className="text-xs font-semibold underline text-neutral-600 disabled:opacity-50">
                      {t.payForMe.accountCancel}
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
