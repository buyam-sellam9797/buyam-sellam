"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase, getMyAddresses, type Product, type BuyerAddress } from "@/lib/supabase";
import { haversineDistanceKm, calculateDistanceDeliveryFeeFcfa } from "@/lib/delivery";
import { formatFcfa } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";

type Status = "form" | "waiting" | "held" | "failed";

export default function CheckoutForm({
  product,
  initialQuantity = 1,
  deliveryFee = 0,
}: {
  product: Product;
  initialQuantity?: number;
  deliveryFee?: number;
}) {
  const { t } = useLocale();
  const [provider, setProvider] = useState<"mtn" | "orange">("mtn");
  const [phone, setPhone] = useState("");
  const [quantity, setQuantity] = useState(initialQuantity);
  const [deliveryName, setDeliveryName] = useState("");
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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxQuantity = Math.max(1, product.stock_quantity);

  // Automatic, distance-based delivery pricing: once we know both the
  // shop's pinned location and the buyer's, the flat delivery fee (used
  // otherwise) is replaced by a price calculated from the real
  // distance between them. Recomputes live as the buyer shares their
  // location or picks a different saved address.
  const distanceKm = useMemo(() => {
    if (buyerLat == null || buyerLng == null) return null;
    if (product.shop?.latitude == null || product.shop?.longitude == null) return null;
    return haversineDistanceKm(product.shop.latitude, product.shop.longitude, buyerLat, buyerLng);
  }, [buyerLat, buyerLng, product.shop?.latitude, product.shop?.longitude]);
  const effectiveDeliveryFee =
    distanceKm != null ? calculateDistanceDeliveryFeeFcfa(distanceKm, deliveryFee) : deliveryFee;
  const total = product.price_fcfa * quantity + effectiveDeliveryFee;

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
    setBuyerLat(a.latitude);
    setBuyerLng(a.longitude);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("waiting");

    try {
      const startRes = await fetch("/api/checkout", {
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
          deliveryCity,
          deliveryNeighborhood,
          deliveryAddress,
          deliveryNotes,
          ...(buyerLat != null && buyerLng != null
            ? { deliveryLatitude: buyerLat, deliveryLongitude: buyerLng }
            : {}),
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
            {formatFcfa(total)} {t.checkout.heldBody}
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
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <p className="text-xs font-semibold text-neutral-500 mb-3">{t.checkout.orderSummaryTitle}</p>
        <div className="flex gap-3 items-center mb-3">
          <div className="relative w-14 h-14 rounded-lg bg-neutral-100 flex items-center justify-center overflow-hidden shrink-0">
            {product.image_urls?.[0] ? (
              <Image src={product.image_urls[0]} alt={product.title} fill sizes="56px" className="object-cover" />
            ) : (
              <span className="text-2xl">🛍️</span>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{product.title}</p>
            <p className="text-xs text-neutral-500">{product.shop?.shop_name}</p>
          </div>
        </div>
        <div className="border-t border-neutral-100 pt-3 flex items-center justify-between text-sm">
          <span className="text-neutral-500">{t.checkout.productLabel}</span>
          <span>{formatFcfa(product.price_fcfa)}</span>
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
              {distanceKm != null && ` (${distanceKm.toFixed(1)} km)`}
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
              className="text-xs rounded-full border border-neutral-300 px-3 py-1.5 hover:border-neutral-900 disabled:opacity-60"
            >
              {locating
                ? t.checkout.locating
                : buyerLat != null
                  ? t.checkout.locationSet
                  : t.checkout.useMyLocation}
            </button>
            {locationError && <p className="text-xs text-red-600 mt-1">{locationError}</p>}
          </div>
        )}
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
        {status === "waiting" ? t.checkout.checkingPhone : `${t.checkout.payButton} ${formatFcfa(total)}`}
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
