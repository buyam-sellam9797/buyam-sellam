"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  supabase,
  getMyAddresses,
  getDeliveryZones,
  type BuyerAddress,
  type DeliveryZone,
  type Product,
} from "@/lib/supabase";
import { decodeBagItems } from "@/lib/bag-items";
import { formatFcfa, formatEurFromFcfa } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";
import { IconBag, IconGift, IconLink, IconCheckCircle } from "@/components/dash-icons";

type Row = Pick<Product, "id" | "shop_id" | "title" | "price_fcfa" | "sale_price_fcfa" | "stock_quantity" | "image_urls"> & {
  shop: { shop_name: string; city: string } | null;
};

function ShareBag() {
  const { t, locale } = useLocale();
  const params = useSearchParams();
  const itemsParam = params.get("items") ?? "";
  const wanted = useMemo(() => decodeBagItems(itemsParam), [itemsParam]);

  const [token, setToken] = useState<string | null>(null);
  const [checkedSession, setCheckedSession] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [addresses, setAddresses] = useState<BuyerAddress[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [zoneId, setZoneId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<{ url: string; total: number } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setToken(data.session?.access_token ?? null);
      setCheckedSession(true);
      const ids = wanted.map((w) => w.productId);
      if (ids.length > 0) {
        const { data: products } = await supabase
          .from("products")
          .select("id, shop_id, title, price_fcfa, sale_price_fcfa, stock_quantity, image_urls, shop:shops(shop_name, city)")
          .in("id", ids)
          .eq("is_active", true);
        if (cancelled) return;
        const list = (products ?? []) as unknown as Row[];
        setRows(list);
        if (list[0]) {
          const z = await getDeliveryZones(list[0].shop_id);
          if (!cancelled) {
            setZones(z);
            setZoneId(z[0]?.id ?? "");
          }
        }
      }
      if (data.session) {
        const saved = await getMyAddresses();
        if (cancelled) return;
        setAddresses(saved);
        const preferred = saved.find((a) => a.is_default) ?? saved[0];
        if (preferred) applyAddress(preferred);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wanted]);

  function applyAddress(a: BuyerAddress) {
    setName(a.full_name);
    setPhone(a.phone);
    setCity(a.city);
    setNeighborhood(a.neighborhood ?? "");
    setAddress(a.address ?? "");
    setNotes(a.notes ?? "");
  }

  const subtotal = rows.reduce((sum, r) => {
    const q = Math.min(wanted.find((w) => w.productId === r.id)?.quantity ?? 1, r.stock_quantity);
    return sum + (r.sale_price_fcfa ?? r.price_fcfa) * q;
  }, 0);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/shared-bags", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        items: wanted,
        delivery: { name, phone, city, neighborhood, address, notes, zoneId: zoneId || null },
        note,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !data.token) {
      setError(data.error ?? t.checkout.errorGeneric);
      return;
    }
    setLink({ url: `${window.location.origin}/pay/${data.token}`, total: data.total ?? subtotal });
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked: the link is shown on screen to copy by hand
    }
  }

  if (link) {
    const message = t.payForMe.whatsappMessage.replace("{total}", formatFcfa(link.total)).replace("{link}", link.url);
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-center">
          <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-green-50 text-green-700 flex items-center justify-center">
            <IconCheckCircle className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold">{t.payForMe.linkReady}</h1>
          <p className="text-sm text-neutral-500 mt-1">{t.payForMe.linkReadyNote}</p>
          <p className="mt-4 rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2 text-xs font-mono break-all text-left">{link.url}</p>
          <div className="mt-4 grid gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-[#1f7a4d] text-white font-semibold px-5 py-3 text-sm hover:opacity-90"
            >
              {t.payForMe.shareWhatsapp}
            </a>
            <button type="button" onClick={copy} className="rounded-full border border-neutral-300 font-semibold px-5 py-3 text-sm hover:border-neutral-900 inline-flex items-center justify-center gap-1.5">
              <IconLink className="w-4 h-4" /> {copied ? t.payForMe.copied : t.payForMe.copy}
            </button>
          </div>
          <p className="text-xs text-neutral-500 mt-4">
            {t.payForMe.manageInAccount}{" "}
            <Link href="/account#shared-bags" className="underline font-semibold">
              {t.footer.myAccount}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="flex items-center gap-2 mb-1">
        <IconGift className="w-5 h-5" />
        <h1 className="text-xl font-bold">{t.payForMe.title}</h1>
      </div>
      <p className="text-sm text-neutral-600 mb-5">{t.payForMe.intro}</p>

      {rows.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 mb-5">
          <p className="text-xs font-semibold text-neutral-500 mb-3">{rows[0].shop?.shop_name}</p>
          <ul className="flex flex-col gap-2.5">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-lg bg-neutral-100 overflow-hidden flex items-center justify-center shrink-0">
                  {r.image_urls?.[0] ? <Image src={r.image_urls[0]} alt={r.title} fill sizes="40px" className="object-cover" /> : <IconBag className="w-4 h-4 text-neutral-300" />}
                </div>
                <span className="text-sm flex-1 truncate">{r.title}</span>
                <span className="text-xs text-neutral-500">×{Math.min(wanted.find((w) => w.productId === r.id)?.quantity ?? 1, r.stock_quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 pt-3 border-t border-neutral-100 flex justify-between text-sm font-semibold">
            <span>{t.bag.itemsSubtotal}</span>
            <span>
              {formatFcfa(subtotal)} <span className="font-normal text-xs text-neutral-500">≈ {formatEurFromFcfa(subtotal, locale)}</span>
            </span>
          </p>
          <p className="text-xs text-neutral-500 mt-1">{t.bag.deliveryAtCheckout}</p>
        </div>
      )}

      {checkedSession && !token ? (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
          <p className="mb-3 text-neutral-700">{t.payForMe.loginNeeded}</p>
          <Link
            href={`/login?next=${encodeURIComponent(`/bag/share?items=${itemsParam}`)}`}
            className="inline-block rounded-full bg-neutral-900 text-white font-semibold px-5 py-2.5"
          >
            {t.payForMe.loginCta}
          </Link>
        </div>
      ) : (
        <form onSubmit={create} className="flex flex-col gap-3">
          <p className="text-sm font-semibold">{t.payForMe.deliveryTitle}</p>
          {addresses.length > 0 && (
            <select
              aria-label={t.payForMe.savedAddress}
              onChange={(e) => {
                const a = addresses.find((x) => x.id === e.target.value);
                if (a) applyAddress(a);
              }}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white"
            >
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label || t.checkout.savedAddressFallbackLabel} — {a.city}
                </option>
              ))}
            </select>
          )}
          {zones.length > 0 && (
            <select
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              aria-label={t.checkout.deliveryZonePick}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white"
            >
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name} — {formatFcfa(z.fee_fcfa)}
                </option>
              ))}
            </select>
          )}
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder={t.checkout.deliveryNamePlaceholder} aria-label={t.checkout.deliveryNameLabel} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.checkout.deliveryPhonePlaceholder} aria-label={t.checkout.deliveryPhoneLabel} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <input required value={city} onChange={(e) => setCity(e.target.value)} placeholder={t.checkout.deliveryCityLabel} aria-label={t.checkout.deliveryCityLabel} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            <input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder={t.checkout.deliveryNeighborhoodPlaceholder} aria-label={t.checkout.deliveryNeighborhoodLabel} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t.checkout.deliveryAddressPlaceholder} aria-label={t.checkout.deliveryAddressLabel} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t.checkout.deliveryNotesLabel} rows={2} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          <label className="text-sm font-semibold mt-2" htmlFor="payer-note">
            {t.payForMe.noteLabel}
          </label>
          <textarea
            id="payer-note"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
            placeholder={t.payForMe.notePlaceholder}
            rows={2}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={busy || !token || rows.length === 0} className="rounded-full bg-neutral-900 text-white font-semibold px-6 py-3 hover:bg-neutral-700 disabled:opacity-50">
            {busy ? t.payForMe.creating : t.payForMe.create}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ShareBagPage() {
  return (
    <Suspense fallback={null}>
      <ShareBag />
    </Suspense>
  );
}
