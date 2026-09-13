"use client";

import { useState } from "react";
import type { Product } from "@/lib/mock-data";
import { formatFcfa } from "@/lib/mock-data";

type Status = "form" | "waiting" | "held";

export default function CheckoutForm({ product }: { product: Product }) {
  const [provider, setProvider] = useState<"mtn" | "orange">("mtn");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<Status>("form");

  // Placeholder submit handler. Once Campay/NotchPay keys exist, this
  // calls a server route that starts a real mobile money payment request
  // and the order lands in Supabase with status "pending_payment".
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("waiting");
    setTimeout(() => setStatus("held"), 1400);
  }

  if (status === "held") {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-sm text-green-900">
        <p className="font-semibold mb-1">Payment held ✓ (demo)</p>
        <p>
          In the live version, {formatFcfa(product.priceFcfa)} would now be
          confirmed via {provider === "mtn" ? "MTN Mobile Money" : "Orange Money"}{" "}
          and held by Buyam Sellam. The seller is notified to ship, and
          you&apos;ll be asked to confirm receipt before they get paid.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="text-sm font-medium block mb-2">
          Pay with
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setProvider("mtn")}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              provider === "mtn"
                ? "border-amber-500 bg-amber-50"
                : "border-neutral-300"
            }`}
          >
            MTN Mobile Money
          </button>
          <button
            type="button"
            onClick={() => setProvider("orange")}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              provider === "orange"
                ? "border-amber-500 bg-amber-50"
                : "border-neutral-300"
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
          placeholder="6XX XXX XXX"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={status === "waiting"}
        className="rounded-full bg-neutral-900 text-white font-semibold px-6 py-3 hover:bg-neutral-700 disabled:opacity-60"
      >
        {status === "waiting"
          ? "Waiting for confirmation…"
          : `Pay ${formatFcfa(product.priceFcfa)}`}
      </button>
      <p className="text-xs text-neutral-500 text-center">
        This is a demo flow — no real charge happens until a payment
        account is connected.
      </p>
    </form>
  );
}
