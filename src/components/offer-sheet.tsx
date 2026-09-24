"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatFcfa, formatEurFromFcfa } from "@/lib/format";
import { useLocale } from "./locale-provider";

export type OfferApiError = { error?: string; code?: string; amount?: number; max?: number };

// Turns an offer API error into the buyer's language when we know the code.
export function offerErrorText(
  t: ReturnType<typeof useLocale>["t"],
  data: OfferApiError
): string {
  const errors = t.offers.errors as Record<string, string>;
  const template = data.code ? errors[data.code] : undefined;
  if (!template) return data.error ?? t.offers.errors.failed;
  return template
    .replace("{min}", data.amount != null ? formatFcfa(data.amount) : "")
    .replace("{max}", data.max != null ? formatFcfa(data.max) : "");
}

// Rounds a suggested offer to a price people actually say out loud:
// nearest 500 FCFA (nearest 100 under 5 000).
function friendly(n: number) {
  return n < 5000 ? Math.round(n / 100) * 100 : Math.round(n / 500) * 500;
}

// Bottom sheet (full-width on phones, a centred card on larger screens)
// where a buyer proposes a price. Quick picks at 5/10/15% below the
// price cover most haggles in one tap; a typed amount shows how far
// below the price it is and roughly what it is in euros.
export function OfferSheet({
  productTitle,
  listPrice,
  loggedIn,
  loginHref,
  onClose,
  onSubmit,
}: {
  productTitle: string;
  listPrice: number;
  loggedIn: boolean;
  loginHref: string;
  onClose: () => void;
  onSubmit: (amount: number, message: string) => Promise<string | null>;
}) {
  const { t, locale } = useLocale();
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const minimum = Math.ceil(listPrice * 0.5);
  const picks = useMemo(() => {
    const values = [0.95, 0.9, 0.85]
      .map((r) => friendly(listPrice * r))
      .filter((v) => v >= minimum && v < listPrice);
    return [...new Set(values)];
  }, [listPrice, minimum]);

  const value = Number(amount);
  const valid = Number.isFinite(value) && value >= minimum && value < listPrice;
  const pct = valid ? Math.round((1 - value / listPrice) * 100) : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const problem = await onSubmit(Math.round(value), message.trim());
    setBusy(false);
    if (problem) setError(problem);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={t.offers.sheetTitle}>
      <button type="button" aria-label={t.offers.cancel} onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 pb-6 max-h-[92vh] overflow-y-auto">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-neutral-200 sm:hidden" />
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="text-lg font-bold">{t.offers.sheetTitle}</h2>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-neutral-400 hover:text-neutral-900" aria-label={t.offers.cancel}>
            ×
          </button>
        </div>
        <p className="text-sm text-neutral-600 line-clamp-1">{productTitle}</p>
        <p className="text-xs text-neutral-500 mb-4">{t.offers.listedAt.replace("{price}", formatFcfa(listPrice))}</p>

        {!loggedIn ? (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
            <p className="text-neutral-700 mb-3">{t.offers.loginNote}</p>
            <Link href={loginHref} className="inline-block rounded-full bg-neutral-900 text-white font-semibold px-5 py-2.5">
              {t.offers.loginToOffer}
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            {picks.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-neutral-500 mb-2">{t.offers.quickPicks}</p>
                <div className="grid grid-cols-3 gap-2">
                  {picks.map((p) => {
                    const off = Math.round((1 - p / listPrice) * 100);
                    const active = value === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setAmount(String(p))}
                        className={`rounded-xl border px-2 py-2.5 text-center transition ${
                          active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 hover:border-neutral-900"
                        }`}
                      >
                        <span className="block text-sm font-semibold">{formatFcfa(p)}</span>
                        <span className={`block text-[11px] ${active ? "text-neutral-300" : "text-neutral-500"}`}>−{off}%</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label htmlFor="offer-amount" className="text-xs font-semibold text-neutral-500 block mb-2">
                {t.offers.yourOffer}
              </label>
              <div className="flex items-center rounded-xl border border-neutral-300 focus-within:border-neutral-900 px-3">
                <input
                  ref={inputRef}
                  id="offer-amount"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
                  placeholder={t.offers.offerPlaceholder}
                  className="flex-1 py-3 text-lg font-semibold outline-none bg-transparent"
                />
                <span className="text-sm text-neutral-500">FCFA</span>
              </div>
              <p className="text-xs mt-1.5 min-h-4">
                {amount === "" ? (
                  <span className="text-neutral-500">{t.offers.minimumNote.replace("{min}", formatFcfa(minimum))}</span>
                ) : valid ? (
                  <span className="text-neutral-600">
                    {t.offers.percentBelow.replace("{pct}", String(pct))} · ≈ {formatEurFromFcfa(value, locale)}
                  </span>
                ) : value >= listPrice ? (
                  <span className="text-amber-700">{t.offers.errors.full_price}</span>
                ) : (
                  <span className="text-amber-700">{t.offers.minimumNote.replace("{min}", formatFcfa(minimum))}</span>
                )}
              </p>
            </div>

            <div>
              <label htmlFor="offer-message" className="text-xs font-semibold text-neutral-500 block mb-2">
                {t.offers.messageLabel}
              </label>
              <textarea
                id="offer-message"
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 300))}
                rows={2}
                placeholder={t.offers.messagePlaceholder}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 outline-none"
              />
            </div>

            <p className="text-xs text-neutral-500 leading-relaxed">{t.offers.howItWorks}</p>
            {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            <button
              type="submit"
              disabled={!valid || busy}
              className="rounded-full bg-neutral-900 text-white font-semibold px-6 py-3 hover:bg-neutral-700 disabled:opacity-40"
            >
              {busy ? t.offers.sending : valid ? `${t.offers.send} · ${formatFcfa(value)}` : t.offers.send}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
