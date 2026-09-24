"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { formatFcfa } from "@/lib/format";
import { plural } from "@/lib/i18n";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { supabase } from "@/lib/supabase";
import { IconStar, IconShield, IconTruck, IconAlertTriangle } from "@/components/dash-icons";

const AUTO_RELEASE_DAYS = 5;

const DISPUTE_REASONS = [
  "not_arrived",
  "wrong_product",
  "damaged",
  "different_than_described",
  "seller_not_responding",
  "other",
] as const;

type OrderInfo = {
  id: string;
  status: string;
  total_amount_fcfa: number;
  created_at: string;
  updated_at: string;
  accepted_at?: string | null;
  delivery_name?: string | null;
  delivery_phone?: string | null;
  is_gift?: boolean;
  gift_note?: string | null;
  delivery_city?: string | null;
  delivery_neighborhood?: string | null;
  delivery_address?: string | null;
  delivery_fee_fcfa?: number | null;
  delivery_distance_km?: number | null;
  group_buy_id?: string | null;
  shop?: { shop_name: string; whatsapp_number?: string | null; city?: string | null } | null;
};

type OrderItem = {
  quantity: number;
  product?: { title: string } | null;
};

const STEP_ORDER = ["paid_held", "preparing", "shipped", "completed"] as const;

function stepIndexFor(order: OrderInfo): number {
  if (order.status === "completed") return 3;
  if (order.status === "shipped") return 2;
  if (order.accepted_at) return 1;
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
  const [deliveryCode, setDeliveryCode] = useState<string | null>(null);
  const [productRating, setProductRating] = useState(0);
  const [sellerRating, setSellerRating] = useState(0);
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [reportPhoto, setReportPhoto] = useState<File | null>(null);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  // Date.now() is impure, so it's read via a lazy initializer (runs
  // once, on mount) rather than directly during render.
  const [now] = useState<number>(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // The delivery code is only returned to the buyer: this order's
      // secret key (from the link in the payment email or this browser's
      // checkout) or the buyer's own signed-in session.
      let key = new URLSearchParams(window.location.search).get("k");
      try {
        if (key) localStorage.setItem(`bs_order_key_${orderId}`, key);
        else key = localStorage.getItem(`bs_order_key_${orderId}`);
      } catch {
        // storage blocked — the key in the link still works
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      return fetch(`/api/orders/${orderId}${key ? `?k=${encodeURIComponent(key)}` : ""}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    })()
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.order) {
          setOrder(data.order);
          setItems(Array.isArray(data.items) ? data.items : []);
          setReviewed(Boolean(data.reviewed));
          setDeliveryCode(typeof data.deliveryCode === "string" ? data.deliveryCode : null);
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
    if (productRating < 1 || sellerRating < 1 || deliveryRating < 1) {
      setReviewError(t.order.reviewErrorPickRating);
      return;
    }
    setSubmittingReview(true);
    setReviewError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review",
          productRating,
          sellerRating,
          deliveryRating,
          comment,
        }),
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

  async function handleSubmitReport() {
    if (!reportReason) {
      setReportError(t.order.reportErrorPickReason);
      return;
    }
    setSubmittingReport(true);
    setReportError(null);
    try {
      const form = new FormData();
      form.set("reason", reportReason);
      form.set("description", reportDescription);
      if (reportPhoto) form.set("photo", reportPhoto);
      const res = await fetch(`/api/orders/${orderId}/dispute`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setReportError(data.error ?? t.order.reportErrorGeneric);
        return;
      }
      setReportSubmitted(true);
      setShowReportForm(false);
      setOrder((prev) => (prev ? { ...prev, status: "disputed" } : prev));
    } catch {
      setReportError(t.order.reportErrorGeneric);
    } finally {
      setSubmittingReport(false);
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

  const stepIndex = stepIndexFor(order);
  const isTerminalIssue = ["disputed", "refunded", "cancelled", "group_buy_pending"].includes(order.status);
  const stepLabels = [t.order.stepHeld, t.order.stepPreparing, t.order.stepShipped, t.order.stepCompleted];

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
    order.delivery_phone,
  ].filter(Boolean);

  const chatHref = order.shop?.whatsapp_number
    ? buildWhatsAppLink(
        order.shop.whatsapp_number,
        t.order.chatWithSellerMessage.replace("{id}", order.id.slice(0, 8))
      )
    : null;

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
            {stepLabels.map((label, i) => (
              <span
                key={i}
                className={`${i === STEP_ORDER.length - 1 ? "text-right" : ""} ${
                  i === stepIndex ? "font-semibold text-neutral-900" : ""
                }`}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {order.status === "disputed" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 mb-4 flex items-start gap-1.5">
          {!reportSubmitted && <IconShield className="w-4 h-4 shrink-0 mt-0.5" />}
          <span>{reportSubmitted ? t.order.reportThanks : t.order.disputedBanner}</span>
        </div>
      )}

      {order.status === "group_buy_pending" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 mb-4 flex items-start gap-1.5">
          <IconShield className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{t.order.groupBuyPendingBanner}</span>
        </div>
      )}

      {order.status === "cancelled" && order.group_buy_id && (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700 mb-4 flex items-start gap-1.5">
          <IconAlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{t.order.groupBuyCancelledBanner}</span>
        </div>
      )}

      <div className="rounded-xl border border-neutral-200 bg-white p-5 mb-4">
        <p className="text-xs text-neutral-500">{order.shop?.shop_name}</p>
        <p className="text-lg font-semibold mt-1">{formatFcfa(order.total_amount_fcfa)}</p>
        {typeof order.delivery_fee_fcfa === "number" && order.delivery_fee_fcfa > 0 && (
          <p className="text-xs text-neutral-500 mt-0.5">
            {t.order.deliveryFeeIncluded} {formatFcfa(order.delivery_fee_fcfa)}
            {typeof order.delivery_distance_km === "number" && ` (${order.delivery_distance_km.toFixed(1)} km)`}
          </p>
        )}
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
            <p className="font-semibold text-neutral-500 mb-0.5">
              {order.is_gift ? t.order.giftDeliveryTo : t.order.deliveryTo}
            </p>
            {deliveryLines.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
            {order.is_gift && order.gift_note && (
              <p className="mt-1.5 italic">{t.order.giftNoteLabel}: {order.gift_note}</p>
            )}
          </div>
        )}
      </div>

      {(order.status === "paid_held" || order.status === "shipped") && (
        <div className="rounded-xl border-2 border-neutral-900 bg-white p-5 mb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">{t.order.deliveryCodeTitle}</p>
          {deliveryCode ? (
            <>
              <p className="text-4xl font-bold tracking-[0.3em] my-2 font-mono">{deliveryCode}</p>
              <p className="text-sm text-neutral-700">{t.order.deliveryCodeBody}</p>
            </>
          ) : (
            <p className="text-sm text-neutral-700 mt-2">{t.order.deliveryCodeHidden}</p>
          )}
        </div>
      )}

      {(chatHref || !isTerminalIssue) && (
        <div className="flex gap-2 mb-4">
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
            <button
              type="button"
              onClick={() => setShowReportForm((s) => !s)}
              className="flex-1 text-center rounded-full border border-neutral-300 text-neutral-700 text-sm font-semibold px-4 py-2.5 hover:border-neutral-900"
            >
              {t.order.reportProblem}
            </button>
          )}
        </div>
      )}

      {showReportForm && (
        <div className="rounded-xl border border-neutral-200 bg-white p-5 mb-6 flex flex-col gap-3">
          <p className="text-sm font-semibold">{t.order.reportFormTitle}</p>
          <div>
            <label className="text-sm font-medium block mb-1">{t.order.reasonLabel}</label>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">{t.order.reasonPlaceholder}</option>
              {DISPUTE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {
                    {
                      not_arrived: t.order.reasonNotArrived,
                      wrong_product: t.order.reasonWrongProduct,
                      damaged: t.order.reasonDamaged,
                      different_than_described: t.order.reasonDifferent,
                      seller_not_responding: t.order.reasonSellerNotResponding,
                      other: t.order.reasonOther,
                    }[r]
                  }
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">{t.order.reportDescriptionLabel}</label>
            <textarea
              value={reportDescription}
              onChange={(e) => setReportDescription(e.target.value)}
              placeholder={t.order.reportDescriptionPlaceholder}
              rows={3}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">{t.order.reportPhotoLabel}</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setReportPhoto(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
            />
          </div>
          {reportError && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {reportError}
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSubmitReport}
              disabled={submittingReport}
              className="rounded-full bg-neutral-900 text-white font-semibold px-6 py-2.5 text-sm hover:bg-neutral-700 disabled:opacity-60"
            >
              {submittingReport ? t.order.reportSubmitting : t.order.reportSubmit}
            </button>
            <button
              type="button"
              onClick={() => setShowReportForm(false)}
              className="rounded-full border border-neutral-300 px-6 py-2.5 text-sm font-semibold hover:border-neutral-900"
            >
              {t.order.reportCancel}
            </button>
          </div>
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
            <p className="flex items-start gap-1.5">
              <IconTruck className="w-4 h-4 shrink-0 mt-0.5" /> <span>{t.order.autoReleaseNotice}</span>
            </p>
            {daysLeft !== null && (
              <p className="mt-2 font-semibold">
                {daysLeft > 1 ? (
                  `${daysLeft} ${plural(daysLeft, locale, t.order.daysLeftOne, t.order.daysLeftOther)}`
                ) : daysLeft === 1 ? (
                  <span className="flex items-center gap-1.5">
                    <IconAlertTriangle className="w-4 h-4 shrink-0" /> {t.order.releaseTomorrow}
                  </span>
                ) : (
                  t.order.releaseToday
                )}
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
            <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700 flex items-center gap-1.5">
              <IconStar filled className="w-4 h-4 text-amber-500 shrink-0" /> {t.order.reviewThanks}
            </div>
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <p className="text-sm font-semibold mb-3">{t.order.reviewPrompt}</p>
              <StarPicker
                label={t.order.reviewProductLabel}
                value={productRating}
                onChange={setProductRating}
              />
              <StarPicker
                label={t.order.reviewSellerLabel}
                value={sellerRating}
                onChange={setSellerRating}
              />
              <StarPicker
                label={t.order.reviewDeliveryLabel}
                value={deliveryRating}
                onChange={setDeliveryRating}
              />
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

// One star-rating row inside the post-order review form, split by
// aspect (product / seller / delivery) rather than a single overall
// score, so a great seller with a slow courier doesn't get lumped
// into one number.
function StarPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="mb-3">
      <p className="text-xs text-neutral-500 mb-1">{label}</p>
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className="leading-none text-amber-500"
          >
            <IconStar filled={n <= value} className="w-6 h-6" />
          </button>
        ))}
      </div>
    </div>
  );
}
