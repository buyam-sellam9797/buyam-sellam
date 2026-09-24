"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { addToBag } from "@/lib/bag";
import { formatFcfa } from "@/lib/format";
import { useLocale } from "./locale-provider";
import { OfferSheet, offerErrorText, type OfferApiError } from "./offer-sheet";
import { IconBag, IconCheckCircle } from "./dash-icons";

type MyOffer = {
  id: string;
  amount_fcfa: number;
  counter_fcfa: number | null;
  agreed_fcfa: number | null;
  status: "pending" | "countered" | "accepted" | "declined" | "withdrawn" | "expired" | "paid";
  expires_at: string;
  pay_by: string | null;
  created_at: string;
};

function hoursLeft(iso: string | null) {
  if (!iso) return 0;
  return Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 3600_000));
}

function liveStatus(o: MyOffer): MyOffer["status"] {
  const now = Date.now();
  if ((o.status === "pending" || o.status === "countered") && new Date(o.expires_at).getTime() < now) return "expired";
  if (o.status === "accepted" && o.pay_by && new Date(o.pay_by).getTime() < now) return "expired";
  return o.status;
}

// Everything a buyer can do on a product page: pick a quantity, buy
// now, put it in the bag for later, or — when the seller is open to
// offers — negotiate. An offer in progress replaces the offer button
// with its live state (waiting / counter-offer / deal to pay).
export function PurchasePanel({
  productId,
  productTitle,
  shopId,
  stock,
  listPrice,
  acceptsOffers,
}: {
  productId: string;
  productTitle: string;
  shopId: string;
  stock: number;
  listPrice: number;
  acceptsOffers: boolean;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState<null | "added" | "full">(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [offer, setOffer] = useState<MyOffer | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadOffer = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("offers")
      .select("id, amount_fcfa, counter_fcfa, agreed_fcfa, status, expires_at, pay_by, created_at")
      .eq("product_id", productId)
      .eq("buyer_id", uid)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setOffer((data as MyOffer | null) ?? null);
  }, [productId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled || !data.session) return;
      setToken(data.session.access_token);
      setUserId(data.session.user.id);
      if (acceptsOffers) await loadOffer(data.session.user.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [acceptsOffers, loadOffer]);

  if (stock <= 0) {
    return (
      <div className="mt-6 w-full text-center rounded-full bg-neutral-100 text-neutral-400 font-semibold px-6 py-3">
        {t.product.outOfStock}
      </div>
    );
  }

  const loginHref = `/login?next=${encodeURIComponent(`/product/${productId}`)}`;

  async function sendOffer(amount: number, message: string): Promise<string | null> {
    if (!token) return t.offers.errors.login;
    const res = await fetch("/api/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ productId, amount, message }),
    });
    const data = (await res.json().catch(() => ({}))) as OfferApiError & { offer?: MyOffer };
    if (!res.ok || !data.offer) return offerErrorText(t, data);
    setOffer(data.offer);
    setSheetOpen(false);
    setNotice(
      data.offer.status === "accepted"
        ? t.offers.resultAccepted.replace("{amount}", formatFcfa(data.offer.agreed_fcfa ?? amount))
        : data.offer.status === "declined"
          ? t.offers.resultDeclined
          : t.offers.resultPending
    );
    return null;
  }

  async function act(action: "accept_counter" | "decline_counter" | "withdraw") {
    if (!offer || !token || busy) return;
    setBusy(true);
    const res = await fetch(`/api/offers/${offer.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action }),
    });
    const data = (await res.json().catch(() => ({}))) as OfferApiError & { offer?: MyOffer };
    setBusy(false);
    if (data.offer) {
      setOffer(data.offer);
      setNotice(null);
    } else {
      setNotice(offerErrorText(t, data));
      if (userId) await loadOffer(userId);
    }
  }

  const status = offer ? liveStatus(offer) : null;
  const offerOpen = status === "pending" || status === "countered" || status === "accepted";

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-neutral-700">{t.product.quantityLabel}</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="w-8 h-8 rounded-full border border-neutral-300 text-neutral-700 font-semibold hover:border-neutral-900"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="w-6 text-center text-sm font-semibold">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(stock, q + 1))}
            className="w-8 h-8 rounded-full border border-neutral-300 text-neutral-700 font-semibold hover:border-neutral-900"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
      </div>
      <p className="text-xs text-neutral-500 mb-3 text-right">
        {stock} {t.product.availableOther}
      </p>

      {offer && status && acceptsOffers && (
        <OfferStatusCard
          offer={offer}
          status={status}
          busy={busy}
          onPay={() => router.push(`/checkout/${productId}?offer=${offer.id}`)}
          onAcceptCounter={() => act("accept_counter")}
          onDeclineCounter={() => act("decline_counter")}
          onWithdraw={() => act("withdraw")}
          onRetry={() => setSheetOpen(true)}
        />
      )}
      {notice && <p className="mb-3 text-sm rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2 text-neutral-700">{notice}</p>}

      <button
        type="button"
        onClick={() => router.push(`/checkout/${productId}?qty=${quantity}`)}
        className="w-full text-center rounded-full bg-neutral-900 text-white font-semibold px-6 py-3 hover:bg-neutral-700"
      >
        {t.product.buyNow}
      </button>
      <div className={`mt-2 grid gap-2 ${acceptsOffers && !offerOpen ? "grid-cols-2" : "grid-cols-1"}`}>
        <button
          type="button"
          onClick={() => setAdded(addToBag({ productId, shopId, quantity, max: stock }) === "full" ? "full" : "added")}
          className="rounded-full border border-neutral-300 px-4 py-2.5 text-sm font-semibold hover:border-neutral-900 inline-flex items-center justify-center gap-1.5"
        >
          <IconBag className="w-4 h-4" /> {t.bag.addToBag}
        </button>
        {acceptsOffers && !offerOpen && (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="rounded-full border border-amber-400 bg-amber-50 text-amber-900 px-4 py-2.5 text-sm font-semibold hover:border-amber-600"
          >
            {t.offers.makeOffer}
          </button>
        )}
      </div>
      {added === "added" && (
        <p className="mt-2 text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5">
            <IconCheckCircle className="w-4 h-4" /> {t.bag.added}
          </span>
          <Link href="/bag" className="font-semibold underline">
            {t.bag.viewBag}
          </Link>
        </p>
      )}
      {added === "full" && <p className="mt-2 text-sm text-amber-800">{t.bag.full}</p>}

      {sheetOpen && (
        <OfferSheet
          productTitle={productTitle}
          listPrice={listPrice}
          loggedIn={Boolean(token)}
          loginHref={loginHref}
          onClose={() => setSheetOpen(false)}
          onSubmit={sendOffer}
        />
      )}
    </div>
  );
}

function OfferStatusCard({
  offer,
  status,
  busy,
  onPay,
  onAcceptCounter,
  onDeclineCounter,
  onWithdraw,
  onRetry,
}: {
  offer: MyOffer;
  status: MyOffer["status"];
  busy: boolean;
  onPay: () => void;
  onAcceptCounter: () => void;
  onDeclineCounter: () => void;
  onWithdraw: () => void;
  onRetry: () => void;
}) {
  const { t } = useLocale();
  const amount = formatFcfa(offer.amount_fcfa);

  if (status === "accepted" && offer.agreed_fcfa) {
    return (
      <div className="mb-3 rounded-xl border border-green-300 bg-green-50 p-4">
        <p className="text-sm font-semibold text-green-900">{t.offers.statusAccepted.replace("{amount}", formatFcfa(offer.agreed_fcfa))}</p>
        <p className="text-xs text-green-800 mt-0.5 mb-3">{t.offers.statusAcceptedNote.replace("{hours}", String(hoursLeft(offer.pay_by)))}</p>
        <button type="button" onClick={onPay} className="w-full rounded-full bg-green-700 text-white font-semibold px-5 py-2.5 hover:bg-green-800">
          {t.offers.payDeal.replace("{amount}", formatFcfa(offer.agreed_fcfa))}
        </button>
      </div>
    );
  }
  if (status === "countered" && offer.counter_fcfa) {
    return (
      <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-950">{t.offers.statusCountered.replace("{amount}", formatFcfa(offer.counter_fcfa))}</p>
        <p className="text-xs text-amber-900 mt-0.5 mb-3">{t.offers.statusCounteredNote.replace("{hours}", String(hoursLeft(offer.expires_at)))}</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={onAcceptCounter} className="rounded-full bg-neutral-900 text-white font-semibold px-4 py-2.5 text-sm disabled:opacity-50">
            {t.offers.acceptCounter.replace("{amount}", formatFcfa(offer.counter_fcfa))}
          </button>
          <button type="button" disabled={busy} onClick={onDeclineCounter} className="rounded-full border border-neutral-300 bg-white font-semibold px-4 py-2.5 text-sm disabled:opacity-50">
            {t.offers.declineCounter}
          </button>
        </div>
      </div>
    );
  }
  if (status === "pending") {
    return (
      <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <p className="text-sm font-semibold">{t.offers.statusPending.replace("{amount}", amount)}</p>
        <p className="text-xs text-neutral-500 mt-0.5">{t.offers.statusPendingLeft.replace("{hours}", String(hoursLeft(offer.expires_at)))}</p>
        <button type="button" disabled={busy} onClick={onWithdraw} className="mt-2 text-xs font-semibold underline text-neutral-600 disabled:opacity-50">
          {t.offers.withdraw}
        </button>
      </div>
    );
  }
  if (status === "paid" && offer.agreed_fcfa) {
    return (
      <p className="mb-3 text-sm rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-green-800">
        {t.offers.statusPaid.replace("{amount}", formatFcfa(offer.agreed_fcfa))}
      </p>
    );
  }
  const closedText =
    status === "declined"
      ? t.offers.statusDeclined.replace("{amount}", amount)
      : status === "expired"
        ? t.offers.statusExpired.replace("{amount}", amount)
        : t.offers.statusWithdrawn;
  return (
    <div className="mb-3 rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2 text-sm text-neutral-600 flex items-center justify-between gap-2">
      <span>{closedText}</span>
      <button type="button" onClick={onRetry} className="text-xs font-semibold underline shrink-0">
        {t.offers.tryAgain}
      </button>
    </div>
  );
}
