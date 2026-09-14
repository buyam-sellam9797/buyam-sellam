"use client";

import { useState } from "react";
import Link from "next/link";
import { formatFcfa } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";

type LookupOrder = {
  id: string;
  status: string;
  total_amount_fcfa: number;
  created_at: string;
  shop: { shop_name: string } | { shop_name: string }[] | null;
};

function shopName(shop: LookupOrder["shop"]): string {
  if (!shop) return "";
  return Array.isArray(shop) ? (shop[0]?.shop_name ?? "") : shop.shop_name;
}

export default function TrackOrderPage() {
  const { t } = useLocale();
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<LookupOrder[] | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    setResults(null);
    try {
      const res = await fetch("/api/orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? t.trackOrder.errorGeneric);
        return;
      }
      setResults(json.orders ?? []);
    } catch {
      setError(t.trackOrder.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold mb-1">{t.trackOrder.title}</h1>
      <p className="text-neutral-500 text-sm mb-8">{t.trackOrder.subtitle}</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label className="text-sm font-medium block mb-2" htmlFor="phone">
            {t.trackOrder.phoneLabel}
          </label>
          <input
            id="phone"
            type="tel"
            required
            placeholder={t.trackOrder.phonePlaceholder}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-neutral-900 text-white font-semibold px-6 py-3 hover:bg-neutral-700 disabled:opacity-60"
        >
          {submitting ? t.trackOrder.searching : t.trackOrder.submit}
        </button>
      </form>

      {results && results.length === 0 && (
        <p className="text-sm text-neutral-500 mt-8">{t.trackOrder.noneFound}</p>
      )}

      {results && results.length > 0 && (
        <div className="mt-8">
          <p className="text-sm font-semibold mb-3">{t.trackOrder.resultsHeading}</p>
          <div className="flex flex-col gap-3">
            {results.map((o) => (
              <div key={o.id} className="rounded-xl border border-neutral-200 p-4 text-sm flex flex-col gap-1">
                <p className="font-medium">{shopName(o.shop)}</p>
                <p className="text-neutral-500 text-xs">
                  {new Date(o.created_at).toLocaleDateString()} · {formatFcfa(o.total_amount_fcfa)}
                </p>
                <p className="text-xs text-neutral-500 capitalize">{o.status.replace(/_/g, " ")}</p>
                <Link href={`/order/${o.id}`} className="text-amber-600 text-sm font-medium hover:underline mt-1">
                  {t.trackOrder.viewOrder} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
