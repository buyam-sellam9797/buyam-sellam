"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatFcfa } from "@/lib/format";
import { calculateCommission } from "@/lib/commission";
import { useLocale } from "@/components/locale-provider";
import type { Dictionary } from "@/lib/i18n";

type Tab = "overview" | "orders" | "sellers" | "products" | "disputes" | "payouts" | "admins";

type Overview = {
  totalUsers: number;
  totalSellers: number;
  totalProducts: number;
  totalOrders: number;
  openDisputes: number;
  gmvFcfa: number;
  heldFcfa: number;
  paidToSellersFcfa: number;
};

type AdminOrder = {
  id: string;
  status: string;
  total_amount_fcfa: number;
  buyer_phone: string | null;
  payout_sent: boolean;
  created_at: string;
  shop?: { shop_name: string } | null;
};

type AdminSeller = {
  id: string;
  shop_name: string;
  city: string;
  is_verified: boolean;
  is_active: boolean;
  verification_requested_at: string | null;
  verification_note: string | null;
  verification_id_photo_path: string | null;
  verification_rejected_reason: string | null;
  view_count: number;
  created_at: string;
  orderCount: number;
  rating: number;
  reviewCount: number;
};

type AdminProduct = {
  id: string;
  title: string;
  price_fcfa: number;
  stock_quantity: number;
  is_active: boolean;
  created_at: string;
  shop?: { shop_name: string } | null;
  category?: { name: string } | null;
};

type AdminDispute = {
  id: string;
  order_id: string;
  buyer_phone: string | null;
  reason: string;
  description: string | null;
  photo_url: string | null;
  status: "open" | "resolved";
  resolution: string | null;
  resolved_action: "refunded" | "released" | null;
  created_at: string;
  order?: { total_amount_fcfa: number; status: string } | null;
  shop?: { shop_name: string; whatsapp_number: string | null } | null;
};

type PayoutOrder = {
  id: string;
  total_amount_fcfa: number;
  buyer_phone: string | null;
  created_at: string;
  shop?: {
    shop_name: string;
    whatsapp_number: string | null;
    payout_provider: "mtn" | "orange" | null;
    payout_phone_number: string | null;
  } | null;
};

function disputeReasonLabel(reason: string, t: Dictionary): string {
  const map: Record<string, string> = {
    not_arrived: t.order.reasonNotArrived,
    wrong_product: t.order.reasonWrongProduct,
    damaged: t.order.reasonDamaged,
    different_than_described: t.order.reasonDifferent,
    seller_not_responding: t.order.reasonSellerNotResponding,
    other: t.order.reasonOther,
  };
  return map[reason] ?? reason;
}

export default function AdminPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [checking, setChecking] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        router.push("/login");
        return;
      }
      setToken(session.access_token);
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checking) {
    return <div className="mx-auto max-w-5xl px-4 py-16 text-center text-neutral-500">{t.admin.loading}</div>;
  }
  if (authError) {
    return <div className="mx-auto max-w-5xl px-4 py-16 text-center text-neutral-500">{authError}</div>;
  }
  if (!token) return null;

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: t.admin.tabOverview },
    { key: "orders", label: t.admin.tabOrders },
    { key: "sellers", label: t.admin.tabSellers },
    { key: "products", label: t.admin.tabProducts },
    { key: "disputes", label: t.admin.tabDisputes },
    { key: "payouts", label: t.admin.tabPayouts },
    { key: "admins", label: t.admin.tabAdmins },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">{t.admin.title}</h1>
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm rounded-full border border-neutral-300 px-4 py-1.5 hover:border-neutral-900 shrink-0"
        >
          {t.admin.logout}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-8 border-b border-neutral-200 pb-2">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`text-sm font-medium rounded-full px-4 py-1.5 ${
              tab === tb.key
                ? "bg-neutral-900 text-white"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab token={token} t={t} setAuthError={setAuthError} />}
      {tab === "orders" && <OrdersTab token={token} t={t} setAuthError={setAuthError} />}
      {tab === "sellers" && <SellersTab token={token} t={t} setAuthError={setAuthError} />}
      {tab === "products" && <ProductsTab token={token} t={t} setAuthError={setAuthError} />}
      {tab === "disputes" && <DisputesTab token={token} t={t} setAuthError={setAuthError} />}
      {tab === "payouts" && <PayoutsTab token={token} t={t} setAuthError={setAuthError} />}
      {tab === "admins" && <AdminsTab token={token} t={t} setAuthError={setAuthError} />}
    </div>
  );
}

async function authedFetch(url: string, token: string, init?: RequestInit) {
  return fetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

function OverviewTab({
  token,
  t,
  setAuthError,
}: {
  token: string;
  t: Dictionary;
  setAuthError: (e: string | null) => void;
}) {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await authedFetch("/api/admin/overview", token);
    const json = await res.json();
    if (!res.ok) {
      setAuthError(json.error ?? t.admin.notAuthorized);
      return;
    }
    setData(json);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (loading || !data) {
    return <p className="text-sm text-neutral-500">{t.admin.loading}</p>;
  }

  const tiles: { label: string; value: string }[] = [
    { label: t.admin.statTotalUsers, value: String(data.totalUsers) },
    { label: t.admin.statTotalSellers, value: String(data.totalSellers) },
    { label: t.admin.statTotalProducts, value: String(data.totalProducts) },
    { label: t.admin.statTotalOrders, value: String(data.totalOrders) },
    { label: t.admin.statGmv, value: formatFcfa(data.gmvFcfa) },
    { label: t.admin.statHeld, value: formatFcfa(data.heldFcfa) },
    { label: t.admin.statPaid, value: formatFcfa(data.paidToSellersFcfa) },
    { label: t.admin.statOpenDisputes, value: String(data.openDisputes) },
  ];

  return (
    <div className="grid sm:grid-cols-4 gap-4">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">{tile.label}</p>
          <p className="text-xl font-bold mt-1">{tile.value}</p>
        </div>
      ))}
    </div>
  );
}

function OrdersTab({
  token,
  t,
  setAuthError,
}: {
  token: string;
  t: Dictionary;
  setAuthError: (e: string | null) => void;
}) {
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);

  const load = useCallback(async () => {
    const res = await authedFetch("/api/admin/orders", token);
    const json = await res.json();
    if (!res.ok) {
      setAuthError(json.error ?? t.admin.notAuthorized);
      return;
    }
    setOrders(json.orders);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (!orders) return <p className="text-sm text-neutral-500">{t.admin.loading}</p>;
  if (orders.length === 0) return <p className="text-sm text-neutral-500">{t.admin.noneFound}</p>;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100 overflow-x-auto">
      {orders.map((o) => (
        <div key={o.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
          <div className="flex-1 min-w-[8rem]">
            <p className="font-medium">{o.shop?.shop_name ?? "—"}</p>
            <p className="text-xs text-neutral-500">{o.buyer_phone ?? "—"}</p>
          </div>
          <p className="w-28 text-right font-semibold">{formatFcfa(o.total_amount_fcfa)}</p>
          <p className="w-32 text-xs text-neutral-500">{t.dashboard.statusLabels[o.status] ?? o.status}</p>
          <p className="w-24 text-xs text-neutral-400">{new Date(o.created_at).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  );
}

function SellersTab({
  token,
  t,
  setAuthError,
}: {
  token: string;
  t: Dictionary;
  setAuthError: (e: string | null) => void;
}) {
  const [sellers, setSellers] = useState<AdminSeller[] | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [loadingPhotoId, setLoadingPhotoId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    const res = await authedFetch("/api/admin/sellers", token);
    const json = await res.json();
    if (!res.ok) {
      setAuthError(json.error ?? t.admin.notAuthorized);
      return;
    }
    setSellers(json.shops);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function toggleVerified(shop: AdminSeller) {
    setTogglingId(shop.id);
    await authedFetch("/api/admin/sellers", token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopId: shop.id, isVerified: !shop.is_verified }),
    });
    await load();
    setTogglingId(null);
  }

  async function viewPhoto(shop: AdminSeller) {
    setPhotoError(null);
    setLoadingPhotoId(shop.id);
    try {
      const res = await authedFetch("/api/admin/verification-photo", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId: shop.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPhotoError(json.error ?? t.admin.notAuthorized);
        return;
      }
      window.open(json.url, "_blank", "noopener,noreferrer");
    } finally {
      setLoadingPhotoId(null);
    }
  }

  async function submitReject(shop: AdminSeller) {
    setTogglingId(shop.id);
    await authedFetch("/api/admin/sellers", token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopId: shop.id, rejectVerification: true, rejectReason }),
    });
    setRejectingId(null);
    setRejectReason("");
    await load();
    setTogglingId(null);
  }

  if (!sellers) return <p className="text-sm text-neutral-500">{t.admin.loading}</p>;
  if (sellers.length === 0) return <p className="text-sm text-neutral-500">{t.admin.noneFound}</p>;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100">
      {photoError && <p className="text-xs text-red-600 px-4 pt-3">{photoError}</p>}
      {sellers.map((s) => (
        <div key={s.id} className="flex flex-col gap-2 p-4 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[8rem]">
              <p className="font-medium">{s.shop_name}</p>
              <p className="text-xs text-neutral-500">{s.city}</p>
            </div>
            <p className="w-20 text-xs text-neutral-500">
              {t.admin.colOrders}: {s.orderCount}
            </p>
            <p className="w-24 text-xs text-neutral-500">
              {s.reviewCount > 0 ? `⭐ ${s.rating.toFixed(1)}` : "—"}
            </p>
            <span
              className={`text-xs font-semibold rounded-full px-2.5 py-1 ${
                s.is_verified ? "bg-green-50 text-green-700 border border-green-200" : "bg-neutral-100 text-neutral-500"
              }`}
            >
              {s.is_verified ? `🛡️ ${t.admin.verifyBadge}` : t.admin.unverifyBadge}
            </span>
            {!s.is_verified && s.verification_requested_at && (
              <span className="text-xs font-semibold rounded-full px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200">
                {t.admin.verificationRequested}
              </span>
            )}
            {s.verification_id_photo_path && (
              <button
                onClick={() => viewPhoto(s)}
                disabled={loadingPhotoId === s.id}
                className="text-xs rounded-full border border-neutral-300 px-3 py-1.5 hover:border-neutral-900 disabled:opacity-60"
              >
                {loadingPhotoId === s.id ? t.admin.loading : t.admin.viewIdPhoto}
              </button>
            )}
            {!s.is_verified && s.verification_requested_at && rejectingId !== s.id && (
              <button
                onClick={() => setRejectingId(s.id)}
                className="text-xs rounded-full border border-red-300 text-red-700 px-3 py-1.5 hover:border-red-500 disabled:opacity-60"
              >
                {t.admin.rejectAction}
              </button>
            )}
            <button
              onClick={() => toggleVerified(s)}
              disabled={togglingId === s.id}
              className="text-xs rounded-full border border-neutral-300 px-3 py-1.5 hover:border-neutral-900 disabled:opacity-60"
            >
              {s.is_verified ? t.admin.unverifyAction : t.admin.verifyAction}
            </button>
          </div>
          {s.verification_note && (
            <p className="text-xs text-neutral-500">
              {t.admin.verificationNoteLabel} {s.verification_note}
            </p>
          )}
          {!s.is_verified && !s.verification_requested_at && s.verification_rejected_reason && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 inline-block w-fit">
              {t.admin.verificationRejectedLabel} {s.verification_rejected_reason}
            </p>
          )}
          {rejectingId === s.id && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t.admin.rejectReasonPlaceholder}
                className="text-xs rounded-lg border border-neutral-300 px-3 py-1.5 flex-1 min-w-[12rem]"
              />
              <button
                onClick={() => submitReject(s)}
                disabled={togglingId === s.id}
                className="text-xs rounded-full bg-red-600 text-white px-3 py-1.5 disabled:opacity-60"
              >
                {t.admin.rejectConfirm}
              </button>
              <button
                onClick={() => {
                  setRejectingId(null);
                  setRejectReason("");
                }}
                className="text-xs rounded-full border border-neutral-300 px-3 py-1.5"
              >
                {t.admin.rejectCancel}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ProductsTab({
  token,
  t,
  setAuthError,
}: {
  token: string;
  t: Dictionary;
  setAuthError: (e: string | null) => void;
}) {
  const [products, setProducts] = useState<AdminProduct[] | null>(null);

  const load = useCallback(async () => {
    const res = await authedFetch("/api/admin/products", token);
    const json = await res.json();
    if (!res.ok) {
      setAuthError(json.error ?? t.admin.notAuthorized);
      return;
    }
    setProducts(json.products);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (!products) return <p className="text-sm text-neutral-500">{t.admin.loading}</p>;
  if (products.length === 0) return <p className="text-sm text-neutral-500">{t.admin.noneFound}</p>;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100">
      {products.map((p) => (
        <div key={p.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
          <div className="flex-1 min-w-[8rem]">
            <p className="font-medium">{p.title}</p>
            <p className="text-xs text-neutral-500">
              {p.shop?.shop_name} · {p.category?.name ?? "—"}
            </p>
          </div>
          <p className="w-24 text-right font-semibold">{formatFcfa(p.price_fcfa)}</p>
          <p className="w-20 text-xs text-neutral-500">
            {t.admin.colStock}: {p.stock_quantity}
          </p>
          <span
            className={`text-xs font-semibold rounded-full px-2.5 py-1 ${
              p.is_active ? "bg-green-50 text-green-700" : "bg-neutral-100 text-neutral-500"
            }`}
          >
            {p.is_active ? "active" : "inactive"}
          </span>
        </div>
      ))}
    </div>
  );
}

function DisputesTab({
  token,
  t,
  setAuthError,
}: {
  token: string;
  t: Dictionary;
  setAuthError: (e: string | null) => void;
}) {
  const [disputes, setDisputes] = useState<AdminDispute[] | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await authedFetch("/api/admin/disputes", token);
    const json = await res.json();
    if (!res.ok) {
      setAuthError(json.error ?? t.admin.notAuthorized);
      return;
    }
    setDisputes(json.disputes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function resolve(disputeId: string, action: "refunded" | "released") {
    setResolvingId(disputeId);
    await authedFetch("/api/admin/disputes", token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disputeId, action, resolution: resolutionNotes[disputeId] }),
    });
    await load();
    setResolvingId(null);
  }

  if (!disputes) return <p className="text-sm text-neutral-500">{t.admin.loading}</p>;
  if (disputes.length === 0) return <p className="text-sm text-neutral-500">{t.admin.noneFound}</p>;

  const open = disputes.filter((d) => d.status === "open");
  const resolved = disputes.filter((d) => d.status === "resolved");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        {open.map((d) => (
          <div key={d.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p className="text-sm font-semibold">{d.shop?.shop_name ?? "—"}</p>
              <p className="text-sm font-semibold">{d.order ? formatFcfa(d.order.total_amount_fcfa) : ""}</p>
            </div>
            <p className="text-xs text-neutral-600 mb-1">
              {t.admin.disputeReason}: {disputeReasonLabel(d.reason, t)}
            </p>
            {d.description && (
              <p className="text-xs text-neutral-600 mb-1">
                {t.admin.disputeDescription}: {d.description}
              </p>
            )}
            {d.photo_url && (
              <div className="relative w-24 h-24 rounded-lg mt-2 mb-2 border border-amber-200 overflow-hidden">
                <Image src={d.photo_url} alt="Evidence" fill sizes="96px" className="object-cover" />
              </div>
            )}
            <textarea
              value={resolutionNotes[d.id] ?? ""}
              onChange={(e) => setResolutionNotes((prev) => ({ ...prev, [d.id]: e.target.value }))}
              placeholder={t.admin.disputeResolutionPlaceholder}
              rows={2}
              className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm mt-2 mb-2 bg-white"
            />
            <div className="flex gap-2">
              <button
                onClick={() => resolve(d.id, "released")}
                disabled={resolvingId === d.id}
                className="text-xs rounded-full bg-neutral-900 text-white px-3 py-1.5 disabled:opacity-60"
              >
                {resolvingId === d.id ? t.admin.resolving : t.admin.resolveRelease}
              </button>
              <button
                onClick={() => resolve(d.id, "refunded")}
                disabled={resolvingId === d.id}
                className="text-xs rounded-full border border-red-300 text-red-700 px-3 py-1.5 disabled:opacity-60"
              >
                {resolvingId === d.id ? t.admin.resolving : t.admin.resolveRefund}
              </button>
            </div>
          </div>
        ))}
        {open.length === 0 && <p className="text-sm text-neutral-500">{t.admin.noneFound}</p>}
      </div>

      {resolved.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100">
          {resolved.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
              <div className="flex-1 min-w-[8rem]">
                <p className="font-medium">{d.shop?.shop_name ?? "—"}</p>
                <p className="text-xs text-neutral-500">{disputeReasonLabel(d.reason, t)}</p>
              </div>
              <span className="text-xs font-semibold rounded-full bg-neutral-100 px-2.5 py-1">
                {d.resolved_action === "refunded" ? t.admin.resolveRefund : t.admin.resolveRelease}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PayoutsTab({
  token,
  t,
  setAuthError,
}: {
  token: string;
  t: Dictionary;
  setAuthError: (e: string | null) => void;
}) {
  const [orders, setOrders] = useState<PayoutOrder[] | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await authedFetch("/api/admin/payouts", token);
    const json = await res.json();
    if (!res.ok) {
      setAuthError(json.error ?? t.admin.notAuthorized);
      return;
    }
    setOrders(json.orders);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleMarkPaid(orderId: string) {
    setMarkingId(orderId);
    await authedFetch("/api/admin/payouts", token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    await load();
    setMarkingId(null);
  }

  if (!orders) return <p className="text-sm text-neutral-500">{t.admin.loading}</p>;

  if (orders.length === 0) {
    return (
      <p className="text-sm text-neutral-500 rounded-xl border border-dashed border-neutral-300 p-8 text-center">
        {t.admin.noneOwed}
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100">
      {orders.map((o) => (
        <div key={o.id} className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex-1 min-w-[10rem]">
            <p className="text-sm font-medium">{o.shop?.shop_name}</p>
            <p className="text-xs text-neutral-500">
              {new Date(o.created_at).toLocaleDateString()}
              {o.shop?.whatsapp_number && ` · WhatsApp: ${o.shop.whatsapp_number}`}
            </p>
            <p className="text-xs font-medium mt-0.5">
              {o.shop?.payout_phone_number ? (
                <span className="text-neutral-700">
                  💰{" "}
                  {o.shop.payout_provider === "mtn"
                    ? "MTN"
                    : o.shop.payout_provider === "orange"
                      ? "Orange"
                      : ""}{" "}
                  {o.shop.payout_phone_number}
                </span>
              ) : (
                <span className="text-amber-600">{t.admin.noPayoutDestination}</span>
              )}
            </p>
          </div>
          <div className="text-right whitespace-nowrap">
            <p className="text-sm font-semibold">
              {formatFcfa(calculateCommission(o.total_amount_fcfa).sellerPayoutFcfa)}
            </p>
            <p className="text-[11px] text-neutral-400">
              {t.admin.ofTotal} {formatFcfa(o.total_amount_fcfa)} · {t.admin.commission}{" "}
              {formatFcfa(calculateCommission(o.total_amount_fcfa).commissionFcfa)}
            </p>
          </div>
          <button
            onClick={() => handleMarkPaid(o.id)}
            disabled={markingId === o.id}
            className="text-xs rounded-full bg-neutral-900 text-white px-4 py-1.5 disabled:opacity-60"
          >
            {markingId === o.id ? t.admin.marking : t.admin.markPaid}
          </button>
        </div>
      ))}
    </div>
  );
}

function AdminsTab({
  token,
  t,
  setAuthError,
}: {
  token: string;
  t: Dictionary;
  setAuthError: (e: string | null) => void;
}) {
  const [admins, setAdmins] = useState<{ id: string; email: string }[] | null>(null);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await authedFetch("/api/admin/promote", token);
    const json = await res.json();
    if (!res.ok) {
      setAuthError(json.error ?? t.admin.notAuthorized);
      return;
    }
    setAdmins(json.admins);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const res = await authedFetch("/api/admin/promote", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? t.admin.notAuthorized);
        return;
      }
      setSuccess(t.admin.adminGranted);
      setEmail("");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-md">
      <form onSubmit={handleSubmit} className="rounded-xl border border-neutral-200 bg-white p-5 flex flex-col gap-3">
        <p className="text-sm font-semibold">{t.admin.grantAdminTitle}</p>
        <p className="text-xs text-neutral-500">{t.admin.grantAdminHint}</p>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.admin.adminEmailPlaceholder}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}
        {success && (
          <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{success}</p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="text-sm rounded-full bg-neutral-900 text-white px-5 py-2 disabled:opacity-60 self-start"
        >
          {submitting ? t.admin.marking : t.admin.grantAdminAction}
        </button>
      </form>

      <div>
        <p className="text-sm font-semibold mb-2">{t.admin.currentAdminsTitle}</p>
        {!admins ? (
          <p className="text-sm text-neutral-500">{t.admin.loading}</p>
        ) : admins.length === 0 ? (
          <p className="text-sm text-neutral-500">{t.admin.noneFound}</p>
        ) : (
          <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100">
            {admins.map((a) => (
              <p key={a.id} className="text-sm px-4 py-2.5">
                {a.email}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
