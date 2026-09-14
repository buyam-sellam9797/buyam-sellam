"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  supabase,
  getMyShop,
  getShopProducts,
  getMyOrders,
  getCategories,
  deleteProduct,
  setProductActive,
  uploadShopLogo,
  uploadVerificationDocument,
  requestShopVerification,
  markOrderShipped,
  markOrderAccepted,
  updateShop,
  getShopRatingSummary,
  type Shop,
  type Product,
  type Order,
  type Category,
  type ShopRatingSummary,
  type BusinessHours,
} from "@/lib/supabase";
import { formatFcfa } from "@/lib/format";
import { calculateCommission } from "@/lib/commission";
import { useLocale } from "@/components/locale-provider";
import { ProductForm } from "@/components/product-form";
import { plural } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n";

// Which product form is open, if any: closed, adding a new one, or
// editing an existing one (carries the product being edited).
type FormState = { mode: "closed" } | { mode: "add" } | { mode: "edit"; product: Product };

// The dashboard used to be one long page: shop setup, verification,
// listings, and orders all stacked in a single scroll. Those four
// things get touched at very different frequencies (orders daily,
// listings whenever stock changes, shop setup and verification almost
// never), so they're now separate tabs a seller can jump straight to.
type Tab = "overview" | "orders" | "products" | "settings" | "payments" | "trust";

type OrderFilter = "all" | "action" | "preparing" | "shipped" | "completed" | "issues";

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  mon: { closed: false, open: "08:00", close: "18:00" },
  tue: { closed: false, open: "08:00", close: "18:00" },
  wed: { closed: false, open: "08:00", close: "18:00" },
  thu: { closed: false, open: "08:00", close: "18:00" },
  fri: { closed: false, open: "08:00", close: "18:00" },
  sat: { closed: false, open: "08:00", close: "18:00" },
  sun: { closed: true },
};

// Groups a raw order status (plus the "accepted" flag, which never
// changes orders.status itself) into the friendlier buckets the
// Orders tab's filter buttons use. "action" — paid but not yet
// accepted — is the one that actually needs the seller to do
// something right now.
function orderBucket(o: Order): OrderFilter | "other" {
  if (o.status === "paid_held" && !o.accepted_at) return "action";
  if (o.status === "paid_held" && o.accepted_at) return "preparing";
  if (o.status === "shipped") return "shipped";
  if (o.status === "completed") return "completed";
  if (o.status === "disputed" || o.status === "refunded" || o.status === "cancelled") return "issues";
  return "other"; // pending_payment — abandoned/incomplete checkouts, shown only under "All"
}

export default function DashboardPage() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rating, setRating] = useState<ShopRatingSummary | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  // new Date() is impure, so "today" is captured once via a lazy
  // initializer rather than read directly during render.
  const [today] = useState<string>(() => new Date().toDateString());

  const loadData = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }
    const myShop = await getMyShop();
    if (!myShop) {
      setLoading(false);
      return;
    }
    setShop(myShop);
    // includeInactive: true — a paused listing still needs to show up
    // here so the seller can turn it back on; only the public storefront
    // hides it.
    const [myProducts, myOrders, cats, ratingSummary] = await Promise.all([
      getShopProducts(myShop.id, { includeInactive: true }),
      getMyOrders(myShop.id),
      getCategories(),
      getShopRatingSummary(myShop.id),
    ]);
    setProducts(myProducts);
    setOrders(myOrders);
    setCategories(cats);
    setRating(ratingSummary);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    // Fetching this seller's own data on mount — the async work
    // (auth check, then shop/products/orders) can only start after
    // the component exists, so it lives in an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  if (loading) {
    return <div className="mx-auto max-w-4xl px-4 py-16 text-center text-neutral-500">{t.dashboard.loading}</div>;
  }

  if (!shop) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-neutral-500">
        {t.dashboard.noShopFound}
      </div>
    );
  }

  // "Balance held"/"available"/"paid out" are shown net of Buyam
  // Sellam's commission — that's the amount that actually lands in the
  // seller's hands, not the full amount the buyer paid.
  const balanceHeld = orders
    .filter((o) => o.status === "paid_held" || o.status === "shipped")
    .reduce((sum, o) => sum + calculateCommission(o.total_amount_fcfa).sellerPayoutFcfa, 0);
  const owed = orders
    .filter((o) => o.status === "completed" && !o.payout_sent)
    .reduce((sum, o) => sum + calculateCommission(o.total_amount_fcfa).sellerPayoutFcfa, 0);
  const paidOut = orders
    .filter((o) => o.status === "completed" && o.payout_sent)
    .reduce((sum, o) => sum + calculateCommission(o.total_amount_fcfa).sellerPayoutFcfa, 0);
  const todaySales = orders
    .filter((o) => new Date(o.created_at).toDateString() === today && o.status !== "pending_payment" && o.status !== "cancelled")
    .reduce((sum, o) => sum + o.total_amount_fcfa, 0);

  const needsActionCount = orders.filter((o) => orderBucket(o) === "action").length;

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: t.dashboard.tabOverview },
    { key: "orders", label: t.dashboard.tabOrders },
    { key: "products", label: t.dashboard.tabProducts },
    { key: "settings", label: t.dashboard.tabSettings },
    { key: "payments", label: t.dashboard.tabPayments },
    { key: "trust", label: t.dashboard.tabTrust },
  ];

  // How much of "Complete your shop" is done — a quick, honest signal
  // for a brand-new seller who'd otherwise have no idea what's left
  // before their shop looks real to a buyer. Verification isn't
  // counted here since it's a separate, optional step (see the Trust
  // tab) rather than a basic setup task.
  const checklist: { key: string; label: string; done: boolean; goTab: Tab }[] = [
    { key: "description", label: t.dashboard.checklistDescription, done: !!shop.description, goTab: "settings" },
    { key: "logo", label: t.dashboard.checklistLogo, done: !!shop.logo_url, goTab: "settings" },
    { key: "whatsapp", label: t.dashboard.checklistWhatsapp, done: !!shop.whatsapp_number, goTab: "settings" },
    { key: "delivery", label: t.dashboard.checklistDelivery, done: !!shop.delivery_info, goTab: "settings" },
    { key: "product", label: t.dashboard.checklistProduct, done: products.length > 0, goTab: "products" },
  ];
  const checklistDoneCount = checklist.filter((c) => c.done).length;
  const checklistPercent = Math.round((checklistDoneCount / checklist.length) * 100);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="text-2xl font-bold">{shop.shop_name}</h1>
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm rounded-full border border-neutral-300 px-4 py-1.5 hover:border-neutral-900 shrink-0"
        >
          {t.dashboard.logout}
        </button>
      </div>
      <p className="text-neutral-500 text-sm mb-4">{t.dashboard.sellerDashboard}</p>

      {needsActionCount > 0 && (
        <button
          type="button"
          onClick={() => {
            setTab("orders");
            setOrderFilter("action");
          }}
          className="w-full text-left rounded-xl border border-amber-300 bg-amber-50 text-amber-900 px-4 py-3 text-sm font-medium mb-6 hover:bg-amber-100"
        >
          ⚠️ {needsActionCount}{" "}
          {plural(needsActionCount, locale, t.dashboard.needsActionOne, t.dashboard.needsActionOther)}
        </button>
      )}

      <div className="flex gap-1 mb-8 border-b border-neutral-200 overflow-x-auto">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            type="button"
            onClick={() => setTab(tb.key)}
            className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 border-b-2 whitespace-nowrap ${
              tab === tb.key
                ? "border-neutral-900 text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-900"
            }`}
          >
            {tb.label}
            {tb.key === "orders" && needsActionCount > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold w-4 h-4">
                {needsActionCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div>
          {checklistPercent < 100 && (
            <div className="rounded-xl border border-neutral-200 bg-white p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold">{t.dashboard.checklistTitle}</p>
                <p className="text-sm text-neutral-500">{checklistPercent}%</p>
              </div>
              <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden mb-4">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${checklistPercent}%` }}
                />
              </div>
              <div className="flex flex-col gap-2">
                {checklist.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setTab(c.goTab)}
                    disabled={c.done}
                    className={`flex items-center gap-2 text-sm text-left ${
                      c.done ? "text-neutral-400" : "text-neutral-900 hover:text-amber-700"
                    }`}
                  >
                    <span>{c.done ? "☑" : "☐"}</span>
                    <span className={c.done ? "line-through" : ""}>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            <Stat label={t.dashboard.todaySales} value={formatFcfa(todaySales)} />
            <Stat label={t.dashboard.orders} value={String(orders.length)} />
            <Stat label={t.dashboard.listings} value={String(products.length)} />
          </div>
          <div className="grid sm:grid-cols-3 gap-4 mb-2">
            <Stat label={t.dashboard.balanceHeld} value={formatFcfa(balanceHeld)} />
            <Stat label={t.dashboard.balanceAvailable} value={formatFcfa(owed)} />
            <Stat
              label={t.dashboard.rating}
              value={rating && rating.count > 0 ? `⭐ ${rating.average.toFixed(1)}` : t.dashboard.noRatingYet}
            />
          </div>
          <div className="grid sm:grid-cols-3 gap-4 mb-2">
            <Stat label={t.dashboard.shopViews} value={String(shop.view_count)} />
          </div>
          <p className="text-xs text-neutral-400">
            {t.dashboard.commissionNote} {t.dashboard.paidOut}: {formatFcfa(paidOut)}
          </p>
        </div>
      )}

      {tab === "orders" && (
        <OrdersPanel
          orders={orders}
          filter={orderFilter}
          onFilterChange={setOrderFilter}
          t={t}
          onChanged={loadData}
        />
      )}

      {tab === "products" && (
        <ProductsPanel shop={shop} products={products} categories={categories} t={t} onChanged={loadData} />
      )}

      {tab === "settings" && <ShopSettingsForm shop={shop} t={t} onSaved={(updated) => setShop(updated)} />}

      {tab === "payments" && (
        <div className="flex flex-col gap-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <Stat label={t.dashboard.balanceHeld} value={formatFcfa(balanceHeld)} />
            <Stat label={t.dashboard.balanceAvailable} value={formatFcfa(owed)} />
          </div>
          <PayoutHistory orders={orders} t={t} />
        </div>
      )}

      {tab === "trust" && (
        <div className="flex flex-col gap-4">
          {!shop.is_verified && (
            <p className="text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2">
              {t.dashboard.verificationOptionalNote}
            </p>
          )}
          <VerificationPanel
            shop={shop}
            t={t}
            onSaved={(updated) => setShop({ ...shop, ...updated })}
            onRefreshShop={loadData}
          />
        </div>
      )}
    </div>
  );
}

// The Orders tab. Filters group orders into the buckets a seller
// actually thinks in ("what needs my attention right now" vs "already
// shipped"), and each row expands to show what was ordered and where
// it's going — before this, an order was just an amount and a phone
// number, with no way to know what to pack.
function OrdersPanel({
  orders,
  filter,
  onFilterChange,
  t,
  onChanged,
}: {
  orders: Order[];
  filter: OrderFilter;
  onFilterChange: (f: OrderFilter) => void;
  t: Dictionary;
  onChanged: () => Promise<void>;
}) {
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [shippingId, setShippingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Orders needing action always float to the top, regardless of sort —
  // that's the whole point of calling them out.
  const sorted = [...orders].sort((a, b) => {
    const rank = (o: Order) => (orderBucket(o) === "action" ? 0 : 1);
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const filtered = filter === "all" ? sorted : sorted.filter((o) => orderBucket(o) === filter);

  const counts: Record<OrderFilter, number> = {
    all: orders.length,
    action: orders.filter((o) => orderBucket(o) === "action").length,
    preparing: orders.filter((o) => orderBucket(o) === "preparing").length,
    shipped: orders.filter((o) => orderBucket(o) === "shipped").length,
    completed: orders.filter((o) => orderBucket(o) === "completed").length,
    issues: orders.filter((o) => orderBucket(o) === "issues").length,
  };

  const filterButtons: { key: OrderFilter; label: string }[] = [
    { key: "all", label: t.dashboard.filterAll },
    { key: "action", label: t.dashboard.filterAction },
    { key: "preparing", label: t.dashboard.filterPreparing },
    { key: "shipped", label: t.dashboard.filterShipped },
    { key: "completed", label: t.dashboard.filterCompleted },
    { key: "issues", label: t.dashboard.filterIssues },
  ];

  async function handleAccept(orderId: string) {
    setAcceptingId(orderId);
    try {
      await markOrderAccepted(orderId);
      await onChanged();
    } finally {
      setAcceptingId(null);
    }
  }

  async function handleShip(orderId: string) {
    setShippingId(orderId);
    try {
      await markOrderShipped(orderId);
      await onChanged();
    } finally {
      setShippingId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {filterButtons.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => onFilterChange(f.key)}
            className={`text-xs rounded-full px-3 py-1.5 border ${
              filter === f.key
                ? "bg-neutral-900 text-white border-neutral-900"
                : "border-neutral-300 hover:border-neutral-900"
            }`}
          >
            {f.label} ({counts[f.key] ?? 0})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-neutral-500 rounded-xl border border-dashed border-neutral-300 p-8 text-center">
          {orders.length === 0 ? t.dashboard.noOrdersYet : t.dashboard.noOrdersForFilter}
        </p>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100">
          {filtered.map((o) => {
            const bucket = orderBucket(o);
            const isExpanded = expandedId === o.id;
            const deliveryLines = [
              o.delivery_name,
              [o.delivery_neighborhood, o.delivery_city].filter(Boolean).join(", "),
              o.delivery_address,
            ].filter(Boolean) as string[];
            return (
              <div key={o.id} className="p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : o.id)}
                  >
                    <p className="text-sm font-medium">{formatFcfa(o.total_amount_fcfa)}</p>
                    <p className="text-xs text-neutral-500">
                      {o.buyer_phone ?? t.dashboard.unknownBuyer} ·{" "}
                      {o.status === "paid_held" && o.accepted_at
                        ? t.dashboard.preparingStatus
                        : t.dashboard.statusLabels[o.status] ?? o.status}
                      {o.status === "completed" && o.payout_sent ? ` · ${t.dashboard.paidOut.toLowerCase()}` : ""}
                    </p>
                    {o.status === "completed" && (
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {t.dashboard.youReceive} {formatFcfa(calculateCommission(o.total_amount_fcfa).sellerPayoutFcfa)}
                      </p>
                    )}
                  </div>
                  {bucket === "action" && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 rounded-full px-2 py-1 shrink-0">
                      {t.dashboard.filterAction}
                    </span>
                  )}
                  {o.status === "paid_held" && !o.accepted_at && (
                    <button
                      type="button"
                      onClick={() => handleAccept(o.id)}
                      disabled={acceptingId === o.id}
                      className="text-xs rounded-full border border-neutral-300 px-3 py-1.5 hover:border-neutral-900 disabled:opacity-60 shrink-0"
                    >
                      {acceptingId === o.id ? t.dashboard.accepting : t.dashboard.acceptOrder}
                    </button>
                  )}
                  {o.status === "paid_held" && (
                    <button
                      type="button"
                      onClick={() => handleShip(o.id)}
                      disabled={shippingId === o.id}
                      className="text-xs rounded-full border border-neutral-300 px-3 py-1.5 hover:border-neutral-900 disabled:opacity-60 shrink-0"
                    >
                      {t.dashboard.markShipped}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : o.id)}
                    aria-label="toggle details"
                    className="text-neutral-400 text-xs shrink-0 px-1"
                  >
                    {isExpanded ? "▲" : "▼"}
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-neutral-100">
                    <p className="text-xs font-semibold text-neutral-500 mb-1">{t.dashboard.itemsPurchased}</p>
                    {o.items && o.items.length > 0 ? (
                      <ul className="text-sm text-neutral-700 space-y-0.5 mb-3">
                        {o.items.map((item, i) => (
                          <li key={i}>
                            {item.quantity}× {item.product?.title ?? ""}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-neutral-400 mb-3">{t.dashboard.noItemsRecorded}</p>
                    )}
                    {deliveryLines.length > 0 && (
                      <>
                        <p className="text-xs font-semibold text-neutral-500 mb-1">{t.order.deliveryTo}</p>
                        <div className="text-sm text-neutral-700 mb-1">
                          {deliveryLines.map((line, i) => (
                            <p key={i}>{line}</p>
                          ))}
                        </div>
                      </>
                    )}
                    {o.delivery_notes && <p className="text-xs text-neutral-500 italic">{o.delivery_notes}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// The Products tab. Same add/edit form as before, plus a search box
// (so this still works once a shop has 50 items instead of 2) and a
// Pause/Activate toggle so a seller who's temporarily out of stock
// doesn't have to delete and recreate the listing.
function ProductsPanel({
  shop,
  products,
  categories,
  t,
  onChanged,
}: {
  shop: Shop;
  products: Product[];
  categories: Category[];
  t: Dictionary;
  onChanged: () => Promise<void>;
}) {
  const [formState, setFormState] = useState<FormState>({ mode: "closed" });
  const [search, setSearch] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = search.trim()
    ? products.filter((p) => p.title.toLowerCase().includes(search.trim().toLowerCase()))
    : products;

  async function handleDelete(productId: string) {
    if (!window.confirm(t.dashboard.removeConfirm)) return;
    setDeletingId(productId);
    try {
      await deleteProduct(productId);
      await onChanged();
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleActive(product: Product) {
    setTogglingId(product.id);
    try {
      await setProductActive(product.id, !product.is_active);
      await onChanged();
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.dashboard.searchProductsPlaceholder}
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => setFormState((s) => (s.mode === "add" ? { mode: "closed" } : { mode: "add" }))}
          className="text-sm rounded-full bg-neutral-900 text-white px-4 py-1.5 shrink-0"
        >
          {formState.mode === "add" ? t.dashboard.cancel : t.dashboard.addProduct}
        </button>
      </div>

      {formState.mode === "add" && (
        <ProductForm
          shopId={shop.id}
          categories={categories}
          t={t}
          onDone={async () => {
            setFormState({ mode: "closed" });
            await onChanged();
          }}
          onCancel={() => setFormState({ mode: "closed" })}
        />
      )}

      <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100">
        {filtered.map((p) => (
          <div key={p.id} className={p.is_active ? "" : "opacity-60"}>
            <div className="flex items-center gap-3 p-4">
              <div className="w-12 h-12 rounded-lg bg-neutral-100 flex items-center justify-center text-xl overflow-hidden shrink-0">
                {p.image_urls?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_urls[0]} alt={p.title} className="w-full h-full object-cover" />
                ) : (
                  "🛍️"
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {p.title}
                  {!p.is_active && (
                    <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 bg-neutral-100 rounded-full px-2 py-0.5 align-middle">
                      {t.dashboard.pausedBadge}
                    </span>
                  )}
                </p>
                <p className="text-xs text-neutral-500">
                  {p.category?.name}
                  {p.category?.name ? " · " : ""}
                  {p.stock_quantity <= 0 ? (
                    <span className="text-red-600 font-medium">{t.dashboard.outOfStockBadge}</span>
                  ) : p.stock_quantity <= 3 ? (
                    <span className="text-amber-600 font-medium">
                      {t.dashboard.lowStockBadge} ({p.stock_quantity})
                    </span>
                  ) : (
                    <span>
                      {t.dashboard.inStockLabel} {p.stock_quantity}
                    </span>
                  )}
                </p>
              </div>
              <p className="text-sm font-semibold whitespace-nowrap">{formatFcfa(p.price_fcfa)}</p>
              <button
                onClick={() =>
                  setFormState((s) =>
                    s.mode === "edit" && s.product.id === p.id
                      ? { mode: "closed" }
                      : { mode: "edit", product: p }
                  )
                }
                className="text-xs rounded-full border border-neutral-300 px-3 py-1.5 hover:border-neutral-900 shrink-0"
              >
                {t.dashboard.edit}
              </button>
              <button
                onClick={() => handleToggleActive(p)}
                disabled={togglingId === p.id}
                className="text-xs rounded-full border border-neutral-300 px-3 py-1.5 hover:border-neutral-900 shrink-0 disabled:opacity-60"
              >
                {p.is_active ? t.dashboard.pauseListing : t.dashboard.activateListing}
              </button>
              <button
                onClick={() => handleDelete(p.id)}
                disabled={deletingId === p.id}
                className="text-xs rounded-full border border-red-200 text-red-700 px-3 py-1.5 hover:border-red-400 shrink-0 disabled:opacity-60"
              >
                {t.dashboard.delete}
              </button>
            </div>
            {formState.mode === "edit" && formState.product.id === p.id && (
              <div className="px-4 pb-4">
                <ProductForm
                  shopId={shop.id}
                  categories={categories}
                  existingProduct={p}
                  t={t}
                  onDone={async () => {
                    setFormState({ mode: "closed" });
                    await onChanged();
                  }}
                  onCancel={() => setFormState({ mode: "closed" })}
                />
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-neutral-500 p-8 text-center">
            {products.length === 0 ? t.dashboard.noListingsYet : t.dashboard.noProductsMatchSearch}
          </p>
        )}
      </div>
    </div>
  );
}

// Part of the Trust & payouts tab — a plain record of money actually
// sent, since before this a seller could only see a live "amount
// owed" number with no history of what was already paid and when.
// Nothing new to fetch: payout_sent/payout_sent_at were already on
// every order, just never shown anywhere on the dashboard.
function PayoutHistory({ orders, t }: { orders: Order[]; t: Dictionary }) {
  const paidOrders = orders
    .filter((o) => o.status === "completed" && o.payout_sent)
    .sort(
      (a, b) =>
        new Date(b.payout_sent_at ?? b.updated_at).getTime() - new Date(a.payout_sent_at ?? a.updated_at).getTime()
    );

  return (
    <div>
      <p className="text-sm font-semibold mb-3">{t.dashboard.payoutHistoryTitle}</p>
      {paidOrders.length === 0 ? (
        <p className="text-sm text-neutral-500 rounded-xl border border-dashed border-neutral-300 p-6 text-center">
          {t.dashboard.noPayoutsYet}
        </p>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100">
          {paidOrders.map((o) => (
            <div key={o.id} className="flex items-center justify-between p-4 text-sm">
              <div>
                <p className="font-medium">{formatFcfa(calculateCommission(o.total_amount_fcfa).sellerPayoutFcfa)}</p>
                <p className="text-xs text-neutral-500">
                  {o.payout_sent_at ? new Date(o.payout_sent_at).toLocaleDateString() : ""}
                </p>
              </div>
              <p className="text-xs text-neutral-400">{o.buyer_phone ?? t.dashboard.unknownBuyer}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ShopSettingsForm({
  shop,
  t,
  onSaved,
}: {
  shop: Shop;
  t: Dictionary;
  onSaved: (shop: Shop) => void;
}) {
  const [description, setDescription] = useState(shop.description ?? "");
  const [deliveryInfo, setDeliveryInfo] = useState(shop.delivery_info ?? "");
  const [deliveryFee, setDeliveryFee] = useState(
    shop.delivery_fee_fcfa != null ? String(shop.delivery_fee_fcfa) : ""
  );
  const [deliveryEta, setDeliveryEta] = useState(shop.delivery_eta_text ?? "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [closedMessage, setClosedMessage] = useState(shop.closed_message ?? "");
  const [togglingOpen, setTogglingOpen] = useState(false);
  const [businessHours, setBusinessHours] = useState<BusinessHours>(
    shop.business_hours ?? DEFAULT_BUSINESS_HOURS
  );

  async function handleToggleOpen() {
    setTogglingOpen(true);
    try {
      const nextOpen = !shop.is_open;
      await updateShop(shop.id, { isOpen: nextOpen });
      onSaved({ ...shop, is_open: nextOpen });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update your shop's status.");
    } finally {
      setTogglingOpen(false);
    }
  }

  // Pinning the shop's location is its own instant action (not tied to
  // the rest of the form's "Save" button) — it saves immediately so a
  // seller can do it in one tap and see it take effect right away.
  function pinMyLocation() {
    if (!navigator.geolocation) {
      setLocationError(t.dashboard.locationUnsupported);
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        try {
          await updateShop(shop.id, { latitude, longitude });
          onSaved({ ...shop, latitude, longitude });
        } catch (err) {
          setLocationError(err instanceof Error ? err.message : t.dashboard.locationSaveError);
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocationError(t.dashboard.locationDenied);
        setLocating(false);
      },
      { timeout: 10000 }
    );
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const deliveryFeeFcfa = deliveryFee.trim() ? Number(deliveryFee) : null;
      let logoUrl: string | undefined;
      if (logoFile) {
        logoUrl = await uploadShopLogo(logoFile, shop.id);
      }
      await updateShop(shop.id, {
        description,
        deliveryInfo,
        deliveryFeeFcfa,
        deliveryEtaText: deliveryEta,
        logoUrl,
        closedMessage,
        businessHours,
      });
      onSaved({
        ...shop,
        description: description || null,
        delivery_info: deliveryInfo || null,
        delivery_fee_fcfa: deliveryFeeFcfa,
        delivery_eta_text: deliveryEta || null,
        closed_message: closedMessage || null,
        business_hours: businessHours,
        ...(logoUrl !== undefined ? { logo_url: logoUrl } : {}),
      });
      setLogoFile(null);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your shop settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-neutral-200 bg-white p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{t.dashboard.shopStatusTitle}</p>
            <p className="text-xs text-neutral-500 mt-0.5">
              {shop.is_open ? t.dashboard.shopStatusOpenHint : t.dashboard.shopStatusClosedHint}
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleOpen}
            disabled={togglingOpen}
            className={`text-sm rounded-full px-4 py-1.5 shrink-0 disabled:opacity-60 ${
              shop.is_open
                ? "border border-neutral-300 hover:border-neutral-900"
                : "bg-neutral-900 text-white"
            }`}
          >
            {togglingOpen
              ? t.dashboard.saving
              : shop.is_open
                ? `🟢 ${t.dashboard.shopStatusOpen}`
                : `🔴 ${t.dashboard.shopStatusClosed}`}
          </button>
        </div>
        {!shop.is_open && (
          <div>
            <label className="text-xs font-medium block mb-1">{t.dashboard.shopClosedMessageLabel}</label>
            <input
              value={closedMessage}
              onChange={(e) => setClosedMessage(e.target.value)}
              placeholder={t.dashboard.shopClosedMessagePlaceholder}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <p className="text-xs text-neutral-400 mt-1">{t.dashboard.shopClosedMessageHint}</p>
          </div>
        )}
        <a
          href={`/shop/${shop.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-amber-700 underline self-start"
        >
          {t.dashboard.previewShop} ↗
        </a>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-5 flex flex-col gap-3">
        <p className="text-sm font-semibold">{t.dashboard.businessHoursTitle}</p>
        <div className="flex flex-col gap-2">
          {DAY_KEYS.map((day) => {
            const dayHours = businessHours[day];
            return (
              <div key={day} className="flex items-center gap-3 text-sm">
                <span className="w-10 text-neutral-600">{t.dashboard.dayLabels[day]}</span>
                <label className="flex items-center gap-1.5 text-xs text-neutral-500 w-24 shrink-0">
                  <input
                    type="checkbox"
                    checked={dayHours.closed}
                    onChange={(e) =>
                      setBusinessHours((prev) => ({
                        ...prev,
                        [day]: { ...prev[day], closed: e.target.checked },
                      }))
                    }
                  />
                  {t.dashboard.dayClosed}
                </label>
                {!dayHours.closed && (
                  <>
                    <input
                      type="time"
                      value={dayHours.open ?? "08:00"}
                      onChange={(e) =>
                        setBusinessHours((prev) => ({
                          ...prev,
                          [day]: { ...prev[day], open: e.target.value },
                        }))
                      }
                      className="rounded-lg border border-neutral-300 px-2 py-1 text-xs"
                    />
                    <span className="text-neutral-400">–</span>
                    <input
                      type="time"
                      value={dayHours.close ?? "18:00"}
                      onChange={(e) =>
                        setBusinessHours((prev) => ({
                          ...prev,
                          [day]: { ...prev[day], close: e.target.value },
                        }))
                      }
                      className="rounded-lg border border-neutral-300 px-2 py-1 text-xs"
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-5 flex flex-col gap-4">
      <p className="text-sm font-semibold">{t.dashboard.shopSettingsTitle}</p>
      <div>
        <label className="text-sm font-medium block mb-1">{t.dashboard.shopLogoLabel}</label>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-lg font-bold text-amber-700 overflow-hidden shrink-0">
            {logoFile ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={URL.createObjectURL(logoFile)}
                alt={shop.shop_name}
                className="w-full h-full object-cover"
              />
            ) : shop.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shop.logo_url} alt={shop.shop_name} className="w-full h-full object-cover" />
            ) : (
              shop.shop_name.charAt(0)
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">{t.dashboard.shopDescriptionLabel}</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t.dashboard.shopDescriptionPlaceholder}
          rows={2}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">{t.dashboard.shopDeliveryInfoLabel}</label>
        <textarea
          value={deliveryInfo}
          onChange={(e) => setDeliveryInfo(e.target.value)}
          placeholder={t.dashboard.shopDeliveryInfoPlaceholder}
          rows={2}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium block mb-1">{t.dashboard.shopDeliveryFeeLabel}</label>
          <input
            type="number"
            min={0}
            value={deliveryFee}
            onChange={(e) => setDeliveryFee(e.target.value)}
            placeholder={t.dashboard.shopDeliveryFeePlaceholder}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">{t.dashboard.shopDeliveryEtaLabel}</label>
          <input
            value={deliveryEta}
            onChange={(e) => setDeliveryEta(e.target.value)}
            placeholder={t.dashboard.shopDeliveryEtaPlaceholder}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">{t.dashboard.shopLocationLabel}</label>
        <p className="text-xs text-neutral-500 mb-1.5">{t.dashboard.shopLocationHint}</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={pinMyLocation}
            disabled={locating}
            className="text-sm rounded-full border border-neutral-300 px-4 py-1.5 hover:border-neutral-900 disabled:opacity-60"
          >
            {locating
              ? t.dashboard.locating
              : shop.latitude != null
                ? t.dashboard.shopLocationUpdate
                : t.dashboard.shopLocationSet}
          </button>
          {shop.latitude != null && (
            <span className="text-xs text-green-700">{t.dashboard.shopLocationConfirmed}</span>
          )}
        </div>
        {locationError && <p className="text-xs text-red-600 mt-1.5">{locationError}</p>}
      </div>
      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-sm rounded-full bg-neutral-900 text-white px-5 py-2 disabled:opacity-60 self-start"
        >
          {saving ? t.dashboard.saving : t.dashboard.shopSettingsSave}
        </button>
        {saved && !saving && (
          <span className="text-sm text-green-700">{t.dashboard.shopSettingsSaved}</span>
        )}
      </div>
      </div>
    </div>
  );
}

// Verification is never required to sell — a shop is fully functional
// without it. Two ways to get verified live here: the automatic path
// (Didit checks a live selfie against the seller's ID card photo —
// this is what actually stops someone verifying with a stranger's ID)
// shown first since it's faster and stronger, with the older
// human-reviewed document upload kept underneath as a fallback for
// anyone who can't complete the automatic flow. Hidden entirely once
// the shop is actually verified, however that happened.
function VerificationPanel({
  shop,
  t,
  onSaved,
  onRefreshShop,
}: {
  shop: Shop;
  t: Dictionary;
  onSaved: (patch: Partial<Shop>) => void;
  onRefreshShop: () => Promise<void>;
}) {
  const [starting, setStarting] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  const identityStatus = shop.identity_verification_status ?? "none";

  // While Didit is still working on a result, poll for it — the
  // seller lands back on this page (via the redirect) slightly before
  // the webhook that actually confirms the result usually arrives.
  useEffect(() => {
    if (identityStatus !== "pending") return;
    const interval = setInterval(() => {
      onRefreshShop();
    }, 4000);
    return () => clearInterval(interval);
  }, [identityStatus, onRefreshShop]);

  if (shop.is_verified) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-sm text-green-800">
        🛡️ {t.dashboard.verificationVerified}
      </div>
    );
  }

  if (shop.verification_requested_at) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        {t.dashboard.verificationPending}
      </div>
    );
  }

  async function handleStart() {
    setStarting(true);
    setAutoError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in.");
      const res = await fetch("/api/verification/didit/start", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start verification.");
      window.location.href = data.url;
    } catch (err) {
      setAutoError(err instanceof Error ? err.message : "Could not start verification.");
      setStarting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-neutral-200 bg-white p-5 flex flex-col gap-3">
        <p className="text-sm font-semibold">{t.dashboard.verifyAutoTitle}</p>
        <p className="text-sm text-neutral-600">{t.dashboard.verifyAutoHint}</p>

        {identityStatus === "pending" && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {t.dashboard.identityStatusPending}
            </p>
            <button
              type="button"
              onClick={handleStart}
              disabled={starting}
              className="text-xs text-neutral-500 underline self-start disabled:opacity-60"
            >
              {starting ? t.dashboard.verifyAutoStarting : t.dashboard.identityStartOver}
            </button>
          </div>
        )}
        {identityStatus === "in_review" && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {t.dashboard.identityStatusInReview}
          </p>
        )}
        {identityStatus === "declined" && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {t.dashboard.identityStatusDeclined}
          </p>
        )}
        {autoError && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{autoError}</p>
        )}

        {(identityStatus === "none" || identityStatus === "declined") && (
          <button
            type="button"
            onClick={handleStart}
            disabled={starting}
            className="text-sm rounded-full bg-neutral-900 text-white px-5 py-2 disabled:opacity-60 self-start"
          >
            {starting
              ? t.dashboard.verifyAutoStarting
              : identityStatus === "declined"
                ? t.dashboard.tryAgain
                : t.dashboard.verifyAutoButton}
          </button>
        )}
      </div>

      {!showManual ? (
        <button
          type="button"
          onClick={() => setShowManual(true)}
          className="text-xs text-neutral-500 underline self-start"
        >
          {t.dashboard.orManualReview}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowManual(false)}
            className="text-xs text-neutral-500 underline self-start"
          >
            {t.dashboard.hideManualReview}
          </button>
          <ManualVerificationForm shop={shop} t={t} onSaved={onSaved} />
        </div>
      )}
    </div>
  );
}

// The original human-reviewed path: upload an ID/business document
// and a note, and Lio looks it over by hand. Kept as a fallback for
// anyone who can't complete the automatic selfie flow above — patchy
// internet, no camera, an ID type Didit doesn't recognize, and so on.
function ManualVerificationForm({
  shop,
  t,
  onSaved,
}: {
  shop: Shop;
  t: Dictionary;
  onSaved: (patch: Partial<Shop>) => void;
}) {
  const [idFile, setIdFile] = useState<File | null>(null);
  const [note, setNote] = useState(shop.verification_note ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequest() {
    setSubmitting(true);
    setError(null);
    try {
      let idPhotoPath: string | undefined;
      if (idFile) {
        idPhotoPath = await uploadVerificationDocument(idFile, shop.id);
      }
      await requestShopVerification(shop.id, { idPhotoPath, note });
      onSaved({ verification_requested_at: new Date().toISOString(), verification_rejected_reason: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 flex flex-col gap-3">
      <p className="text-sm font-semibold">{t.dashboard.verificationTitle}</p>
      <p className="text-sm text-neutral-600">{t.sell.step8Body}</p>
      {shop.verification_rejected_reason && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {t.dashboard.verificationRejected} {shop.verification_rejected_reason}
        </p>
      )}
      <div>
        <label className="text-sm font-medium block mb-1">{t.sell.step8IdPhotoLabel}</label>
        <p className="text-xs text-neutral-500 mb-1.5">{t.sell.step8IdPhotoHint}</p>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setIdFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">{t.sell.step8NoteLabel}</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t.sell.step8NotePlaceholder}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <button
        onClick={handleRequest}
        disabled={submitting}
        className="text-sm rounded-full bg-neutral-900 text-white px-5 py-2 disabled:opacity-60 self-start"
      >
        {submitting ? t.dashboard.saving : t.sell.step8RequestBtn}
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
}
