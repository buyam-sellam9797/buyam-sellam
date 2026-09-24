"use client";

import { useEffect, useRef, useState } from "react";
import { formatFcfa, formatEurFromFcfa } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";
import { IconCheckCircle } from "@/components/dash-icons";

type Status = "form" | "waiting" | "paid" | "failed";

export function PayForm({
  token,
  recipient,
  total,
  cardsEnabled,
}: {
  token: string;
  recipient: string;
  total: number;
  cardsEnabled: boolean;
}) {
  const { t, locale } = useLocale();
  const [payerName, setPayerName] = useState("");
  const [provider, setProvider] = useState<"mtn" | "orange" | "card">(cardsEnabled ? "card" : "mtn");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("form");
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fill = (s: string) => s.replaceAll("{name}", recipient);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (provider === "card" && !email.trim()) {
      setError(t.checkout.cardNeedsEmail);
      return;
    }
    setStatus("waiting");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sharedBagToken: token,
          payerName: payerName.trim(),
          provider,
          phone,
          buyerEmail: provider === "card" ? email.trim() : undefined,
          locale,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t.checkout.errorStart);
        setStatus("failed");
        return;
      }
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
        return;
      }
      let attempts = 0;
      const url = `/api/checkout?reference=${encodeURIComponent(data.reference)}&orderReference=${encodeURIComponent(data.orderReference)}`;
      pollRef.current = setInterval(async () => {
        attempts += 1;
        try {
          const check = await (await fetch(url)).json();
          if (check.status === "complete") {
            if (pollRef.current) clearInterval(pollRef.current);
            setStatus("paid");
          } else if (check.status === "failed" || check.status === "canceled") {
            if (pollRef.current) clearInterval(pollRef.current);
            setError(t.checkout.errorNotApproved);
            setStatus("failed");
          }
        } catch {
          // network hiccup: keep polling until the time limit
        }
        if (attempts >= 20) {
          if (pollRef.current) clearInterval(pollRef.current);
          setError(t.checkout.errorTimeout);
          setStatus("failed");
        }
      }, 3000);
    } catch {
      setError(t.checkout.errorUnreachable);
      setStatus("failed");
    }
  }

  if (status === "paid") {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
        <IconCheckCircle className="w-7 h-7 text-green-700 mx-auto mb-2" />
        <p className="font-semibold text-green-900">{t.payForMe.paidTitle}</p>
        <p className="text-sm text-green-900 mt-1">{fill(t.payForMe.paidBody)}</p>
      </div>
    );
  }

  return (
    <form onSubmit={pay} className="flex flex-col gap-4">
      <div>
        <label htmlFor="payer-name" className="text-sm font-medium block mb-1.5">
          {fill(t.payForMe.yourName)}
        </label>
        <input
          id="payer-name"
          value={payerName}
          onChange={(e) => setPayerName(e.target.value.slice(0, 80))}
          placeholder={t.payForMe.yourNamePlaceholder}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <p className="text-sm font-medium mb-2">{t.checkout.payWithLabel}</p>
        <div className="grid grid-cols-2 gap-2">
          {cardsEnabled && (
            <button
              type="button"
              onClick={() => setProvider("card")}
              className={`col-span-2 rounded-lg border px-3 py-2.5 text-sm font-medium ${provider === "card" ? "border-amber-500 bg-amber-50" : "border-neutral-300"}`}
            >
              {t.checkout.card}
            </button>
          )}
          <button
            type="button"
            onClick={() => setProvider("mtn")}
            className={`rounded-lg border px-3 py-2.5 text-sm font-medium ${provider === "mtn" ? "border-amber-500 bg-amber-50" : "border-neutral-300"}`}
          >
            {t.checkout.mtn}
          </button>
          <button
            type="button"
            onClick={() => setProvider("orange")}
            className={`rounded-lg border px-3 py-2.5 text-sm font-medium ${provider === "orange" ? "border-amber-500 bg-amber-50" : "border-neutral-300"}`}
          >
            {t.checkout.orange}
          </button>
        </div>
        {provider === "card" && (
          <p className="text-xs text-neutral-500 mt-2">{t.checkout.cardNote.replace("{eur}", formatEurFromFcfa(total, locale))}</p>
        )}
      </div>
      <div>
        <label htmlFor="payer-phone" className="text-sm font-medium block mb-1.5">
          {provider === "card" ? t.checkout.deliveryPhoneLabel : t.checkout.phoneLabel}
        </label>
        <input
          id="payer-phone"
          required
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={provider === "card" ? "+33 6 12 34 56 78" : t.checkout.phonePlaceholder}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      {provider === "card" && (
        <div>
          <label htmlFor="payer-email" className="text-sm font-medium block mb-1.5">
            {t.checkout.emailLabel}
          </label>
          <input
            id="payer-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.checkout.emailPlaceholder}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
      )}
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      <button
        type="submit"
        disabled={status === "waiting"}
        className="rounded-full bg-neutral-900 text-white font-semibold px-6 py-3 hover:bg-neutral-700 disabled:opacity-60"
      >
        {status === "waiting" ? t.checkout.checkingPhone : t.payForMe.payButton.replace("{amount}", formatFcfa(total))}
      </button>
      {status === "waiting" && provider !== "card" && <p className="text-xs text-neutral-500 text-center">{t.checkout.waitingNote}</p>}
      {status === "failed" && (
        <button type="button" onClick={() => setStatus("form")} className="text-sm font-semibold underline">
          {t.checkout.tryAgain}
        </button>
      )}
    </form>
  );
}
