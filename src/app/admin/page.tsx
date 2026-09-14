"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatFcfa } from "@/lib/format";
import { calculateCommission } from "@/lib/commission";
import { useLocale } from "@/components/locale-provider";
import type { Dictionary } from "@/lib/i18n";

type Tab = "overview" | "orders" | "sellers" | "products" | "disputes" | "payouts";

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
  shop?: { shop_name: string; whatsapp_number: string | null } | null;
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

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: t.admin.tabOverview },
    { key: "orders", label: t.admin.tabOrders },
    { key: "sellers", label: t.admin.tabSellers },
    { key: "products", label: t.admin.tabProducts },
    { key: "disputes", label: t.admin.tabDisputes },
    { key: "payouts", label: t.admin.tabPayouts },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{t.admin.title}</h1>

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

  if (!sellers) return <p className="text-sm text-neutral-500">{t.admin.loading}</p>;
  if (sellers.length === 0) return <p className="text-sm text-neutral-500">{t.admin.noneFound}</p>;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100">
      {sellers.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
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
          <button
            onClick={() => toggleVerified(s)}
            disabled={togglingId === s.id}
            className="text-xs rounded-full border border-neutral-300 px-3 py-1.5 hover:border-neutral-900 disabled:opacity-60"
          >
            {s.is_verified ? t.admin.unverifyAction : t.admin.verifyAction}
          </button>
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
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={d.photo_url}
                alt="Evidence"
                className="w-24 h-24 object-cover rounded-lg mt-2 mb-2 border border-amber-200"
              />
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
              {o.shop?.whatsapp_number ?? o.buyer_phone ?? ""} · {new Date(o.created_at).toLocaleDateString()}
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
