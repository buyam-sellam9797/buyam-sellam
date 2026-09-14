"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { formatFcfa } from "@/lib/format";
import { plural } from "@/lib/i18n";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { buildSupportWhatsAppLink } from "@/lib/site";

const AUTO_RELEASE_DAYS = 5;

type OrderInfo = {
  id: string;
  status: string;
  total_amount_fcfa: number;
  created_at: string;
  updated_at: string;
  delivery_name?: string | null;
  delivery_city?: string | null;
  delivery_neighborhood?: string | null;
  delivery_address?: string | null;
  shop?: { shop_name: string; whatsapp_number?: string | null; city?: string | null } | null;
};

type OrderItem = {
  quantity: number;
  product?: { title: string } | null;
};

const STEP_ORDER = ["paid_held", "shipped", "completed"] as const;

function stepIndexFor(status: string): number {
  if (status === "shipped") return 1;
  if (status === "completed") return 2;
  // pending_payment shouldn't really reach this page, but treat it as
  // "not yet held" rather than crashing the stepper.
  return 0;
}

export default function OrderStatus({ orderId }: { orderId: string }) {
  const { t, locale } = useLocale();
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  // Date.now() is impure, so it's read via a lazy initializer (runs
  // once, on mount) rather than directly during render.
  const [now] = useState<number>(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/orders/${orderId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.order) {
          setOrder(data.order);
          setItems(Array.isArray(data.items) ? data.items : []);
          setReviewed(Boolean(data.reviewed));
        } else setNotFound(true);
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

  async function handleSubmitReview() {
    if (rating < 1) {
      setReviewError(t.order.reviewErrorPickRating);
      return;
    }
    setSubmittingReview(true);
    setReviewError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "review", rating, comment }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReviewError(data.error ?? t.order.reviewErrorGeneric);
        return;
      }
      setReviewed(true);
    } catch {
      setReviewError(t.order.reviewErrorGeneric);
    } finally {
      setSubmittingReview(false);
    }
  }

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

  const stepIndex = stepIndexFor(order.status);
  const isTerminalIssue = ["disputed", "refunded", "cancelled"].includes(order.status);

  let daysLeft: number | null = null;
  if (order.status === "shipped") {
    const shippedAt = new Date(order.updated_at).getTime();
    const msLeft = shippedAt + AUTO_RELEASE_DAYS * 24 * 60 * 60 * 1000 - now;
    daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
  }

  const deliveryLines = [
    order.delivery_name,
    [order.delivery_neighborhood, order.delivery_city].filter(Boolean).join(", "),
    order.delivery_address,
  ].filter(Boolean);

  const chatHref = order.shop?.whatsapp_number
    ? buildWhatsAppLink(
        order.shop.whatsapp_number,
        t.order.chatWithSellerMessage.replace("{id}", order.id.slice(0, 8))
      )
    : null;
  const reportHref = buildSupportWhatsAppLink(
    t.order.reportProblemMessage
      .replace("{id}", order.id.slice(0, 8))
      .replace("{status}", t.dashboard.statusLabels[order.status] ?? order.status)
  );

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">{t.order.title}</h1>

      {!isTerminalIssue && (
        <div className="mb-6">
          <div className="flex items-center">
            {STEP_ORDER.map((step, i) => (
              <div key={step} className="flex items-center flex-1 last:flex-none">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    i <= stepIndex ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-500"
                  }`}
                >
                  {i < stepIndex ? "✓" : i + 1}
                </div>
                {i < STEP_ORDER.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 ${i < stepIndex ? "bg-neutral-900" : "bg-neutral-200"}`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1.5 text-[11px] text-neutral-500">
            <span className={stepIndex === 0 ? "font-semibold text-neutral-900" : ""}>{t.order.stepHeld}</span>
            <span className={stepIndex === 1 ? "font-semibold text-neutral-900" : ""}>{t.order.stepShipped}</span>
            <span className={stepIndex === 2 ? "font-semibold text-neutral-900" : ""}>{t.order.stepCompleted}</span>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-neutral-200 bg-white p-5 mb-4">
        <p className="text-xs text-neutral-500">{order.shop?.shop_name}</p>
        <p className="text-lg font-semibold mt-1">{formatFcfa(order.total_amount_fcfa)}</p>
        <p className="text-xs text-neutral-500 mt-2">
          {t.order.status}: {t.dashboard.statusLabels[order.status] ?? order.status}
        </p>

        {items.length > 0 && (
          <ul className="mt-3 pt-3 border-t border-neutral-100 text-xs text-neutral-600 space-y-0.5">
            {items.map((item, i) => (
              <li key={i}>
                {item.quantity}× {item.product?.title ?? ""}
              </li>
            ))}
          </ul>
        )}

        {deliveryLines.length > 0 && (
          <div className="mt-3 pt-3 border-t border-neutral-100 text-xs text-neutral-600">
            <p className="font-semibold text-neutral-500 mb-0.5">{t.order.deliveryTo}</p>
            {deliveryLines.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        )}
      </div>

      {(chatHref || !isTerminalIssue) && (
        <div className="flex gap-2 mb-6">
          {chatHref && (
            <a
              href={chatHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center rounded-full border border-green-600 text-green-700 text-sm font-semibold px-4 py-2.5 hover:bg-green-50"
            >
              {t.order.chatWithSeller}
            </a>
          )}
          {!isTerminalIssue && (
            <a
              href={reportHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center rounded-full border border-neutral-300 text-neutral-700 text-sm font-semibold px-4 py-2.5 hover:border-neutral-900"
            >
              {t.order.reportProblem}
            </a>
          )}
        </div>
      )}

      {order.status === "paid_held" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {t.order.alreadyHeld}
        </div>
      )}

      {order.status === "shipped" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p>{t.order.autoReleaseNotice}</p>
            {daysLeft !== null && (
              <p className="mt-2 font-semibold">
                {daysLeft > 0
                  ? `${daysLeft} ${plural(daysLeft, locale, t.order.daysLeftOne, t.order.daysLeftOther)}`
                  : t.order.releaseToday}
              </p>
            )}
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
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
            {t.order.alreadyCompleted}
          </div>

          {reviewed ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
              ⭐ {t.order.reviewThanks}
            </div>
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <p className="text-sm font-semibold mb-3">{t.order.reviewPrompt}</p>
              <div className="flex gap-1 mb-4" role="radiogroup" aria-label={t.order.reviewPrompt}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    className="text-3xl leading-none"
                  >
                    {n <= rating ? "⭐" : "☆"}
                  </button>
                ))}
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t.order.reviewCommentPlaceholder}
                rows={3}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm mb-3"
              />
              {reviewError && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                  {reviewError}
                </p>
              )}
              <button
                onClick={handleSubmitReview}
                disabled={submittingReview}
                className="rounded-full bg-neutral-900 text-white font-semibold px-6 py-2.5 text-sm hover:bg-neutral-700 disabled:opacity-60"
              >
                {submittingReview ? t.order.reviewSubmitting : t.order.reviewSubmit}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
