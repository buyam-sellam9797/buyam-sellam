"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Product } from "@/lib/supabase";
import { formatFcfa } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";

type Status = "form" | "waiting" | "held" | "failed";

export default function CheckoutForm({ product }: { product: Product }) {
  const { t } = useLocale();
  const [provider, setProvider] = useState<"mtn" | "orange">("mtn");
  const [phone, setPhone] = useState("");
  const [deliveryName, setDeliveryName] = useState("");
  const [deliveryCity, setDeliveryCity] = useState(product.shop?.city ?? "");
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [status, setStatus] = useState<Status>("form");
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("waiting");

    try {
      const startRes = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          provider,
          phone,
          deliveryName,
          deliveryCity,
          deliveryNeighborhood,
          deliveryAddress,
          deliveryNotes,
        }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) {
        setError(startData.error ?? t.checkout.errorStart);
        setStatus("failed");
        return;
      }

      const reference: string = startData.reference;
      const orderReference: string = startData.orderReference;
      setOrderId(startData.orderId ?? null);
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts += 1;
        try {
          const checkRes = await fetch(
            `/api/checkout?reference=${encodeURIComponent(reference)}&orderReference=${encodeURIComponent(orderReference)}`
          );
          const checkData = await checkRes.json();
          if (checkData.status === "complete") {
            if (pollRef.current) clearInterval(pollRef.current);
            setStatus("held");
          } else if (checkData.status === "failed" || checkData.status === "canceled") {
            if (pollRef.current) clearInterval(pollRef.current);
            setError(t.checkout.errorNotApproved);
            setStatus("failed");
          }
        } catch {
          // transient network hiccup while polling — keep trying until timeout
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

  if (status === "held") {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-sm text-green-900">
          <p className="font-semibold mb-1">{t.checkout.heldTitle}</p>
          <p>
            {formatFcfa(product.price_fcfa)} {t.checkout.heldBody}
          </p>
        </div>
        {orderId && (
          <Link
            href={`/order/${orderId}`}
            className="rounded-full border border-neutral-300 px-6 py-3 text-sm font-semibold text-center hover:border-neutral-900"
          >
            {t.checkout.trackOrder}
          </Link>
        )}
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {error ?? t.checkout.errorGeneric}
        </div>
        <button
          onClick={() => setStatus("form")}
          className="rounded-full border border-neutral-300 px-6 py-3 text-sm font-semibold hover:border-neutral-900"
        >
          {t.checkout.tryAgain}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold mb-2">{t.checkout.deliveryInfoTitle}</p>
        <div className="flex flex-col gap-3">
          <input
            required
            value={deliveryName}
            onChange={(e) => setDeliveryName(e.target.value)}
            placeholder={t.checkout.deliveryNamePlaceholder}
            aria-label={t.checkout.deliveryNameLabel}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              value={deliveryCity}
              onChange={(e) => setDeliveryCity(e.target.value)}
              placeholder={t.checkout.deliveryCityLabel}
              aria-label={t.checkout.deliveryCityLabel}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <input
              value={deliveryNeighborhood}
              onChange={(e) => setDeliveryNeighborhood(e.target.value)}
              placeholder={t.checkout.deliveryNeighborhoodPlaceholder}
              aria-label={t.checkout.deliveryNeighborhoodLabel}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <input
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            placeholder={t.checkout.deliveryAddressPlaceholder}
            aria-label={t.checkout.deliveryAddressLabel}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <textarea
            value={deliveryNotes}
            onChange={(e) => setDeliveryNotes(e.target.value)}
            placeholder={t.checkout.deliveryNotesLabel}
            rows={2}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium block mb-2">{t.checkout.payWithLabel}</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setProvider("mtn")}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              provider === "mtn" ? "border-amber-500 bg-amber-50" : "border-neutral-300"
            }`}
          >
            {t.checkout.mtn}
          </button>
          <button
            type="button"
            onClick={() => setProvider("orange")}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              provider === "orange" ? "border-amber-500 bg-amber-50" : "border-neutral-300"
            }`}
          >
            {t.checkout.orange}
          </button>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium block mb-2" htmlFor="phone">
          {t.checkout.phoneLabel}
        </label>
        <input
          id="phone"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t.checkout.phonePlaceholder}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={status === "waiting"}
        className="rounded-full bg-neutral-900 text-white font-semibold px-6 py-3 hover:bg-neutral-700 disabled:opacity-60"
      >
        {status === "waiting" ? t.checkout.checkingPhone : `${t.checkout.payButton} ${formatFcfa(product.price_fcfa)}`}
      </button>
      {status === "waiting" && (
        <p className="text-xs text-neutral-500 text-center">{t.checkout.waitingNote}</p>
      )}
      <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
        {t.checkout.protectionNotice}
      </p>
    </form>
  );
}
