"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { formatFcfa } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import { offerErrorText, type OfferApiError } from "@/components/offer-sheet";
import { IconBag, IconClock, IconHandshake } from "@/components/dash-icons";

export type SellerOffer = {
  id: string;
  product_id: string;
  amount_fcfa: number;
  counter_fcfa: number | null;
  agreed_fcfa: number | null;
  message: string | null;
  status: "pending" | "countered" | "accepted" | "declined" | "withdrawn" | "expired" | "paid";
  auto_decided: boolean;
  expires_at: string;
  pay_by: string | null;
  created_at: string;
  buyer_name: string | null;
  product: { title: string; image_urls: string[]; price_fcfa: number; sale_price_fcfa: number | null } | null;
};

export function liveOfferStatus(o: Pick<SellerOffer, "status" | "expires_at" | "pay_by">, now: number): SellerOffer["status"] {
  if ((o.status === "pending" || o.status === "countered") && new Date(o.expires_at).getTime() < now) return "expired";
  if (o.status === "accepted" && o.pay_by && new Date(o.pay_by).getTime() < now) return "expired";
  return o.status;
}

export async function fetchSellerOffers(): Promise<SellerOffer[]> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return [];
  const res = await fetch("/api/offers", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  return ((await res.json()).offers ?? []) as SellerOffer[];
}

// The seller's side of negotiating: every offer with the buyer's first
// name, how far below the price it is, the time left, and one-tap
// accept / counter / decline. Counter-offers must sit between the
// buyer's offer and the listed price (checked again on the server).
export function OffersPanel({ t, onChanged }: { t: Dictionary; onChanged?: () => void }) {
  const [offers, setOffers] = useState<SellerOffer[] | null>(null);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [now, setNow] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [counterFor, setCounterFor] = useState<string | null>(null);
  const [counterValue, setCounterValue] = useState("");
  const [error, setError] = useState<{ id: string; text: string } | null>(null);

  const load = useCallback(async () => {
    const list = await fetchSellerOffers();
    setNow(Date.now());
    setOffers(list);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function respond(id: string, action: "accept" | "decline" | "counter", counter?: number) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/offers/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, counter }),
    });
    if (!res.ok) {
      setError({ id, text: offerErrorText(t, (await res.json().catch(() => ({}))) as OfferApiError) });
    } else {
      setCounterFor(null);
      setCounterValue("");
    }
    await load();
    setBusyId(null);
    onChanged?.();
  }

  if (offers === null) {
    return <p className="text-sm" style={{ color: "var(--dash-muted)" }}>{t.dashboard.loading}</p>;
  }

  const open = offers.filter((o) => liveOfferStatus(o, now) === "pending");
  const list = filter === "open" ? open : offers;
  const hoursLeft = (iso: string | null) => (iso ? Math.max(1, Math.ceil((new Date(iso).getTime() - now) / 3600_000)) : 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="dash-card p-5">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <IconHandshake className="w-4 h-4" style={{ color: "var(--dash-gold-ink)" }} />
          {t.offers.sellerTitle}
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--dash-muted)" }}>{t.offers.sellerIntro}</p>
        <div className="mt-3 flex gap-2">
          {(["open", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={filter === f ? "dash-btn !py-1.5 !px-3 text-xs" : "dash-btn-outline !py-1.5 !px-3 text-xs"}
            >
              {f === "open" ? `${t.offers.sellerFilterOpen} (${open.length})` : t.offers.sellerFilterAll}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="dash-card p-8 text-center text-sm" style={{ color: "var(--dash-muted)" }}>
          {t.offers.sellerEmpty}
        </div>
      ) : (
        list.map((o) => {
          const status = liveOfferStatus(o, now);
          const price = o.product ? (o.product.sale_price_fcfa ?? o.product.price_fcfa) : 0;
          const pct = price ? Math.round((1 - o.amount_fcfa / price) * 100) : 0;
          const img = o.product?.image_urls?.[0];
          const statusText = (t.offers.sellerStatus as Record<string, string>)[status]?.replace(
            "{amount}",
            formatFcfa(o.counter_fcfa ?? 0)
          );
          return (
            <div key={o.id} className="dash-card p-4">
              <div className="flex gap-3">
                <div className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 flex items-center justify-center" style={{ background: "var(--dash-bg-2)" }}>
                  {img ? <Image src={img} alt="" fill sizes="64px" className="object-cover" /> : <IconBag className="w-6 h-6" style={{ color: "var(--dash-muted)" }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate" style={{ color: "var(--dash-muted)" }}>{o.product?.title ?? "—"}</p>
                  <p className="text-base font-bold">
                    {t.offers.sellerOffered
                      .replace("{buyer}", o.buyer_name ?? t.offers.sellerBuyerFallback)
                      .replace("{amount}", formatFcfa(o.amount_fcfa))}
                  </p>
                  <p className="text-xs" style={{ color: "var(--dash-muted)" }}>
                    {t.offers.sellerListed.replace("{price}", formatFcfa(price)).replace("{pct}", String(pct))}
                  </p>
                  {o.message && <p className="mt-1.5 text-sm italic">“{o.message}”</p>}
                  <p className="mt-1.5 text-xs flex items-center gap-1.5 flex-wrap" style={{ color: status === "pending" ? "var(--dash-gold-ink)" : "var(--dash-muted)" }}>
                    {status === "pending" && <IconClock className="w-3.5 h-3.5" />}
                    {statusText}
                    {status === "pending" && ` · ${hoursLeft(o.expires_at)} h`}
                    {o.auto_decided && ` · ${t.offers.sellerAuto}`}
                  </p>
                </div>
              </div>

              {status === "pending" && (
                <div className="mt-3 pt-3 border-t flex flex-col gap-2" style={{ borderColor: "var(--dash-border)" }}>
                  {counterFor === o.id ? (
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        respond(o.id, "counter", Number(counterValue));
                      }}
                    >
                      <input
                        autoFocus
                        inputMode="numeric"
                        value={counterValue}
                        onChange={(e) => setCounterValue(e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder={t.offers.sellerCounterPlaceholder}
                        className="dash-input flex-1"
                      />
                      <button type="submit" disabled={busyId === o.id || !counterValue} className="dash-btn">
                        {t.offers.sellerCounterSend}
                      </button>
                      <button type="button" onClick={() => setCounterFor(null)} className="dash-btn-outline">
                        ×
                      </button>
                    </form>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <button type="button" disabled={busyId === o.id} onClick={() => respond(o.id, "accept")} className="dash-btn justify-center">
                        {t.offers.sellerAccept}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === o.id}
                        onClick={() => {
                          setCounterFor(o.id);
                          setCounterValue(String(Math.round((o.amount_fcfa + price) / 2 / 500) * 500 || ""));
                        }}
                        className="dash-btn-outline justify-center"
                      >
                        {t.offers.sellerCounter}
                      </button>
                      <button type="button" disabled={busyId === o.id} onClick={() => respond(o.id, "decline")} className="dash-btn-outline justify-center" style={{ color: "var(--dash-danger)" }}>
                        {t.offers.sellerDecline}
                      </button>
                    </div>
                  )}
                  {error?.id === o.id && <p className="text-xs" style={{ color: "var(--dash-danger)" }}>{error.text}</p>}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
