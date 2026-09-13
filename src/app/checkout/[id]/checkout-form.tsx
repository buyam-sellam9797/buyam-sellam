"use client";

import { useEffect, useRef, useState } from "react";
import type { Product } from "@/lib/mock-data";
import { formatFcfa } from "@/lib/mock-data";

type Status = "form" | "waiting" | "held" | "failed";

export default function CheckoutForm({ product }: { product: Product }) {
  const [provider, setProvider] = useState<"mtn" | "orange">("mtn");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<Status>("form");
  const [error, setError] = useState<string | null>(null);
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
          amount: product.priceFcfa,
          productTitle: product.title,
          provider,
          phone,
        }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) {
        setError(startData.error ?? "Something went wrong starting the payment.");
        setStatus("failed");
        return;
      }

      const reference: string = startData.reference;
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts += 1;
        try {
          const checkRes = await fetch(`/api/checkout?reference=${encodeURIComponent(reference)}`);
          const checkData = await checkRes.json();
          if (checkData.status === "complete") {
            if (pollRef.current) clearInterval(pollRef.current);
            setStatus("held");
          } else if (checkData.status === "failed" || checkData.status === "canceled") {
            if (pollRef.current) clearInterval(pollRef.current);
            setError("The payment was not approved on your phone.");
            setStatus("failed");
          }
        } catch {
          // transient network hiccup while polling — keep trying until timeout
        }
        if (attempts >= 20) {
          if (pollRef.current) clearInterval(pollRef.current);
          setError("We didn't see a confirmation in time. Check your phone, or try again.");
          setStatus("failed");
        }
      }, 3000);
    } catch {
      setError("Could not reach the payment service. Please try again.");
      setStatus("failed");
    }
  }

  if (status === "held") {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-sm text-green-900">
        <p className="font-semibold mb-1">Payment held ✓</p>
        <p>
          {formatFcfa(product.priceFcfa)} is confirmed and held by Buyam
          Sellam. The seller has been notified to ship your order —
          you&apos;ll be asked to confirm receipt before they get paid.
        </p>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {error ?? "The payment could not be completed."}
        </div>
        <button
          onClick={() => setStatus("form")}
          className="rounded-full border border-neutral-300 px-6 py-3 text-sm font-semibold hover:border-neutral-900"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="text-sm font-medium block mb-2">Pay with</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setProvider("mtn")}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              provider === "mtn" ? "border-amber-500 bg-amber-50" : "border-neutral-300"
            }`}
          >
            MTN Mobile Money
          </button>
          <button
            type="button"
            onClick={() => setProvider("orange")}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              provider === "orange" ? "border-amber-500 bg-amber-50" : "border-neutral-300"
            }`}
          >
            Orange Money
          </button>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium block mb-2" htmlFor="phone">
          Mobile money number
        </label>
        <input
          id="phone"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+237 6XX XXX XXX"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={status === "waiting"}
        className="rounded-full bg-neutral-900 text-white font-semibold px-6 py-3 hover:bg-neutral-700 disabled:opacity-60"
      >
        {status === "waiting" ? "Check your phone…" : `Pay ${formatFcfa(product.priceFcfa)}`}
      </button>
      {status === "waiting" && (
        <p className="text-xs text-neutral-500 text-center">
          A payment approval request was sent to your phone. Approve it
          there to complete the order.
        </p>
      )}
    </form>
  );
}
