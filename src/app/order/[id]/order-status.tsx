"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { formatFcfa } from "@/lib/format";

type OrderInfo = {
  id: string;
  status: string;
  total_amount_fcfa: number;
  created_at: string;
  shop?: { shop_name: string } | null;
};

export default function OrderStatus({ orderId }: { orderId: string }) {
  const { t } = useLocale();
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/orders/${orderId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.order) setOrder(data.order);
        else setNotFound(true);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  async function handleConfirm() {
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t.checkout.errorGeneric);
        return;
      }
      setOrder(data.order);
    } catch {
      setError(t.checkout.errorUnreachable);
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return <p className="text-center text-neutral-500 text-sm py-10">{t.dashboard.loading}</p>;
  }

  if (notFound || !order) {
    return (
      <div className="text-center">
        <p className="text-sm text-neutral-600 mb-4">{t.order.notFound}</p>
        <Link href="/" className="text-amber-600 hover:underline text-sm">
          {t.order.backHome}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">{t.order.title}</h1>

      <div className="rounded-xl border border-neutral-200 bg-white p-5 mb-6">
        <p className="text-xs text-neutral-500">{order.shop?.shop_name}</p>
        <p className="text-lg font-semibold mt-1">{formatFcfa(order.total_amount_fcfa)}</p>
        <p className="text-xs text-neutral-500 mt-2">
          {t.order.status}: {t.dashboard.statusLabels[order.status] ?? order.status}
        </p>
      </div>

      {order.status === "paid_held" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {t.order.alreadyHeld}
        </div>
      )}

      {order.status === "shipped" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {t.order.shipped}
          </div>
          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="rounded-full bg-neutral-900 text-white font-semibold px-6 py-3 hover:bg-neutral-700 disabled:opacity-60"
          >
            {confirming ? t.order.confirming : t.order.confirmReceived}
          </button>
        </div>
      )}

      {order.status === "completed" && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          {t.order.alreadyCompleted}
        </div>
      )}
    </div>
  );
}
