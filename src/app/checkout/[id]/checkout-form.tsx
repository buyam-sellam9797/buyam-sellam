"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase, getMyAddresses, type Product, type BuyerAddress, type DeliveryZone } from "@/lib/supabase";
import { haversineDistanceKm, calculateDistanceDeliveryFeeFcfa } from "@/lib/delivery";
import { formatFcfa } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";
import type { SebpayOperator } from "@/lib/sebpay";
import { IconBag, IconPin, IconLock } from "@/components/dash-icons";
import { resolveLayawaySettings, computeLayawayPlan } from "@/lib/layaway";

type Status = "form" | "waiting" | "held" | "failed";
type Gateway = "notchpay" | "sebpay";

export default function CheckoutForm({
  product,
  initialQuantity = 1,
  deliveryFee = 0,
  deliveryZones = [],
  sebpayOperators = [],
}: {
  product: Product;
  initialQuantity?: number;
  deliveryFee?: number;
  deliveryZones?: DeliveryZone[];
  sebpayOperators?: SebpayOperator[];
}) {
  const { t } = useLocale();
  // NotchPay stays the default in every case — SebPay is an extra
  // option that only ever appears once the checkout page has already
  // confirmed (live, from SebPay itself) that this account has it
  // enabled for Cameroon. See src/lib/sebpay.ts.
  const [gateway, setGateway] = useState<Gateway>("notchpay");
  // Layaway (pay a deposit now, the rest later from /account) is
  // NotchPay-only in v1 — SebPay's per-charge OTP flow doesn't fit a
  // "come back another day and charge again" pattern without more
  // design work. Switching to SebPay always drops back to "full" so a
  // buyer can never end up on the SebPay gateway with layaway selected.
  const [paymentPlan, setPaymentPlan] = useState<"full" | "layaway">("full");
  const [provider, setProvider] = useState<"mtn" | "orange">("mtn");
  const [sebpayOperator, setSebpayOperator] = useState<string>(sebpayOperators[0]?.slug ?? "");
  const [sebpayOtpCode, setSebpayOtpCode] = useState("");
  const [phone, setPhone] = useState("");
  const [quantity, setQuantity] = useState(initialQuantity);
  const [deliveryName, setDeliveryName] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [deliveryPhoneTouched, setDeliveryPhoneTouched] = useState(false);
  const [isGift, setIsGift] = useState(false);
  const [giftNote, setGiftNote] = useState("");
  const [deliveryCity, setDeliveryCity] = useState(product.shop?.city ?? "");
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [status, setStatus] = useState<Status>("form");
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<BuyerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [buyerLat, setBuyerLat] = useState<number | null>(null);
  const [buyerLng, setBuyerLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string>(deliveryZones[0]?.id ?? "");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxQuantity = Math.max(1, product.stock_quantity);

  // Promotions: a seller-set sale price always wins when present — same
  // rule the server applies at checkout, so the price shown here is
  // exactly what gets charged.
  const unitPrice = product.sale_price_fcfa ?? product.price_fcfa;

  // Automatic, distance-based delivery pricing: once we know both the
  // shop's pinned location and the buyer's, the flat delivery fee (used
  // otherwise) is replaced by a price calculated from the real
  // distance between them. Recomputes live as the buyer shares their
  // location or picks a different saved address. Skipped entirely once
  // the shop has configured named delivery zones (below) — those
  // replace this instead of stacking with it.
  const distanceKm = useMemo(() => {
    if (buyerLat == null || buyerLng == null) return null;
    if (product.shop?.latitude == null || product.shop?.longitude == null) return null;
    return haversineDistanceKm(product.shop.latitude, product.shop.longitude, buyerLat, buyerLng);
  }, [buyerLat, buyerLng, product.shop?.latitude, product.shop?.longitude]);

  const selectedZone = deliveryZones.find((z) => z.id === selectedZoneId) ?? null;
  const effectiveDeliveryFee =
    deliveryZones.length > 0
      ? (selectedZone?.fee_fcfa ?? 0)
      : distanceKm != null
        ? calculateDistanceDeliveryFeeFcfa(distanceKm, deliveryFee)
        : deliveryFee;
  const total = unitPrice * quantity + effectiveDeliveryFee;

  // The seller's own installment plan (shop setting + optional
  // per-product override), computed with the same helper the server
  // uses in /api/layaway/route.ts — shown here only so the buyer knows
  // exactly what they'll pay and when; the server recomputes it from
  // the authoritative price rather than trusting anything sent from here.
  const layawaySettings = resolveLayawaySettings(product.shop, product.layaway_installments);
  const layawayPlan = layawaySettings.enabled ? computeLayawayPlan(total, layawaySettings) : [];
  const layawayAvailable = layawayPlan.length >= 2;
  const layawayDeposit = layawayPlan[0]?.amountFcfa ?? 0;
  const layawayFinal = total - layawayDeposit;

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocationError(t.checkout.locationUnsupported);
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBuyerLat(pos.coords.latitude);
        setBuyerLng(pos.coords.longitude);
        setLocating(false);
      },
      () => {
        setLocationError(t.checkout.locationDenied);
        setLocating(false);
      },
      { timeout: 10000 }
    );
  }

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // If the buyer is logged in, offer their saved addresses as a
  // one-tap pick, and attach their session so the order lands in their
  // account's order history instead of being guest-only. Purely
  // additive — guests see none of this and checkout works unchanged.
  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      setAccessToken(session.access_token);
      const myAddresses = await getMyAddresses();
      setAddresses(myAddresses);
      const preferred = myAddresses.find((a) => a.is_default) ?? myAddresses[0];
      if (preferred) applyAddress(preferred);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyAddress(a: BuyerAddress) {
    setSelectedAddressId(a.id);
    setDeliveryName(a.full_name);
    setDeliveryCity(a.city);
    setDeliveryNeighborhood(a.neighborhood ?? "");
    setDeliveryAddress(a.address ?? "");
    if (!phone) setPhone(a.phone);
    // A saved address is the buyer's own — only pre-fill the delivery
    // contact number from it when this isn't a gift order (where the
    // recipient's number is deliberately different and shouldn't be
    // silently overwritten by picking a saved address).
    if (!isGift) {
      setDeliveryPhone(a.phone);
      setDeliveryPhoneTouched(false);
    }
    setBuyerLat(a.latitude);
    setBuyerLng(a.longitude);
  }

  // By default, the delivery contact number mirrors the mobile money
  // phone — most orders are for the person paying — but only until the
  // buyer explicitly edits it, or marks this as a gift (at which point
  // it's cleared so they have to enter the actual recipient's number
  // rather than accidentally leaving their own). Mirrored directly from
  // the momo phone field's own onChange below (not a useEffect syncing
  // one state into another) so there's no render where the two are
  // briefly out of sync.
  function handlePhoneChange(value: string) {
    setPhone(value);
    if (!isGift && !deliveryPhoneTouched) setDeliveryPhone(value);
  }

  function handleToggleGift(next: boolean) {
    setIsGift(next);
    if (next) {
      setDeliveryPhone("");
      setDeliveryPhoneTouched(true);
    } else {
      setDeliveryPhoneTouched(false);
      setDeliveryPhone(phone);
      setGiftNote("");
    }
  }

  const activeSebpayOperator = sebpayOperators.find((o) => o.slug === sebpayOperator) ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (gateway === "sebpay" && activeSebpayOperator?.otpRequired && !sebpayOtpCode) {
      setError(t.checkout.errorOtpRequired);
      return;
    }

    setStatus("waiting");

    try {
      const sharedBody = {
        productId: product.id,
        quantity,
        phone,
        deliveryName,
        deliveryPhone: deliveryPhone || phone,
        isGift,
        giftNote: isGift ? giftNote : undefined,
        deliveryCity,
        deliveryNeighborhood,
        deliveryAddress,
        deliveryNotes,
        ...(buyerLat != null && buyerLng != null
          ? { deliveryLatitude: buyerLat, deliveryLongitude: buyerLng }
          : {}),
        ...(selectedZone ? { deliveryZoneId: selectedZone.id } : {}),
      };

      const startUrl =
        gateway === "sebpay" ? "/api/checkout/sebpay" : paymentPlan === "layaway" ? "/api/layaway" : "/api/checkout";
      const startRes = await fetch(startUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(
          gateway === "sebpay"
            ? { ...sharedBody, operator: sebpayOperator, otpCode: sebpayOtpCode || undefined }
            : { ...sharedBody, provider }
        ),
      });
      const startData = await startRes.json();
      if (!startRes.ok) {
        setError(startData.error ?? t.checkout.errorStart);
        setStatus("failed");
        return;
      }

      setOrderId(startData.orderId ?? null);
      let attempts = 0;

      if (gateway === "sebpay") {
        const transactionId: string = startData.transactionId;
        const orderReference: string = startData.orderReference;
        pollRef.current = setInterval(async () => {
          attempts += 1;
          try {
            const checkRes = await fetch(
              `/api/checkout/sebpay?transactionId=${encodeURIComponent(transactionId)}&orderReference=${encodeURIComponent(orderReference)}`
            );
            const checkData = await checkRes.json();
            if (checkData.status === "approved") {
              if (pollRef.current) clearInterval(pollRef.current);
              setStatus("held");
            } else if (checkData.status === "rejected") {
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
        return;
      }

      const reference: string = startData.reference;
      const orderReference: string = startData.orderReference;
      const pollUrl =
        paymentPlan === "layaway"
          ? `/api/layaway?reference=${encodeURIComponent(reference)}`
          : `/api/checkout?reference=${encodeURIComponent(reference)}&orderReference=${encodeURIComponent(orderReference)}`;
      pollRef.current = setInterval(async () => {
        attempts += 1;
        try {
          const checkRes = await fetch(pollUrl);
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
          <p className="font-semibold mb-1">
            {paymentPlan === "layaway" ? t.checkout.layawayHeldTitle : t.checkout.heldTitle}
          </p>
          <p>
            {paymentPlan === "layaway"
              ? t.checkout.layawayHeldBody
                  .replace("{deposit}", formatFcfa(layawayDeposit))
                  .replace("{final}", formatFcfa(layawayFinal))
                  .replace("{count}", String(layawayPlan.length - 1))
              : `${formatFcfa(total)} ${t.checkout.heldBody}`}
          </p>
        </div>
        {orderId && (
          <Link
            href={paymentPlan === "layaway" ? "/account" : `/order/${orderId}`}
            className="rounded-full border border-neutral-300 px-6 py-3 text-sm font-semibold text-center hover:border-neutral-900"
          >
            {paymentPlan === "layaway" ? t.checkout.viewLayawayPlan : t.checkout.trackOrder}
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
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <p className="text-xs font-semibold text-neutral-500 mb-3">{t.checkout.orderSummaryTitle}</p>
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
        <div className="border-t border-neutral-100 pt-3 flex items-center justify-between text-sm">
          <span className="text-neutral-500">{t.checkout.productLabel}</span>
          {product.sale_price_fcfa != null ? (
            <span className="flex items-center gap-1.5">
              <span className="text-neutral-400 line-through text-xs">{formatFcfa(product.price_fcfa)}</span>
              <span className="font-semibold text-red-600">{formatFcfa(unitPrice)}</span>
            </span>
          ) : (
            <span>{formatFcfa(unitPrice)}</span>
          )}
        </div>
        <div className="flex items-center justify-between text-sm mt-1.5">
          <span className="text-neutral-500">{t.checkout.quantityLabel}</span>
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
        {effectiveDeliveryFee > 0 && (
          <div className="flex items-center justify-between text-sm mt-1.5">
            <span className="text-neutral-500">
              {t.checkout.deliveryFeeLabel}
              {selectedZone ? ` (${selectedZone.name})` : distanceKm != null ? ` (${distanceKm.toFixed(1)} km)` : ""}
            </span>
            <span>{formatFcfa(effectiveDeliveryFee)}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm font-semibold mt-1.5">
          <span>{t.checkout.totalLabel}</span>
          <span>{formatFcfa(total)}</span>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">{t.checkout.deliveryInfoTitle}</p>
        {deliveryZones.length > 0 && (
          <div className="mb-3">
            <label className="text-xs font-medium block mb-1 text-neutral-600">
              {t.checkout.deliveryZonePick}
            </label>
            <select
              value={selectedZoneId}
              onChange={(e) => setSelectedZoneId(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              {deliveryZones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name} — {formatFcfa(z.fee_fcfa)}
                  {z.eta_text ? ` (${z.eta_text})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
        {addresses.length > 0 && (
          <div className="mb-3">
            <select
              value={selectedAddressId}
              onChange={(e) => {
                const a = addresses.find((x) => x.id === e.target.value);
                if (a) applyAddress(a);
              }}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label || t.checkout.savedAddressFallbackLabel} — {a.city}
                </option>
              ))}
            </select>
          </div>
        )}
        {product.shop?.latitude != null && product.shop?.longitude != null && (
          <div className="mb-3">
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className="text-xs rounded-full border border-neutral-300 px-3 py-1.5 hover:border-neutral-900 disabled:opacity-60 inline-flex items-center gap-1"
            >
              {locating ? (
                t.checkout.locating
              ) : (
                <>
                  <IconPin className="w-3 h-3" />
                  {buyerLat != null ? t.checkout.locationSet : t.checkout.useMyLocation}
                </>
              )}
            </button>
            {locationError && <p className="text-xs text-red-600 mt-1">{locationError}</p>}
          </div>
        )}
        <label className="flex items-center gap-2 text-xs text-neutral-600 mb-3">
          <input
            type="checkbox"
            checked={isGift}
            onChange={(e) => handleToggleGift(e.target.checked)}
          />
          {t.checkout.isGiftLabel}
        </label>
        {isGift && (
          <p className="text-xs text-neutral-500 mb-3">{t.checkout.isGiftNote}</p>
        )}
        <div className="flex flex-col gap-3">
          <input
            required
            value={deliveryName}
            onChange={(e) => setDeliveryName(e.target.value)}
            placeholder={isGift ? t.checkout.recipientNamePlaceholder : t.checkout.deliveryNamePlaceholder}
            aria-label={t.checkout.deliveryNameLabel}
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
            placeholder={isGift ? t.checkout.recipientPhonePlaceholder : t.checkout.deliveryPhonePlaceholder}
            aria-label={t.checkout.deliveryPhoneLabel}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          {isGift && (
            <textarea
              value={giftNote}
              onChange={(e) => setGiftNote(e.target.value)}
              placeholder={t.checkout.giftNotePlaceholder}
              rows={2}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          )}
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

      {sebpayOperators.length > 0 && (
        <div>
          <label className="text-sm font-medium block mb-2">{t.checkout.paymentMethodLabel}</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setGateway("notchpay")}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                gateway === "notchpay" ? "border-amber-500 bg-amber-50" : "border-neutral-300"
              }`}
            >
              {t.checkout.gatewayNotchpay}
            </button>
            <button
              type="button"
              onClick={() => {
                setGateway("sebpay");
                setPaymentPlan("full");
              }}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                gateway === "sebpay" ? "border-amber-500 bg-amber-50" : "border-neutral-300"
              }`}
            >
              {t.checkout.gatewaySebpay}
            </button>
          </div>
        </div>
      )}

      {gateway === "notchpay" ? (
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
      ) : (
        <div>
          <label className="text-sm font-medium block mb-2">{t.checkout.sebpayOperatorLabel}</label>
          <div className="grid grid-cols-2 gap-2">
            {sebpayOperators.map((op) => (
              <button
                key={op.slug}
                type="button"
                onClick={() => {
                  setSebpayOperator(op.slug);
                  setSebpayOtpCode("");
                }}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  sebpayOperator === op.slug ? "border-amber-500 bg-amber-50" : "border-neutral-300"
                }`}
              >
                {op.name}
              </button>
            ))}
          </div>
          {activeSebpayOperator?.otpRequired && (
            <div className="mt-3">
              <p className="text-xs text-neutral-500 mb-2">
                {activeSebpayOperator.ussdCode
                  ? t.checkout.sebpayOtpInstructions.replace("{ussd}", activeSebpayOperator.ussdCode)
                  : t.checkout.sebpayOtpInstructionsNoUssd}
              </p>
              <label className="text-sm font-medium block mb-2" htmlFor="sebpay-otp">
                {t.checkout.sebpayOtpLabel}
              </label>
              <input
                id="sebpay-otp"
                required
                value={sebpayOtpCode}
                onChange={(e) => setSebpayOtpCode(e.target.value)}
                placeholder={t.checkout.sebpayOtpPlaceholder}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
          )}
        </div>
      )}

      {gateway === "notchpay" && layawayAvailable && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <label className="flex items-start gap-2.5 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={paymentPlan === "layaway"}
              onChange={(e) => setPaymentPlan(e.target.checked ? "layaway" : "full")}
            />
            <span>
              <span className="font-medium block">
                {t.checkout.layawayLabel.replace("{count}", String(layawayPlan.length))}
              </span>
              <span className="text-xs text-neutral-500">
                {t.checkout.layawayNote
                  .replace("{deposit}", formatFcfa(layawayDeposit))
                  .replace("{final}", formatFcfa(layawayFinal))
                  .replace("{count}", String(layawayPlan.length - 1))}
              </span>
            </span>
          </label>
          {paymentPlan === "layaway" && (
            <ol className="mt-3 ml-7 flex flex-col gap-1 text-xs text-neutral-600">
              {layawayPlan.map((p) => (
                <li key={p.installmentNumber} className="flex justify-between gap-3">
                  <span>
                    {p.dueInDays === 0
                      ? t.checkout.layawayToday
                      : t.checkout.layawayInDays.replace("{days}", String(p.dueInDays))}
                  </span>
                  <span className="font-medium text-neutral-900">{formatFcfa(p.amountFcfa)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <div>
        <label className="text-sm font-medium block mb-2" htmlFor="phone">
          {t.checkout.phoneLabel}
        </label>
        <input
          id="phone"
          required
          value={phone}
          onChange={(e) => handlePhoneChange(e.target.value)}
          placeholder={t.checkout.phonePlaceholder}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={status === "waiting"}
        className="rounded-full bg-neutral-900 text-white font-semibold px-6 py-3 hover:bg-neutral-700 disabled:opacity-60"
      >
        {status === "waiting"
          ? t.checkout.checkingPhone
          : paymentPlan === "layaway"
            ? `${t.checkout.payDepositButton} ${formatFcfa(layawayDeposit)}`
            : `${t.checkout.payButton} ${formatFcfa(total)}`}
      </button>
      {status === "waiting" && (
        <p className="text-xs text-neutral-500 text-center">{t.checkout.waitingNote}</p>
      )}
      <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center inline-flex items-center justify-center gap-1">
        <IconLock className="w-3 h-3 shrink-0" /> {t.checkout.protectionNotice}
      </p>
    </form>
  );
}
