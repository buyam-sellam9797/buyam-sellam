"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase, type GroupBuy, type Product } from "@/lib/supabase";
import { formatFcfa } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";
import { IconBag, IconLock } from "@/components/dash-icons";

type Status = "form" | "waiting" | "held" | "failed";

// Joining a group buy is its own small checkout, deliberately separate
// from the regular one in checkout/[id]/checkout-form.tsx: the price
// is the campaign's fixed group_price_fcfa rather than the product's
// own price, there's no layaway/SebPay option (this is NotchPay-only,
// same scope cut as layaway v1), and a successful payment here doesn't
// mean "shipping now" — see completeGroupBuyJoin/tryFinalizeGroupBuy in
// order-fulfillment.ts for what actually happens next.
export default function JoinGroupBuyForm({ groupBuy, product }: { groupBuy: GroupBuy; product: Product }) {
  const { t } = useLocale();
  const [quantity, setQuantity] = useState(1);
  const [provider, setProvider] = useState<"mtn" | "orange">("mtn");
  const [phone, setPhone] = useState("");
  const [deliveryName, setDeliveryName] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [deliveryPhoneTouched, setDeliveryPhoneTouched] = useState(false);
  const [deliveryCity, setDeliveryCity] = useState(product.shop?.city ?? "");
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [status, setStatus] = useState<Status>("form");
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Date.now() is impure, so it's read via a lazy initializer (runs
  // once, on mount) rather than directly during render — same pattern
  // as order-status.tsx's AUTO_RELEASE_DAYS countdown.
  const [now] = useState<number>(() => Date.now());

  const maxQuantity = Math.max(1, product.stock_quantity);
  const deliveryFee = product.shop?.delivery_fee_fcfa ?? 0;
  const total = groupBuy.group_price_fcfa * quantity + deliveryFee;
  const joined = groupBuy.joined_quantity ?? 0;
  const deadlinePassed = new Date(groupBuy.deadline).getTime() < now;
  const isOpen = groupBuy.status === "open" && !deadlinePassed;

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) setAccessToken(session.access_token);
    })();
  }, []);

  function handlePhoneChange(value: string) {
    setPhone(value);
    if (!deliveryPhoneTouched) setDeliveryPhone(value);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("waiting");

    try {
      const startRes = await fetch(`/api/group-buy/${groupBuy.id}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          productId: product.id,
          quantity,
          provider,
          phone,
          deliveryName,
          deliveryPhone: deliveryPhone || phone,
          deliveryCity,
          deliveryNeighborhood,
          deliveryAddress,
          deliveryNotes,
        }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) {
        setError(startData.error ?? t.groupBuyJoin.errorStart);
        setStatus("failed");
        return;
      }

      const reference: string = startData.reference;
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts += 1;
        try {
          const checkRes = await fetch(`/api/group-buy/${groupBuy.id}/join?reference=${encodeURIComponent(reference)}`);
          const checkData = await checkRes.json();
          if (checkData.status === "complete") {
            if (pollRef.current) clearInterval(pollRef.current);
            setStatus("held");
          } else if (checkData.status === "failed" || checkData.status === "canceled") {
            if (pollRef.current) clearInterval(pollRef.current);
            setError(t.groupBuyJoin.errorNotApproved);
            setStatus("failed");
          }
        } catch {
          // transient network hiccup while polling — keep trying until timeout
        }
        if (attempts >= 20) {
          if (pollRef.current) clearInterval(pollRef.current);
          setError(t.groupBuyJoin.errorTimeout);
          setStatus("failed");
        }
      }, 3000);
    } catch {
      setError(t.groupBuyJoin.errorUnreachable);
      setStatus("failed");
    }
  }

  if (!isOpen) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-600">
        {t.groupBuyJoin.notOpen}
      </div>
    );
  }

  if (status === "held") {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-sm text-green-900">
          <p className="font-semibold mb-1">{t.groupBuyJoin.heldTitle}</p>
          <p>
            {t.groupBuyJoin.heldBody
              .replace("{amount}", formatFcfa(total))
              .replace("{target}", String(groupBuy.target_quantity))}
          </p>
        </div>
        <Link
          href="/account"
          className="rounded-full border border-neutral-300 px-6 py-3 text-sm font-semibold text-center hover:border-neutral-900"
        >
          {t.groupBuyJoin.trackOrder}
        </Link>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {error ?? t.groupBuyJoin.errorGeneric}
        </div>
        <button
          onClick={() => setStatus("form")}
          className="rounded-full border border-neutral-300 px-6 py-3 text-sm font-semibold hover:border-neutral-900"
        >
          {t.groupBuyJoin.tryAgain}
        </button>
      </div>
    );
  }

  const pct = Math.min(100, Math.round((joined / groupBuy.target_quantity) * 100));

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <p className="text-xs font-semibold text-neutral-500 mb-3">{t.groupBuyJoin.orderSummaryTitle}</p>
        <div className="flex gap-3 items-center mb-3">
          <div className="relative w-14 h-14 rounded-lg bg-neutral-100 flex items-center justify-center overflow-hidden shrink-0">
            {product.image_urls?.[0] ? (
              <Image src={product.image_urls[0]} alt={product.title} fill sizes="56px" className="object-cover" />
            ) : (
              <IconBag className="w-6 h-6 text-neutral-300" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{product.title}</p>
            <p className="text-xs text-neutral-500">{product.shop?.shop_name}</p>
          </div>
        </div>
        <div className="mb-2">
          <div className="h-1.5 rounded-full overflow-hidden bg-neutral-100">
            <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            {t.groupBuyJoin.joinedLabel.replace("{joined}", String(joined)).replace("{target}", String(groupBuy.target_quantity))} ·{" "}
            {t.groupBuyJoin.endsLabel.replace("{date}", new Date(groupBuy.deadline).toLocaleDateString())}
          </p>
        </div>
        <div className="border-t border-neutral-100 pt-3 flex items-center justify-between text-sm">
          <span className="text-neutral-500">{t.groupBuyJoin.groupPriceLabel}</span>
          <span className="font-semibold text-amber-600">{formatFcfa(groupBuy.group_price_fcfa)}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-1.5">
          <span className="text-neutral-500">{t.groupBuyJoin.quantityLabel}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-6 h-6 rounded-full border border-neutral-300 text-xs font-semibold hover:border-neutral-900"
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="w-5 text-center">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
              className="w-6 h-6 rounded-full border border-neutral-300 text-xs font-semibold hover:border-neutral-900"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
        </div>
        {deliveryFee > 0 && (
          <div className="flex items-center justify-between text-sm mt-1.5">
            <span className="text-neutral-500">{t.groupBuyJoin.deliveryFeeLabel}</span>
            <span>{formatFcfa(deliveryFee)}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm font-semibold mt-1.5">
          <span>{t.groupBuyJoin.totalLabel}</span>
          <span>{formatFcfa(total)}</span>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">{t.groupBuyJoin.deliveryInfoTitle}</p>
        <div className="flex flex-col gap-3">
          <input
            required
            value={deliveryName}
            onChange={(e) => setDeliveryName(e.target.value)}
            placeholder={t.groupBuyJoin.deliveryNamePlaceholder}
            aria-label={t.groupBuyJoin.deliveryNameLabel}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            required
            type="tel"
            value={deliveryPhone}
            onChange={(e) => {
              setDeliveryPhone(e.target.value);
              setDeliveryPhoneTouched(true);
            }}
            placeholder={t.groupBuyJoin.deliveryPhonePlaceholder}
            aria-label={t.groupBuyJoin.deliveryPhoneLabel}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              value={deliveryCity}
              onChange={(e) => setDeliveryCity(e.target.value)}
              placeholder={t.groupBuyJoin.deliveryCityLabel}
              aria-label={t.groupBuyJoin.deliveryCityLabel}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <input
              value={deliveryNeighborhood}
              onChange={(e) => setDeliveryNeighborhood(e.target.value)}
              placeholder={t.groupBuyJoin.deliveryNeighborhoodPlaceholder}
              aria-label={t.groupBuyJoin.deliveryNeighborhoodLabel}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <input
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            placeholder={t.groupBuyJoin.deliveryAddressPlaceholder}
            aria-label={t.groupBuyJoin.deliveryAddressLabel}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <textarea
            value={deliveryNotes}
            onChange={(e) => setDeliveryNotes(e.target.value)}
            placeholder={t.groupBuyJoin.deliveryNotesLabel}
            rows={2}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium block mb-2">{t.groupBuyJoin.payWithLabel}</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setProvider("mtn")}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              provider === "mtn" ? "border-amber-500 bg-amber-50" : "border-neutral-300"
            }`}
          >
            {t.groupBuyJoin.mtn}
          </button>
          <button
            type="button"
            onClick={() => setProvider("orange")}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              provider === "orange" ? "border-amber-500 bg-amber-50" : "border-neutral-300"
            }`}
          >
            {t.groupBuyJoin.orange}
          </button>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium block mb-2" htmlFor="phone">
          {t.groupBuyJoin.phoneLabel}
        </label>
        <input
          id="phone"
          required
          value={phone}
          onChange={(e) => handlePhoneChange(e.target.value)}
          placeholder={t.groupBuyJoin.phonePlaceholder}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={status === "waiting"}
        className="rounded-full bg-neutral-900 text-white font-semibold px-6 py-3 hover:bg-neutral-700 disabled:opacity-60"
      >
        {status === "waiting" ? t.groupBuyJoin.checkingPhone : `${t.groupBuyJoin.joinButton} ${formatFcfa(total)}`}
      </button>
      {status === "waiting" && <p className="text-xs text-neutral-500 text-center">{t.groupBuyJoin.waitingNote}</p>}
      <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center inline-flex items-center justify-center gap-1">
        <IconLock className="w-3 h-3 shrink-0" /> {t.groupBuyJoin.protectionNotice}
      </p>
    </form>
  );
}
