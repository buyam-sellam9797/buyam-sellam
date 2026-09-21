"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { DashboardShell } from "./dashboard-shell";
import {
  supabase,
  getMyShop,
  getShopProducts,
  getMyOrders,
  getCategories,
  deleteProduct,
  setProductActive,
  uploadShopLogo,
  uploadShopCover,
  uploadVerificationDocument,
  requestShopVerification,
  markOrderShipped,
  markOrderAccepted,
  updateShop,
  getShopRatingSummary,
  getShopReviewsForDashboard,
  replyToReview,
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getDeliveryZones,
  createDeliveryZone,
  updateDeliveryZone,
  deleteDeliveryZone,
  type Shop,
  type Product,
  type Order,
  type Category,
  type ShopRatingSummary,
  type BusinessHours,
  type Review,
  type ShopNotification,
  type DeliveryZone,
} from "@/lib/supabase";
import { formatFcfa } from "@/lib/format";
import { calculateCommission } from "@/lib/commission";
import { useLocale } from "@/components/locale-provider";
import { ProductForm } from "@/components/product-form";
import { ShareButton } from "@/components/share-button";
import { getSiteUrl } from "@/lib/site";
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
type Tab = "overview" | "orders" | "products" | "delivery" | "settings" | "payments" | "trust" | "reviews" | "analytics";

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

// Builds the seller-facing "what actually happened, and when" list for
// one order out of the real per-stage timestamps (paid_at/shipped_at/
// completed_at added alongside accepted_at/payout_sent_at). Each step
// is only included when its timestamp is actually known — a dispute
// filed before shipping correctly never gets a "Shipped" line, and an
// order placed before these columns existed just shows fewer steps
// instead of a fabricated one.
type OrderTimelineStep = { label: string; iso: string | null };
function buildOrderTimeline(o: Order, t: Dictionary): OrderTimelineStep[] {
  const steps: OrderTimelineStep[] = [{ label: t.dashboard.timelineReceived, iso: o.created_at }];
  if (o.paid_at) steps.push({ label: t.dashboard.timelinePaid, iso: o.paid_at });
  if (o.accepted_at) steps.push({ label: t.dashboard.timelineAccepted, iso: o.accepted_at });
  if (o.shipped_at) steps.push({ label: t.dashboard.timelineShipped, iso: o.shipped_at });
  if (o.completed_at) steps.push({ label: t.dashboard.timelineCompleted, iso: o.completed_at });
  if (o.payout_sent) steps.push({ label: t.dashboard.timelinePayout, iso: o.payout_sent_at });
  return steps;
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
  const [reviews, setReviews] = useState<Review[]>([]);
  const [notifications, setNotifications] = useState<ShopNotification[]>([]);
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
    const [myProducts, myOrders, cats, ratingSummary, myReviews, myNotifications] = await Promise.all([
      getShopProducts(myShop.id, { includeInactive: true }),
      getMyOrders(myShop.id),
      getCategories(),
      getShopRatingSummary(myShop.id),
      getShopReviewsForDashboard(myShop.id),
      getMyNotifications(myShop.id),
    ]);
    setProducts(myProducts);
    setOrders(myOrders);
    setCategories(cats);
    setRating(ratingSummary);
    setReviews(myReviews);
    setNotifications(myNotifications);
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
    return (
      <div className="dash-shell flex items-center justify-center min-h-screen text-sm" style={{ color: "var(--dash-muted)" }}>
        {t.dashboard.loading}
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="dash-shell flex items-center justify-center min-h-screen text-sm text-center px-4" style={{ color: "var(--dash-muted)" }}>
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
  // "Today's sales" above answers "did anything sell today" — this
  // answers "how much has this shop sold, ever" so the two numbers are
  // never mistaken for one another (a shop with 3 completed orders from
  // last week correctly shows 0 FCFA today and 7,500 FCFA total).
  const totalSales = orders
    .filter((o) => o.status !== "pending_payment" && o.status !== "cancelled")
    .reduce((sum, o) => sum + o.total_amount_fcfa, 0);

  const needsActionCount = orders.filter((o) => orderBucket(o) === "action").length;
  const preparingCount = orders.filter((o) => orderBucket(o) === "preparing").length;
  const outOfStockCount = products.filter((p) => p.is_active && p.stock_quantity <= 0).length;
  const lowStockCount = products.filter((p) => p.is_active && p.stock_quantity > 0 && p.stock_quantity <= 3).length;
  // getMyOrders already returns newest-first, so the first few are the
  // most recent orders without needing to re-sort here.
  const recentOrders = orders.slice(0, 5);

  const verificationStatus: "verified" | "pending" | "action" = shop.is_verified
    ? "verified"
    : shop.verification_requested_at ||
        shop.identity_verification_status === "pending" ||
        shop.identity_verification_status === "in_review"
      ? "pending"
      : "action";

  // Grouped into 4 sections so the sidebar reads as "here's your day
  // (activity), here's your shop, here's your money, here's how you're
  // doing" instead of one flat list of 9 items.
  const tabs: { key: Tab; label: string; icon: string; section: string }[] = [
    { key: "overview", label: t.dashboard.tabOverview, icon: "📊", section: t.dashboard.navSectionActivity },
    { key: "orders", label: t.dashboard.tabOrders, icon: "🛒", section: t.dashboard.navSectionActivity },
    { key: "products", label: t.dashboard.tabProducts, icon: "📦", section: t.dashboard.navSectionActivity },
    { key: "settings", label: t.dashboard.tabSettings, icon: "⚙️", section: t.dashboard.navSectionShop },
    { key: "delivery", label: t.dashboard.tabDelivery, icon: "🚚", section: t.dashboard.navSectionShop },
    { key: "trust", label: t.dashboard.tabTrust, icon: "🛡️", section: t.dashboard.navSectionShop },
    { key: "payments", label: t.dashboard.tabPayments, icon: "💳", section: t.dashboard.navSectionMoney },
    { key: "reviews", label: t.dashboard.tabReviews, icon: "⭐", section: t.dashboard.navSectionPerformance },
    { key: "analytics", label: t.dashboard.tabAnalytics, icon: "📈", section: t.dashboard.navSectionPerformance },
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
  const checklistRemaining = checklist.filter((c) => !c.done);

  // "What needs your attention" — pulled together from whatever's
  // actually live in the shop's data right now (orders, stock,
  // verification, basic setup) rather than just restating numbers the
  // seller already saw in the stat cards. Ordered most urgent first,
  // and capped so a shop with a lot going on doesn't turn this into a
  // wall of text.
  type TodoItem = { key: string; level: "red" | "amber"; label: string; buttonLabel: string; onClick: () => void };
  const todoItems: TodoItem[] = [];
  if (needsActionCount > 0) {
    todoItems.push({
      key: "orders-action",
      level: "red",
      label: `${needsActionCount} ${plural(needsActionCount, locale, t.dashboard.todoOrdersActionOne, t.dashboard.todoOrdersActionOther)}`,
      buttonLabel: t.dashboard.todoButtonView,
      onClick: () => {
        setTab("orders");
        setOrderFilter("action");
      },
    });
  }
  if (outOfStockCount > 0) {
    todoItems.push({
      key: "out-of-stock",
      level: "red",
      label: `${outOfStockCount} ${plural(outOfStockCount, locale, t.dashboard.todoOutOfStockOne, t.dashboard.todoOutOfStockOther)}`,
      buttonLabel: t.dashboard.todoButtonView,
      onClick: () => setTab("products"),
    });
  }
  if (preparingCount > 0) {
    todoItems.push({
      key: "orders-preparing",
      level: "amber",
      label: `${preparingCount} ${plural(preparingCount, locale, t.dashboard.todoOrdersPreparingOne, t.dashboard.todoOrdersPreparingOther)}`,
      buttonLabel: t.dashboard.todoButtonView,
      onClick: () => {
        setTab("orders");
        setOrderFilter("preparing");
      },
    });
  }
  if (lowStockCount > 0) {
    todoItems.push({
      key: "low-stock",
      level: "amber",
      label: `${lowStockCount} ${plural(lowStockCount, locale, t.dashboard.todoLowStockOne, t.dashboard.todoLowStockOther)}`,
      buttonLabel: t.dashboard.todoButtonView,
      onClick: () => setTab("products"),
    });
  }
  if (verificationStatus === "action") {
    todoItems.push({
      key: "verify",
      level: "amber",
      label: t.dashboard.todoVerifyShop,
      buttonLabel: t.dashboard.todoButtonVerify,
      onClick: () => setTab("trust"),
    });
  }
  if (!shop.delivery_info) {
    todoItems.push({
      key: "delivery",
      level: "amber",
      label: t.dashboard.checklistDelivery,
      buttonLabel: t.dashboard.todoButtonConfigure,
      onClick: () => setTab("settings"),
    });
  }
  if (!shop.logo_url) {
    todoItems.push({
      key: "logo",
      level: "amber",
      label: t.dashboard.checklistLogo,
      buttonLabel: t.dashboard.todoButtonAdd,
      onClick: () => setTab("settings"),
    });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  const activeTabLabel = tabs.find((tb) => tb.key === tab)?.label ?? shop.shop_name;

  return (
    <DashboardShell
      shopName={shop.shop_name}
      pageTitle={activeTabLabel}
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      onLogout={handleLogout}
      logoutLabel={t.dashboard.logout}
      viewShopHref={`/shop/${shop.slug}`}
      viewShopLabel={t.dashboard.previewShop}
      notificationSlot={
        <NotificationBell
          notifications={notifications}
          t={t}
          onMarkRead={async (id) => {
            setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
            await markNotificationRead(id).catch(() => {});
          }}
          onMarkAllRead={async () => {
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
            await markAllNotificationsRead(shop.id).catch(() => {});
          }}
        />
      }
    >
      {tab === "overview" && (
        <div>
          <div className="dash-hero p-6 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--dash-muted)" }}>
                {t.dashboard.sellerDashboard}
              </p>
              <h2 className="text-2xl font-bold mt-1">{shop.shop_name} 👋</h2>
              <button
                type="button"
                onClick={() => setTab("trust")}
                className="dash-badge mt-2"
                style={
                  verificationStatus === "verified"
                    ? { background: "var(--dash-success-wash)", color: "var(--dash-success)" }
                    : verificationStatus === "pending"
                      ? { background: "rgba(245, 158, 11, 0.14)", color: "var(--dash-gold-ink)" }
                      : { background: "var(--dash-bg-2)", color: "var(--dash-muted)" }
                }
              >
                {verificationStatus === "verified" ? "🟢 " : verificationStatus === "pending" ? "🟡 " : "🔴 "}
                {verificationStatus === "verified"
                  ? t.dashboard.sellerStatusVerified
                  : verificationStatus === "pending"
                    ? t.dashboard.sellerStatusPending
                    : t.dashboard.sellerStatusAction}
              </button>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={() => setTab("products")} className="dash-btn">
                {products.length > 0 ? t.dashboard.addProduct : `+ ${t.dashboard.checklistProduct}`}
              </button>
              <a
                href={`/shop/${shop.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="dash-btn-outline"
              >
                {t.dashboard.previewShop}
              </a>
            </div>
          </div>

          <div className="dash-card p-5 mb-6">
            <p className="text-sm font-semibold mb-1">📣 {t.dashboard.marketingShareTitle}</p>
            <p className="text-xs mb-3" style={{ color: "var(--dash-muted)" }}>{t.dashboard.marketingShareHint}</p>
            <ShareButton
              title={shop.shop_name}
              url={`${getSiteUrl()}/shop/${shop.slug}`}
              message={t.dashboard.marketingShareMessage
                .replace("{shopName}", shop.shop_name)
                .replace("{city}", shop.city)}
            />
          </div>

          {checklistPercent < 100 && (
            <div className="dash-card p-5 mb-6">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold">{t.dashboard.checklistTitle}</p>
                <p className="text-sm" style={{ color: "var(--dash-muted)" }}>{checklistPercent}%</p>
              </div>
              <p className="text-xs mb-3" style={{ color: "var(--dash-muted)" }}>
                {plural(checklistRemaining.length, locale, t.dashboard.stepsRemainingOne, t.dashboard.stepsRemainingOther).replace(
                  "{n}",
                  String(checklistRemaining.length)
                )}
              </p>
              <div className="dash-progress-track mb-4">
                <div className="dash-progress-fill" style={{ width: `${checklistPercent}%` }} />
              </div>
              <div className="flex flex-col gap-2">
                {checklist.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setTab(c.goTab)}
                    disabled={c.done}
                    className="flex items-center justify-between gap-2 text-sm text-left"
                    style={{ color: c.done ? "var(--dash-muted)" : "var(--dash-ink)" }}
                  >
                    <span className="flex items-center gap-2">
                      <span>{c.done ? "✓" : "○"}</span>
                      <span className={c.done ? "line-through" : ""}>{c.label}</span>
                    </span>
                    {!c.done && <span className="text-xs font-semibold underline" style={{ color: "var(--dash-gold-ink)" }}>{t.dashboard.todoButtonConfigure}</span>}
                  </button>
                ))}
              </div>
              <p className="text-xs mt-4 pt-3 border-t" style={{ color: "var(--dash-muted)", borderColor: "var(--dash-border)" }}>
                {t.dashboard.checklistTrustNote}
              </p>
            </div>
          )}

          {todoItems.length > 0 && (
            <div className="dash-card p-5 mb-6">
              <p className="text-sm font-semibold mb-3">⚠️ {t.dashboard.todoTitle}</p>
              <div className="flex flex-col gap-2">
                {todoItems.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5" style={{ background: "var(--dash-bg-2)" }}>
                    <span className="text-sm flex items-center gap-2 min-w-0">
                      <span className="shrink-0">{item.level === "red" ? "🔴" : "🟡"}</span>
                      <span className="truncate">{item.label}</span>
                    </span>
                    <button type="button" onClick={item.onClick} className="dash-btn-outline !py-1 !px-3 text-xs shrink-0">
                      {item.buttonLabel}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-3 gap-4 mb-1">
            <Stat icon="💰" iconBg="#fef3c7" label={t.dashboard.todaySales} value={formatFcfa(todaySales)} />
            <Stat icon="🛒" iconBg="#f5f5f5" label={t.dashboard.orders} value={String(orders.length)} />
            <Stat icon="📦" iconBg="#f5f5f5" label={t.dashboard.listings} value={String(products.length)} />
          </div>
          <p className="text-xs mb-3" style={{ color: "var(--dash-muted)" }}>
            {t.dashboard.totalSales}: {formatFcfa(totalSales)}
          </p>
          <div className="grid sm:grid-cols-3 gap-4 mb-2">
            <Stat
              icon="🔒"
              iconBg="#f5f5f5"
              label={t.dashboard.balanceHeld}
              value={formatFcfa(balanceHeld)}
              action={{ label: t.dashboard.viewPaymentsButton, onClick: () => setTab("payments") }}
            />
            <Stat
              icon="✅"
              iconBg="#f0fdf4"
              label={t.dashboard.balanceAvailable}
              value={formatFcfa(owed)}
              action={{ label: t.dashboard.viewPaymentsButton, onClick: () => setTab("payments") }}
            />
            <Stat
              icon="⭐"
              iconBg="#fef3c7"
              label={t.dashboard.rating}
              value={rating && rating.count > 0 ? `⭐ ${rating.average.toFixed(1)}` : t.dashboard.noRatingYet}
            />
          </div>
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            <Stat icon="👁️" iconBg="#f5f5f5" label={t.dashboard.shopViews} value={String(shop.view_count)} />
          </div>
          <p className="text-xs mb-6 -mt-4" style={{ color: "var(--dash-muted)" }}>
            {t.dashboard.commissionNote} {t.dashboard.paidOut}: {formatFcfa(paidOut)}
          </p>

          <div className="dash-card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">{t.dashboard.recentOrdersTitle}</p>
              {orders.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTab("orders")}
                  className="text-xs font-semibold underline"
                  style={{ color: "var(--dash-gold-ink)" }}
                >
                  {t.dashboard.viewAllOrders}
                </button>
              )}
            </div>
            {recentOrders.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: "var(--dash-muted)" }}>{t.dashboard.noOrdersYet}</p>
            ) : (
              <div className="flex flex-col divide-y divide-[var(--dash-border)]">
                {recentOrders.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setTab("orders")}
                    className="flex items-center justify-between gap-3 py-2.5 text-left"
                  >
                    <span className="text-sm font-mono" style={{ color: "var(--dash-muted)" }}>
                      #{o.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span className="text-sm font-medium flex-1 text-right sm:text-left sm:flex-none">{formatFcfa(o.total_amount_fcfa)}</span>
                    <span className="text-xs shrink-0" style={{ color: "var(--dash-muted)" }}>
                      {o.status === "paid_held" && o.accepted_at
                        ? t.dashboard.preparingStatus
                        : t.dashboard.statusLabels[o.status] ?? o.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
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
            <Stat icon="🔒" iconBg="#f5f5f5" label={t.dashboard.balanceHeld} value={formatFcfa(balanceHeld)} />
            <Stat icon="✅" iconBg="#f0fdf4" label={t.dashboard.balanceAvailable} value={formatFcfa(owed)} />
          </div>
          <PayoutDestinationForm shop={shop} t={t} onSaved={(updated) => setShop({ ...shop, ...updated })} />
          <PayoutHistory orders={orders} t={t} />
        </div>
      )}

      {tab === "trust" && (
        <div className="flex flex-col gap-4">
          {!shop.is_verified && (
            <p className="text-xs rounded-lg px-3 py-2" style={{ color: "var(--dash-muted)", background: "var(--dash-bg-2)", border: "1px solid var(--dash-border)" }}>
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

      {tab === "reviews" && <ReviewsPanel reviews={reviews} t={t} onChanged={loadData} />}

      {tab === "analytics" && <AnalyticsPanel shop={shop} orders={orders} t={t} />}

      {tab === "delivery" && <DeliveryZonesPanel shopId={shop.id} t={t} />}
    </DashboardShell>
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
            className={`dash-pill ${filter === f.key ? "is-active" : ""}`}
          >
            {f.label} ({counts[f.key] ?? 0})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="dash-card p-10 text-center">
          <p className="text-3xl mb-2">🛒</p>
          <p className="text-sm" style={{ color: "var(--dash-muted)" }}>
            {orders.length === 0 ? t.dashboard.noOrdersYet : t.dashboard.noOrdersForFilter}
          </p>
        </div>
      ) : (
        <div className="dash-card divide-y divide-[var(--dash-border)]">
          {filtered.map((o) => {
            const bucket = orderBucket(o);
            const isExpanded = expandedId === o.id;
            const deliveryLines = [
              o.delivery_name,
              [o.delivery_neighborhood, o.delivery_city].filter(Boolean).join(", "),
              o.delivery_address,
              o.delivery_zone_name ? `📍 ${o.delivery_zone_name}` : null,
            ].filter(Boolean) as string[];
            return (
              <div key={o.id} className="p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : o.id)}
                  >
                    <p className="text-sm font-medium">{formatFcfa(o.total_amount_fcfa)}</p>
                    <p className="text-xs" style={{ color: "var(--dash-muted)" }}>
                      {o.buyer_phone ?? t.dashboard.unknownBuyer} ·{" "}
                      {o.status === "paid_held" && o.accepted_at
                        ? t.dashboard.preparingStatus
                        : t.dashboard.statusLabels[o.status] ?? o.status}
                      {o.status === "completed" && o.payout_sent ? ` · ${t.dashboard.paidOut.toLowerCase()}` : ""}
                    </p>
                    {o.status === "completed" && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--dash-muted)" }}>
                        {t.dashboard.youReceive} {formatFcfa(calculateCommission(o.total_amount_fcfa).sellerPayoutFcfa)}
                      </p>
                    )}
                  </div>
                  {bucket === "action" && (
                    <span
                      className="dash-badge uppercase tracking-wide shrink-0"
                      style={{ background: "rgba(245, 158, 11, 0.18)", color: "var(--dash-gold-ink)" }}
                    >
                      {t.dashboard.filterAction}
                    </span>
                  )}
                  {o.status === "paid_held" && !o.accepted_at && (
                    <button
                      type="button"
                      onClick={() => handleAccept(o.id)}
                      disabled={acceptingId === o.id}
                      className="dash-btn-outline !py-1.5 !px-3 text-xs shrink-0"
                    >
                      {acceptingId === o.id ? t.dashboard.accepting : t.dashboard.acceptOrder}
                    </button>
                  )}
                  {o.status === "paid_held" && (
                    <button
                      type="button"
                      onClick={() => handleShip(o.id)}
                      disabled={shippingId === o.id}
                      className="dash-btn-outline !py-1.5 !px-3 text-xs shrink-0"
                    >
                      {t.dashboard.markShipped}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : o.id)}
                    aria-label="toggle details"
                    className="text-xs shrink-0 px-1"
                    style={{ color: "var(--dash-muted)" }}
                  >
                    {isExpanded ? "▲" : "▼"}
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--dash-border)" }}>
                    <p className="text-xs font-mono mb-3" style={{ color: "var(--dash-muted)" }}>
                      {t.dashboard.orderIdLabel} #{o.id.slice(0, 8).toUpperCase()}
                    </p>

                    <p className="text-xs font-semibold mb-1" style={{ color: "var(--dash-muted)" }}>{t.dashboard.itemsPurchased}</p>
                    {o.items && o.items.length > 0 ? (
                      <ul className="text-sm space-y-0.5 mb-3">
                        {o.items.map((item, i) => (
                          <li key={i}>
                            {item.quantity}× {item.product?.title ?? ""}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs mb-3" style={{ color: "var(--dash-muted)" }}>{t.dashboard.noItemsRecorded}</p>
                    )}
                    {deliveryLines.length > 0 && (
                      <>
                        <p className="text-xs font-semibold mb-1" style={{ color: "var(--dash-muted)" }}>{t.order.deliveryTo}</p>
                        <div className="text-sm mb-1">
                          {deliveryLines.map((line, i) => (
                            <p key={i}>{line}</p>
                          ))}
                        </div>
                      </>
                    )}
                    {o.delivery_notes && <p className="text-xs italic mb-3" style={{ color: "var(--dash-muted)" }}>{o.delivery_notes}</p>}

                    {o.status !== "pending_payment" && (
                      <div className="rounded-lg p-3 mb-3" style={{ background: "var(--dash-bg-2)" }}>
                        <p className="text-xs font-semibold mb-2" style={{ color: "var(--dash-muted)" }}>{t.dashboard.paymentBreakdownTitle}</p>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span style={{ color: "var(--dash-muted)" }}>{t.dashboard.productPriceLabel}</span>
                          <span>{formatFcfa(o.total_amount_fcfa)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span style={{ color: "var(--dash-muted)" }}>{t.dashboard.platformFeeLabel}</span>
                          <span style={{ color: "var(--dash-danger)" }}>
                            −{formatFcfa(calculateCommission(o.total_amount_fcfa).commissionFcfa)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm font-semibold pt-1 mt-1 border-t" style={{ borderColor: "var(--dash-border)" }}>
                          <span>{t.dashboard.youReceive}</span>
                          <span>{formatFcfa(calculateCommission(o.total_amount_fcfa).sellerPayoutFcfa)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs mt-2">
                          <span style={{ color: "var(--dash-muted)" }}>{t.dashboard.paymentStatusLabel}</span>
                          <span style={{ color: o.status === "completed" && o.payout_sent ? "var(--dash-success)" : "var(--dash-gold-ink)" }}>
                            {o.status === "completed" && o.payout_sent
                              ? t.dashboard.paymentStatusReleased
                              : t.dashboard.paymentStatusHeld}
                          </span>
                        </div>
                      </div>
                    )}

                    {buildOrderTimeline(o, t).length > 1 && (
                      <div>
                        <p className="text-xs font-semibold mb-2" style={{ color: "var(--dash-muted)" }}>{t.dashboard.timelineTitle}</p>
                        <div className="flex flex-col gap-1.5">
                          {buildOrderTimeline(o, t).map((step, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5">
                                <span style={{ color: "var(--dash-success)" }}>✓</span>
                                {step.label}
                              </span>
                              <span style={{ color: "var(--dash-muted)" }}>
                                {step.iso
                                  ? new Date(step.iso).toLocaleString(undefined, {
                                      day: "numeric",
                                      month: "short",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : t.dashboard.timelineDateUnknown}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
// One-tap "grab this product's link to share it" — deliberately just a
// copy-to-clipboard button (not the full WhatsApp/Facebook menu the
// buyer-facing ShareButton shows) so it stays a compact icon in a dense
// list of products instead of popping open a whole panel per row.
function ProductLinkButton({ productId, t }: { productId: string; t: Dictionary }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(`${getSiteUrl()}/product/${productId}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — nothing more we can do silently.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={t.dashboard.copyProductLink}
      className="dash-btn-outline !py-1.5 !px-3 text-xs shrink-0"
    >
      {copied ? "✓" : "🔗"}
    </button>
  );
}

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
  const { locale } = useLocale();
  const [formState, setFormState] = useState<FormState>({ mode: "closed" });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "low" | "out">("all");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const attentionProducts = products.filter((p) => p.is_active && p.stock_quantity <= 3);
  const attentionSorted = [...attentionProducts].sort((a, b) => a.stock_quantity - b.stock_quantity);

  const statusFilters: { key: "all" | "active" | "low" | "out"; label: string; count: number }[] = [
    { key: "all", label: t.dashboard.filterAll, count: products.length },
    { key: "active", label: t.dashboard.productFilterActive, count: products.filter((p) => p.is_active && p.stock_quantity > 0).length },
    { key: "low", label: t.dashboard.lowStockBadge, count: products.filter((p) => p.is_active && p.stock_quantity > 0 && p.stock_quantity <= 3).length },
    { key: "out", label: t.dashboard.outOfStockBadge, count: products.filter((p) => p.stock_quantity <= 0).length },
  ];

  const bySearch = search.trim()
    ? products.filter((p) => p.title.toLowerCase().includes(search.trim().toLowerCase()))
    : products;
  const filtered = bySearch.filter((p) => {
    if (statusFilter === "active") return p.is_active && p.stock_quantity > 0;
    if (statusFilter === "low") return p.is_active && p.stock_quantity > 0 && p.stock_quantity <= 3;
    if (statusFilter === "out") return p.stock_quantity <= 0;
    return true;
  });

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
      {attentionSorted.length > 0 && (
        <div
          className="rounded-xl p-4 mb-4"
          style={{ background: "var(--dash-danger-wash)", border: "1px solid rgba(185,28,28,0.25)" }}
        >
          <p className="text-sm font-semibold mb-2" style={{ color: "var(--dash-danger)" }}>
            ⚠️ {t.dashboard.productAlertsTitle}
          </p>
          <div className="flex flex-col gap-1.5">
            {attentionSorted.slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 text-xs">
                <span style={{ color: "var(--dash-ink)" }}>
                  {(p.stock_quantity <= 0 ? t.dashboard.productAlertOutOfStock : t.dashboard.productAlertLowStock)
                    .replace("{title}", p.title)
                    .replace("{n}", String(p.stock_quantity))}
                </span>
                <button
                  type="button"
                  onClick={() => setFormState({ mode: "edit", product: p })}
                  className="shrink-0 underline font-medium"
                  style={{ color: "var(--dash-danger)" }}
                >
                  {t.dashboard.productAlertRestockButton}
                </button>
              </div>
            ))}
          </div>
          {attentionSorted.length > 3 && (
            <p className="text-xs mt-2" style={{ color: "var(--dash-danger)" }}>
              {plural(
                attentionSorted.length - 3,
                locale,
                t.dashboard.productAlertsMoreOne,
                t.dashboard.productAlertsMoreOther
              ).replace("{n}", String(attentionSorted.length - 3))}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mb-4 gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.dashboard.searchProductsPlaceholder}
          className="dash-input flex-1"
        />
        <button
          type="button"
          onClick={() => setFormState((s) => (s.mode === "add" ? { mode: "closed" } : { mode: "add" }))}
          className="dash-btn shrink-0"
        >
          {formState.mode === "add" ? t.dashboard.cancel : t.dashboard.addProduct}
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4 overflow-x-auto">
        {statusFilters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatusFilter(f.key)}
            className={`dash-pill ${statusFilter === f.key ? "is-active" : ""}`}
          >
            {f.label} ({f.count})
          </button>
        ))}
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

      <div className="dash-card divide-y divide-[var(--dash-border)]">
        {filtered.map((p) => (
          <div key={p.id} className={p.is_active ? "" : "opacity-60"}>
            <div className="flex items-center gap-3 p-4">
              <div className="relative w-12 h-12 rounded-lg flex items-center justify-center text-xl overflow-hidden shrink-0" style={{ background: "var(--dash-bg-2)" }}>
                {p.image_urls?.[0] ? (
                  <Image src={p.image_urls[0]} alt={p.title} fill sizes="48px" className="object-cover" />
                ) : (
                  "🛍️"
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {p.is_featured && <span className="mr-1" title={t.dashboard.isFeaturedLabel}>📌</span>}
                  {p.title}
                  {!p.is_active && (
                    <span className="dash-badge ml-2 align-middle" style={{ background: "var(--dash-bg-2)", color: "var(--dash-muted)" }}>
                      {t.dashboard.pausedBadge}
                    </span>
                  )}
                  {p.sale_price_fcfa != null && (
                    <span className="dash-badge ml-2 align-middle" style={{ background: "var(--dash-danger-wash)", color: "var(--dash-danger)" }}>
                      {t.dashboard.onSaleBadge}
                    </span>
                  )}
                </p>
                <p className="text-xs" style={{ color: "var(--dash-muted)" }}>
                  {p.category?.name}
                  {p.category?.name ? " · " : ""}
                  {p.stock_quantity <= 0 ? (
                    <span className="font-medium" style={{ color: "var(--dash-danger)" }}>{t.dashboard.outOfStockBadge}</span>
                  ) : p.stock_quantity <= 3 ? (
                    <span className="font-medium" style={{ color: "var(--dash-gold-ink)" }}>
                      {t.dashboard.lowStockBadge} ({p.stock_quantity})
                    </span>
                  ) : (
                    <span>
                      {t.dashboard.inStockLabel} {p.stock_quantity}
                    </span>
                  )}
                </p>
              </div>
              <p className="text-sm font-semibold whitespace-nowrap text-right">
                {p.sale_price_fcfa != null ? (
                  <>
                    <span className="block text-xs font-normal line-through" style={{ color: "var(--dash-muted)" }}>
                      {formatFcfa(p.price_fcfa)}
                    </span>
                    <span style={{ color: "var(--dash-danger)" }}>{formatFcfa(p.sale_price_fcfa)}</span>
                  </>
                ) : (
                  formatFcfa(p.price_fcfa)
                )}
              </p>
              <ProductLinkButton productId={p.id} t={t} />
              <button
                onClick={() =>
                  setFormState((s) =>
                    s.mode === "edit" && s.product.id === p.id
                      ? { mode: "closed" }
                      : { mode: "edit", product: p }
                  )
                }
                className="dash-btn-outline !py-1.5 !px-3 text-xs shrink-0"
              >
                {t.dashboard.edit}
              </button>
              <button
                onClick={() => handleToggleActive(p)}
                disabled={togglingId === p.id}
                className="dash-btn-outline !py-1.5 !px-3 text-xs shrink-0"
              >
                {p.is_active ? t.dashboard.pauseListing : t.dashboard.activateListing}
              </button>
              <button
                onClick={() => handleDelete(p.id)}
                disabled={deletingId === p.id}
                className="dash-btn-outline dash-btn-danger !py-1.5 !px-3 text-xs shrink-0"
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
          <p className="text-sm p-8 text-center" style={{ color: "var(--dash-muted)" }}>
            {products.length === 0 ? t.dashboard.noListingsYet : t.dashboard.noProductsMatchSearch}
          </p>
        )}
      </div>
    </div>
  );
}

// Payouts are still sent by hand today (no disbursement API
// integrated — an admin sends real mobile money and marks it paid).
// This just gives sellers a fixed place to record which number they
// want paid to, instead of the admin having to track them down over
// WhatsApp every time. Nothing here moves money automatically.
function PayoutDestinationForm({
  shop,
  t,
  onSaved,
}: {
  shop: Shop;
  t: Dictionary;
  onSaved: (patch: Partial<Shop>) => void;
}) {
  const [provider, setProvider] = useState<"mtn" | "orange" | "">(shop.payout_provider ?? "");
  const [phone, setPhone] = useState(shop.payout_phone_number ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await updateShop(shop.id, {
        payoutProvider: provider || null,
        payoutPhoneNumber: phone,
      });
      onSaved({ payout_provider: provider || null, payout_phone_number: phone || null });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your payout details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dash-card p-5 flex flex-col gap-3">
      <p className="text-sm font-semibold">{t.dashboard.payoutDestinationTitle}</p>
      <p className="text-xs" style={{ color: "var(--dash-muted)" }}>{t.dashboard.payoutDestinationHint}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium block mb-1">{t.dashboard.payoutProviderLabel}</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as "mtn" | "orange" | "")}
            className="dash-input"
          >
            <option value="">{t.dashboard.payoutProviderPlaceholder}</option>
            <option value="mtn">MTN Mobile Money</option>
            <option value="orange">Orange Money</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">{t.dashboard.payoutPhoneLabel}</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+237 6XX XXX XXX"
            className="dash-input"
          />
        </div>
      </div>
      {error && (
        <p className="text-sm rounded-lg px-3 py-2" style={{ color: "var(--dash-danger)", background: "var(--dash-danger-wash)", border: "1px solid var(--dash-danger)" }}>{error}</p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="dash-btn self-start"
        >
          {saving ? t.dashboard.saving : t.dashboard.shopSettingsSave}
        </button>
        {saved && !saving && (
          <span className="text-sm" style={{ color: "var(--dash-success)" }}>{t.dashboard.shopSettingsSaved}</span>
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
        <p className="text-sm rounded-xl border border-dashed p-6 text-center" style={{ color: "var(--dash-muted)", borderColor: "var(--dash-border-strong)" }}>
          {t.dashboard.noPayoutsYet}
        </p>
      ) : (
        <div className="dash-card divide-y divide-[var(--dash-border)]">
          {paidOrders.map((o) => (
            <div key={o.id} className="flex items-center justify-between p-4 text-sm">
              <div>
                <p className="font-medium">{formatFcfa(calculateCommission(o.total_amount_fcfa).sellerPayoutFcfa)}</p>
                <p className="text-xs" style={{ color: "var(--dash-muted)" }}>
                  {o.payout_sent_at ? new Date(o.payout_sent_at).toLocaleDateString() : ""}
                </p>
              </div>
              <p className="text-xs" style={{ color: "var(--dash-muted)" }}>{o.buyer_phone ?? t.dashboard.unknownBuyer}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Turns a timestamp into a short relative label ("5m ago", "2h ago")
// for the notification dropdown — a full date is more than a seller
// needs for "did something just happen".
function relativeTime(iso: string, t: Dictionary): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return t.dashboard.notificationsJustNow;
  if (minutes < 60) return t.dashboard.notificationsMinutesAgo.replace("{n}", String(minutes));
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t.dashboard.notificationsHoursAgo.replace("{n}", String(hours));
  const days = Math.floor(hours / 24);
  return t.dashboard.notificationsDaysAgo.replace("{n}", String(days));
}

// The bell icon in the dashboard header — new paid orders and buyer
// disputes (see migration 017), so a seller finds out without having
// to keep the Orders tab open and refresh it. Kept as a simple
// dropdown rather than a separate tab: this is meant to be glanced at,
// not lived in.
function NotificationBell({
  notifications,
  t,
  onMarkRead,
  onMarkAllRead,
}: {
  notifications: ShopNotification[];
  t: Dictionary;
  onMarkRead: (id: string) => void | Promise<void>;
  onMarkAllRead: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t.dashboard.notificationsTitle}
        className="relative text-sm rounded-full w-9 h-9 flex items-center justify-center border"
        style={{ borderColor: "var(--dash-border-strong)" }}
      >
        🔔
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10px] font-semibold flex items-center justify-center"
            style={{ background: "var(--dash-danger)" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Click-away layer — closes the dropdown without needing a ref/listener setup. */}
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="dash-card absolute right-0 mt-2 w-80 max-w-[90vw] shadow-lg z-20 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: "var(--dash-border)" }}>
              <p className="text-sm font-semibold">{t.dashboard.notificationsTitle}</p>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => onMarkAllRead()}
                  className="text-xs hover:underline"
                  style={{ color: "var(--dash-gold-ink)" }}
                >
                  {t.dashboard.notificationsMarkAllRead}
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-sm text-center py-8 px-4" style={{ color: "var(--dash-muted)" }}>
                  {t.dashboard.notificationsEmpty}
                </p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => !n.is_read && onMarkRead(n.id)}
                    className="w-full text-left px-4 py-3 border-b last:border-0"
                    style={{
                      borderColor: "var(--dash-border)",
                      background: n.is_read ? "transparent" : "var(--dash-primary-wash)",
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-base leading-none mt-0.5">
                        {n.type === "dispute_filed"
                          ? "⚠️"
                          : n.type === "low_stock"
                            ? "📉"
                            : n.type === "payout_released"
                              ? "💸"
                              : "🛍️"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{n.title}</p>
                        {n.body && <p className="text-xs mt-0.5" style={{ color: "var(--dash-muted)" }}>{n.body}</p>}
                        <p className="text-[11px] mt-1" style={{ color: "var(--dash-muted)" }}>{relativeTime(n.created_at, t)}</p>
                      </div>
                      {!n.is_read && <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: "var(--dash-gold)" }} />}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// The Reviews tab — every review a buyer has left on this shop, with
// the product/seller/delivery breakdown (when given) and a place for
// the seller to write a public reply. Replies show up on the shop's
// public page right under the review itself.
function ReviewsPanel({
  reviews,
  t,
  onChanged,
}: {
  reviews: Review[];
  t: Dictionary;
  onChanged: () => Promise<void>;
}) {
  const { locale } = useLocale();
  if (reviews.length === 0) {
    return (
      <p className="text-sm rounded-xl border border-dashed p-8 text-center" style={{ color: "var(--dash-muted)", borderColor: "var(--dash-border-strong)" }}>
        {t.dashboard.reviewsEmpty}
      </p>
    );
  }

  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  const counts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));
  const maxCount = Math.max(...counts.map((c) => c.count), 1);

  return (
    <div className="flex flex-col gap-3">
      <div className="dash-card p-4">
        <p className="text-sm font-semibold mb-3">{t.dashboard.reviewsReputationTitle}</p>
        <div className="flex items-center gap-4 flex-wrap mb-4">
          <div>
            <p className="text-3xl font-bold" style={{ color: "var(--dash-ink)" }}>
              {average.toFixed(1)}
              <span className="text-base font-normal" style={{ color: "var(--dash-muted)" }}> / 5</span>
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--dash-muted)" }}>
              {plural(reviews.length, locale, t.dashboard.reviewsBasedOnOne, t.dashboard.reviewsBasedOnOther).replace(
                "{n}",
                String(reviews.length)
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          {counts.map(({ star, count }) => (
            <div key={star} className="flex items-center gap-2 text-xs">
              <span className="w-14 shrink-0" style={{ color: "var(--dash-muted)" }}>
                {(star === 1 ? t.dashboard.reviewsStarLabel : t.dashboard.reviewsStarsLabel).replace("{n}", String(star))}
              </span>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--dash-bg-2)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(count / maxCount) * 100}%`,
                    background: "var(--dash-gold)",
                  }}
                />
              </div>
              <span className="w-6 text-right shrink-0" style={{ color: "var(--dash-muted)" }}>
                {count}
              </span>
            </div>
          ))}
        </div>
      </div>
      {reviews.map((r) => (
        <ReviewCard key={r.id} review={r} t={t} onChanged={onChanged} />
      ))}
    </div>
  );
}

function ReviewCard({
  review,
  t,
  onChanged,
}: {
  review: Review;
  t: Dictionary;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(review.seller_reply ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await replyToReview(review.id, draft.trim());
      await onChanged();
      setSaved(true);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dash-card p-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm">{"⭐".repeat(review.rating)}</p>
        <p className="text-xs" style={{ color: "var(--dash-muted)" }}>
          {t.dashboard.reviewFromLabel} {review.buyer_phone ?? t.dashboard.reviewAnonymousBuyer} ·{" "}
          {new Date(review.created_at).toLocaleDateString()}
        </p>
      </div>
      {review.product_rating != null && review.seller_rating != null && review.delivery_rating != null && (
        <p className="text-xs mt-1" style={{ color: "var(--dash-muted)" }}>
          {t.shop.reviewProductLabel} {review.product_rating}/5 · {t.shop.reviewSellerLabel}{" "}
          {review.seller_rating}/5 · {t.shop.reviewDeliveryLabel} {review.delivery_rating}/5
        </p>
      )}
      <p className="text-sm mt-2">
        {review.comment || <span className="italic" style={{ color: "var(--dash-muted)" }}>{t.dashboard.reviewNoComment}</span>}
      </p>

      {review.seller_reply && !editing ? (
        <div className="mt-3 rounded-lg px-3 py-2" style={{ background: "var(--dash-bg-2)", border: "1px solid var(--dash-border)" }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold">{t.dashboard.reviewYourReply}</p>
            <button
              type="button"
              onClick={() => {
                setDraft(review.seller_reply ?? "");
                setSaved(false);
                setEditing(true);
              }}
              className="text-xs underline"
              style={{ color: "var(--dash-muted)" }}
            >
              {t.dashboard.reviewEditReply}
            </button>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--dash-muted)" }}>{review.seller_reply}</p>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t.dashboard.reviewReplyPlaceholder}
            rows={2}
            className="dash-input"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !draft.trim()}
              className="dash-btn !py-1.5 !px-4 text-xs self-start"
            >
              {saving ? t.dashboard.saving : t.dashboard.reviewReplyButton}
            </button>
            {saved && !saving && (
              <span className="text-xs" style={{ color: "var(--dash-success)" }}>{t.dashboard.reviewReplySaved}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// The Analytics tab. Built entirely from data already loaded for the
// other tabs (orders + their line items, and the shop's running view
// counter) — no new tracking tables yet, so "views" is a single
// all-time total rather than a day-by-day series. If a real daily
// views history is wanted later, that needs its own events table.
type AnalyticsRange = "today" | "7d" | "30d" | "12m";

function AnalyticsPanel({ shop, orders, t }: { shop: Shop; orders: Order[]; t: Dictionary }) {
  const [range, setRange] = useState<AnalyticsRange>("7d");

  // Same definition of "a real order" used for the Overview tab's
  // today's-sales figure: everything except abandoned/cancelled checkouts.
  const successfulOrders = orders.filter(
    (o) => o.status !== "pending_payment" && o.status !== "cancelled"
  );

  const buckets = (() => {
    if (range === "today") {
      const arr: { key: string; label: string; amount: number }[] = [];
      for (let h = 0; h < 24; h++) {
        arr.push({ key: String(h), label: h % 6 === 0 ? `${h}h` : "", amount: 0 });
      }
      const today = new Date().toDateString();
      const byHour = new Map(arr.map((b) => [b.key, b]));
      successfulOrders.forEach((o) => {
        const d = new Date(o.created_at);
        if (d.toDateString() !== today) return;
        const bucket = byHour.get(String(d.getHours()));
        if (bucket) bucket.amount += o.total_amount_fcfa;
      });
      return arr;
    }
    if (range === "12m") {
      const arr: { key: string; label: string; amount: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        arr.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString(undefined, { month: "short" }), amount: 0 });
      }
      const byMonth = new Map(arr.map((b) => [b.key, b]));
      successfulOrders.forEach((o) => {
        const d = new Date(o.created_at);
        const bucket = byMonth.get(`${d.getFullYear()}-${d.getMonth()}`);
        if (bucket) bucket.amount += o.total_amount_fcfa;
      });
      return arr;
    }
    const numDays = range === "30d" ? 30 : 7;
    const arr: { key: string; label: string; amount: number }[] = [];
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      arr.push({
        key: d.toDateString(),
        label: numDays === 30 ? (i % 5 === 0 ? String(d.getDate()) : "") : d.toLocaleDateString(undefined, { weekday: "short" }),
        amount: 0,
      });
    }
    const byDay = new Map(arr.map((b) => [b.key, b]));
    successfulOrders.forEach((o) => {
      const bucket = byDay.get(new Date(o.created_at).toDateString());
      if (bucket) bucket.amount += o.total_amount_fcfa;
    });
    return arr;
  })();
  const maxAmount = Math.max(1, ...buckets.map((d) => d.amount));
  const totalInRange = buckets.reduce((sum, d) => sum + d.amount, 0);

  const conversionRate = shop.view_count > 0 ? (successfulOrders.length / shop.view_count) * 100 : null;

  const avgOrderValue =
    successfulOrders.length > 0
      ? successfulOrders.reduce((sum, o) => sum + o.total_amount_fcfa, 0) / successfulOrders.length
      : null;

  const buyerCounts = new Map<string, number>();
  successfulOrders.forEach((o) => {
    if (!o.buyer_phone) return;
    buyerCounts.set(o.buyer_phone, (buyerCounts.get(o.buyer_phone) ?? 0) + 1);
  });
  const distinctBuyers = buyerCounts.size;
  const repeatBuyers = [...buyerCounts.values()].filter((c) => c > 1).length;
  const repeatRate = distinctBuyers > 0 ? (repeatBuyers / distinctBuyers) * 100 : null;

  const productTotals = new Map<string, { title: string; quantity: number }>();
  successfulOrders.forEach((o) => {
    o.items?.forEach((item) => {
      if (!item.product) return;
      const existing = productTotals.get(item.product.id);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        productTotals.set(item.product.id, { title: item.product.title, quantity: item.quantity });
      }
    });
  });
  const topProducts = [...productTotals.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5);

  const rangeLabels: Record<AnalyticsRange, string> = {
    today: t.dashboard.analyticsRangeToday,
    "7d": t.dashboard.analyticsRange7d,
    "30d": t.dashboard.analyticsRange30d,
    "12m": t.dashboard.analyticsRange12m,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label={t.dashboard.shopViews} value={String(shop.view_count)} icon="👁️" iconBg="#f5f5f5" />
        <Stat
          label={t.dashboard.analyticsConversionLabel}
          value={conversionRate == null ? t.dashboard.noRatingYet : `${conversionRate.toFixed(1)}%`}
          icon="📈"
          iconBg="#fef3c7"
        />
        <Stat
          label={t.dashboard.analyticsAvgOrderLabel}
          value={avgOrderValue == null ? t.dashboard.noRatingYet : formatFcfa(Math.round(avgOrderValue))}
          icon="🧮"
          iconBg="#fef3c7"
        />
        <Stat
          label={t.dashboard.analyticsRepeatCustomersLabel}
          value={repeatRate == null ? t.dashboard.noRatingYet : `${repeatRate.toFixed(0)}%`}
          icon="🔁"
          iconBg="#f5f5f5"
        />
      </div>
      <p className="text-xs -mt-4" style={{ color: "var(--dash-muted)" }}>
        {t.dashboard.analyticsConversionHint} {t.dashboard.analyticsAvgOrderHint} {t.dashboard.analyticsRepeatCustomersHint}
      </p>

      <div className="dash-card p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <p className="text-sm font-semibold">
            {t.dashboard.analyticsSalesRangeTitle} — {formatFcfa(totalInRange)}
          </p>
          <div className="flex gap-1 rounded-lg p-0.5" style={{ background: "var(--dash-bg-2)" }}>
            {(Object.keys(rangeLabels) as AnalyticsRange[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className="text-xs px-2.5 py-1 rounded-md transition"
                style={
                  range === r
                    ? { background: "var(--dash-card)", color: "var(--dash-ink)", fontWeight: 600, boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }
                    : { color: "var(--dash-muted)" }
                }
              >
                {rangeLabels[r]}
              </button>
            ))}
          </div>
        </div>
        {totalInRange === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "var(--dash-muted)" }}>{t.dashboard.analyticsNoSales}</p>
        ) : (
          <div className="flex items-end gap-1 h-32">
            {buckets.map((d, i) => (
              <div key={d.key + i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                <div
                  title={`${d.label} · ${formatFcfa(d.amount)}`}
                  className="w-full max-w-[24px] rounded-t"
                  style={{ height: `${Math.max(2, (d.amount / maxAmount) * 100)}%`, background: "var(--dash-primary)" }}
                />
                <span className="text-[10px]" style={{ color: "var(--dash-muted)" }}>{d.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dash-card p-5">
        <p className="text-sm font-semibold mb-3">{t.dashboard.analyticsTopProductsTitle}</p>
        {topProducts.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: "var(--dash-muted)" }}>{t.dashboard.analyticsNoProductSales}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {topProducts.map((p, i) => (
              <div key={p.title} className="flex items-center justify-between text-sm">
                <span className="truncate pr-3">
                  {i === 0 && <span className="mr-1.5" title={t.dashboard.analyticsBestSellerBadge}>🏆</span>}
                  {p.title}
                </span>
                <span className="shrink-0" style={{ color: "var(--dash-muted)" }}>
                  {p.quantity} {t.dashboard.analyticsSoldLabel}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Optional, additive delivery pricing: a seller can name delivery
// areas ("Douala centre-ville") with their own fee instead of one flat
// fee for every buyer. A shop with zero rows here changes nothing about
// checkout — see getDeliveryZones/checkout-form.tsx for the other side
// of this.
function DeliveryZonesPanel({ shopId, t }: { shopId: string; t: Dictionary }) {
  const [zones, setZones] = useState<DeliveryZone[] | null>(null);
  const [name, setName] = useState("");
  const [fee, setFee] = useState("");
  const [eta, setEta] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ name: string; fee: string; eta: string }>({
    name: "",
    fee: "",
    eta: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setZones(await getDeliveryZones(shopId));
  }, [shopId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !fee.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await createDeliveryZone({
        shopId,
        name: name.trim(),
        feeFcfa: Number(fee),
        etaText: eta,
        sortOrder: zones?.length ?? 0,
      });
      setName("");
      setFee("");
      setEta("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add this delivery zone.");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(z: DeliveryZone) {
    setEditingId(z.id);
    setEditDraft({ name: z.name, fee: String(z.fee_fcfa), eta: z.eta_text ?? "" });
  }

  async function handleSaveEdit(zoneId: string) {
    setSavingEdit(true);
    try {
      await updateDeliveryZone(zoneId, {
        name: editDraft.name,
        feeFcfa: Number(editDraft.fee),
        etaText: editDraft.eta,
      });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this delivery zone.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(zoneId: string) {
    if (!window.confirm(t.dashboard.deliveryZoneRemoveConfirm)) return;
    setDeletingId(zoneId);
    try {
      await deleteDeliveryZone(zoneId);
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold">{t.dashboard.deliveryZonesTitle}</p>
        <p className="text-xs mt-1" style={{ color: "var(--dash-muted)" }}>{t.dashboard.deliveryZonesIntro}</p>
      </div>

      <div className="dash-card divide-y divide-[var(--dash-border)]">
        {zones == null ? (
          <p className="text-sm p-6 text-center" style={{ color: "var(--dash-muted)" }}>{t.dashboard.loading}</p>
        ) : zones.length === 0 ? (
          <p className="text-sm p-6 text-center" style={{ color: "var(--dash-muted)" }}>{t.dashboard.deliveryZonesEmpty}</p>
        ) : (
          zones.map((z) => (
            <div key={z.id} className="p-4">
              {editingId === z.id ? (
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                  <input
                    value={editDraft.name}
                    onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                    className="dash-input flex-1"
                  />
                  <input
                    type="number"
                    min={0}
                    value={editDraft.fee}
                    onChange={(e) => setEditDraft((d) => ({ ...d, fee: e.target.value }))}
                    className="dash-input sm:w-32"
                  />
                  <input
                    value={editDraft.eta}
                    onChange={(e) => setEditDraft((d) => ({ ...d, eta: e.target.value }))}
                    placeholder={t.dashboard.deliveryZoneEtaPlaceholder}
                    className="dash-input sm:w-40"
                  />
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(z.id)}
                      disabled={savingEdit}
                      className="dash-btn !py-1.5 !px-3 text-xs"
                    >
                      {t.dashboard.deliveryZoneSaveButton}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="dash-btn-outline !py-1.5 !px-3 text-xs"
                    >
                      {t.dashboard.cancel}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{z.name}</p>
                    <p className="text-xs" style={{ color: "var(--dash-muted)" }}>
                      {formatFcfa(z.fee_fcfa)}
                      {z.eta_text ? ` · ${z.eta_text}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(z)}
                      className="dash-btn-outline !py-1.5 !px-3 text-xs"
                    >
                      {t.dashboard.edit}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(z.id)}
                      disabled={deletingId === z.id}
                      className="dash-btn-outline dash-btn-danger !py-1.5 !px-3 text-xs"
                    >
                      {t.dashboard.delete}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleAdd} className="dash-card p-4 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.dashboard.deliveryZoneNamePlaceholder}
          className="dash-input flex-1"
        />
        <input
          type="number"
          min={0}
          value={fee}
          onChange={(e) => setFee(e.target.value)}
          placeholder={t.dashboard.deliveryZoneFeePlaceholder}
          className="dash-input sm:w-36"
        />
        <input
          value={eta}
          onChange={(e) => setEta(e.target.value)}
          placeholder={t.dashboard.deliveryZoneEtaPlaceholder}
          className="dash-input sm:w-44"
        />
        <button type="submit" disabled={adding || !name.trim() || !fee.trim()} className="dash-btn shrink-0">
          {adding ? t.dashboard.saving : t.dashboard.deliveryZoneAddButton}
        </button>
      </form>
      {error && (
        <p className="text-sm rounded-lg px-3 py-2" style={{ color: "var(--dash-danger)", background: "var(--dash-danger-wash)", border: "1px solid var(--dash-danger)" }}>
          {error}
        </p>
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
  const [coverFile, setCoverFile] = useState<File | null>(null);
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
  const [facebookUrl, setFacebookUrl] = useState(shop.facebook_url ?? "");
  const [instagramUrl, setInstagramUrl] = useState(shop.instagram_url ?? "");
  const [tiktokUrl, setTiktokUrl] = useState(shop.tiktok_url ?? "");
  const [returnPolicy, setReturnPolicy] = useState(shop.return_policy ?? "");

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
      let coverUrl: string | undefined;
      if (coverFile) {
        coverUrl = await uploadShopCover(coverFile, shop.id);
      }
      await updateShop(shop.id, {
        description,
        deliveryInfo,
        deliveryFeeFcfa,
        deliveryEtaText: deliveryEta,
        logoUrl,
        coverUrl,
        closedMessage,
        businessHours,
        facebookUrl,
        instagramUrl,
        tiktokUrl,
        returnPolicy,
      });
      onSaved({
        ...shop,
        description: description || null,
        delivery_info: deliveryInfo || null,
        delivery_fee_fcfa: deliveryFeeFcfa,
        delivery_eta_text: deliveryEta || null,
        closed_message: closedMessage || null,
        business_hours: businessHours,
        facebook_url: facebookUrl || null,
        instagram_url: instagramUrl || null,
        tiktok_url: tiktokUrl || null,
        return_policy: returnPolicy || null,
        ...(logoUrl !== undefined ? { logo_url: logoUrl } : {}),
        ...(coverUrl !== undefined ? { cover_url: coverUrl } : {}),
      });
      setLogoFile(null);
      setCoverFile(null);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your shop settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="dash-card p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{t.dashboard.shopStatusTitle}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--dash-muted)" }}>
              {shop.is_open ? t.dashboard.shopStatusOpenHint : t.dashboard.shopStatusClosedHint}
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleOpen}
            disabled={togglingOpen}
            className={`!py-1.5 !px-4 text-sm shrink-0 ${shop.is_open ? "dash-btn-outline" : "dash-btn"}`}
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
              className="dash-input"
            />
            <p className="text-xs mt-1" style={{ color: "var(--dash-muted)" }}>{t.dashboard.shopClosedMessageHint}</p>
          </div>
        )}
        <a
          href={`/shop/${shop.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs underline self-start"
          style={{ color: "var(--dash-gold-ink)" }}
        >
          {t.dashboard.previewShop} ↗
        </a>
      </div>

      <div className="dash-card p-5 flex flex-col gap-3">
        <p className="text-sm font-semibold">{t.dashboard.businessHoursTitle}</p>
        <div className="flex flex-col gap-2">
          {DAY_KEYS.map((day) => {
            const dayHours = businessHours[day];
            return (
              <div key={day} className="flex items-center gap-3 text-sm">
                <span className="w-10" style={{ color: "var(--dash-ink)" }}>{t.dashboard.dayLabels[day]}</span>
                <label className="flex items-center gap-1.5 text-xs w-24 shrink-0" style={{ color: "var(--dash-muted)" }}>
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
                      className="dash-input !w-auto px-2 py-1 text-xs"
                    />
                    <span style={{ color: "var(--dash-muted)" }}>–</span>
                    <input
                      type="time"
                      value={dayHours.close ?? "18:00"}
                      onChange={(e) =>
                        setBusinessHours((prev) => ({
                          ...prev,
                          [day]: { ...prev[day], close: e.target.value },
                        }))
                      }
                      className="dash-input !w-auto px-2 py-1 text-xs"
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="dash-card p-5 flex flex-col gap-4">
      <p className="text-sm font-semibold">{t.dashboard.shopSettingsTitle}</p>
      <div>
        <label className="text-sm font-medium block mb-1">{t.dashboard.shopLogoLabel}</label>
        <div className="flex items-center gap-3">
          <div
            className="relative w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold overflow-hidden shrink-0"
            style={{ background: "rgba(245, 158, 11, 0.18)", color: "var(--dash-gold-ink)" }}
          >
            {logoFile ? (
              // A local file the seller just picked, previewed straight from
              // their device before it's even uploaded — next/image can only
              // optimize a real URL it can fetch, not a blob: one, and there's
              // no network cost here to optimize away anyway.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={URL.createObjectURL(logoFile)}
                alt={shop.shop_name}
                className="w-full h-full object-cover"
              />
            ) : shop.logo_url ? (
              <Image src={shop.logo_url} alt={shop.shop_name} fill sizes="48px" className="object-cover" />
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
        <label className="text-sm font-medium block mb-1">{t.dashboard.shopCoverLabel}</label>
        <p className="text-xs text-neutral-500 mb-2">{t.dashboard.shopCoverHint}</p>
        <div
          className="relative w-full h-28 sm:h-36 rounded-xl overflow-hidden mb-2"
          style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.25), rgba(217,119,6,0.35))" }}
        >
          {coverFile ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={URL.createObjectURL(coverFile)}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : shop.cover_url ? (
            <Image src={shop.cover_url} alt="" fill sizes="100vw" className="object-cover" />
          ) : null}
        </div>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">{t.dashboard.shopDescriptionLabel}</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t.dashboard.shopDescriptionPlaceholder}
          rows={2}
          className="dash-input"
        />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">{t.dashboard.shopDeliveryInfoLabel}</label>
        <textarea
          value={deliveryInfo}
          onChange={(e) => setDeliveryInfo(e.target.value)}
          placeholder={t.dashboard.shopDeliveryInfoPlaceholder}
          rows={2}
          className="dash-input"
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
            className="dash-input"
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">{t.dashboard.shopDeliveryEtaLabel}</label>
          <input
            value={deliveryEta}
            onChange={(e) => setDeliveryEta(e.target.value)}
            placeholder={t.dashboard.shopDeliveryEtaPlaceholder}
            className="dash-input"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">{t.dashboard.shopLocationLabel}</label>
        <p className="text-xs mb-1.5" style={{ color: "var(--dash-muted)" }}>{t.dashboard.shopLocationHint}</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={pinMyLocation}
            disabled={locating}
            className="dash-btn-outline !py-1.5 !px-4 text-sm"
          >
            {locating
              ? t.dashboard.locating
              : shop.latitude != null
                ? t.dashboard.shopLocationUpdate
                : t.dashboard.shopLocationSet}
          </button>
          {shop.latitude != null && (
            <span className="text-xs" style={{ color: "var(--dash-success)" }}>{t.dashboard.shopLocationConfirmed}</span>
          )}
        </div>
        {locationError && <p className="text-xs mt-1.5" style={{ color: "var(--dash-danger)" }}>{locationError}</p>}
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">{t.dashboard.shopSocialLinksLabel}</label>
        <p className="text-xs mb-1.5" style={{ color: "var(--dash-muted)" }}>{t.dashboard.shopSocialLinksHint}</p>
        <div className="flex flex-col gap-2">
          <input
            value={facebookUrl}
            onChange={(e) => setFacebookUrl(e.target.value)}
            placeholder={t.dashboard.shopFacebookPlaceholder}
            className="dash-input"
          />
          <input
            value={instagramUrl}
            onChange={(e) => setInstagramUrl(e.target.value)}
            placeholder={t.dashboard.shopInstagramPlaceholder}
            className="dash-input"
          />
          <input
            value={tiktokUrl}
            onChange={(e) => setTiktokUrl(e.target.value)}
            placeholder={t.dashboard.shopTiktokPlaceholder}
            className="dash-input"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">{t.dashboard.shopReturnPolicyLabel}</label>
        <p className="text-xs mb-1.5" style={{ color: "var(--dash-muted)" }}>{t.dashboard.shopReturnPolicyHint}</p>
        <textarea
          value={returnPolicy}
          onChange={(e) => setReturnPolicy(e.target.value)}
          placeholder={t.dashboard.shopReturnPolicyPlaceholder}
          rows={3}
          className="dash-input"
        />
      </div>
      {error && (
        <p className="text-sm rounded-lg px-3 py-2" style={{ color: "var(--dash-danger)", background: "var(--dash-danger-wash)", border: "1px solid var(--dash-danger)" }}>
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="dash-btn self-start"
        >
          {saving ? t.dashboard.saving : t.dashboard.shopSettingsSave}
        </button>
        {saved && !saving && (
          <span className="text-sm" style={{ color: "var(--dash-success)" }}>{t.dashboard.shopSettingsSaved}</span>
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
      <div
        className="rounded-xl p-5 text-sm"
        style={{ border: "1px solid var(--dash-success)", background: "var(--dash-success-wash)", color: "var(--dash-success)" }}
      >
        🛡️ {t.dashboard.verificationVerified}
      </div>
    );
  }

  if (shop.verification_requested_at) {
    return (
      <div
        className="rounded-xl p-5 text-sm"
        style={{ border: "1px solid var(--dash-gold)", background: "rgba(245, 158, 11, 0.14)", color: "var(--dash-gold-ink)" }}
      >
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
      <div className="dash-card p-5 flex flex-col gap-3">
        <p className="text-sm font-semibold">{t.dashboard.verifyAutoTitle}</p>
        <p className="text-sm" style={{ color: "var(--dash-muted)" }}>{t.dashboard.verifyAutoHint}</p>

        {identityStatus === "pending" && (
          <div className="flex flex-col gap-2">
            <p
              className="text-sm rounded-lg px-3 py-2"
              style={{ color: "var(--dash-gold-ink)", background: "rgba(245, 158, 11, 0.14)", border: "1px solid var(--dash-gold)" }}
            >
              {t.dashboard.identityStatusPending}
            </p>
            <button
              type="button"
              onClick={handleStart}
              disabled={starting}
              className="text-xs underline self-start disabled:opacity-60"
              style={{ color: "var(--dash-muted)" }}
            >
              {starting ? t.dashboard.verifyAutoStarting : t.dashboard.identityStartOver}
            </button>
          </div>
        )}
        {identityStatus === "in_review" && (
          <p
            className="text-sm rounded-lg px-3 py-2"
            style={{ color: "var(--dash-gold-ink)", background: "rgba(245, 158, 11, 0.14)", border: "1px solid var(--dash-gold)" }}
          >
            {t.dashboard.identityStatusInReview}
          </p>
        )}
        {identityStatus === "declined" && (
          <p
            className="text-sm rounded-lg px-3 py-2"
            style={{ color: "var(--dash-danger)", background: "var(--dash-danger-wash)", border: "1px solid var(--dash-danger)" }}
          >
            {t.dashboard.identityStatusDeclined}
          </p>
        )}
        {autoError && (
          <p
            className="text-sm rounded-lg px-3 py-2"
            style={{ color: "var(--dash-danger)", background: "var(--dash-danger-wash)", border: "1px solid var(--dash-danger)" }}
          >
            {autoError}
          </p>
        )}

        {(identityStatus === "none" || identityStatus === "declined") && (
          <button
            type="button"
            onClick={handleStart}
            disabled={starting}
            className="dash-btn self-start"
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
          className="text-xs underline self-start"
          style={{ color: "var(--dash-muted)" }}
        >
          {t.dashboard.orManualReview}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowManual(false)}
            className="text-xs underline self-start"
            style={{ color: "var(--dash-muted)" }}
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
    <div className="dash-card p-5 flex flex-col gap-3">
      <p className="text-sm font-semibold">{t.dashboard.verificationTitle}</p>
      <p className="text-sm" style={{ color: "var(--dash-muted)" }}>{t.sell.step8Body}</p>
      {shop.verification_rejected_reason && (
        <p
          className="text-sm rounded-lg px-3 py-2"
          style={{ color: "var(--dash-danger)", background: "var(--dash-danger-wash)", border: "1px solid var(--dash-danger)" }}
        >
          {t.dashboard.verificationRejected} {shop.verification_rejected_reason}
        </p>
      )}
      <div>
        <label className="text-sm font-medium block mb-1">{t.sell.step8IdPhotoLabel}</label>
        <p className="text-xs mb-1.5" style={{ color: "var(--dash-muted)" }}>{t.sell.step8IdPhotoHint}</p>
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
          className="dash-input"
        />
      </div>
      {error && (
        <p
          className="text-sm rounded-lg px-3 py-2"
          style={{ color: "var(--dash-danger)", background: "var(--dash-danger-wash)", border: "1px solid var(--dash-danger)" }}
        >
          {error}
        </p>
      )}
      <button
        onClick={handleRequest}
        disabled={submitting}
        className="dash-btn self-start"
      >
        {submitting ? t.dashboard.saving : t.sell.step8RequestBtn}
      </button>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  iconBg,
  action,
}: {
  label: string;
  value: string;
  icon?: string;
  iconBg?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="dash-card p-4 flex items-start gap-3">
      {icon && (
        <span className="dash-kpi-icon" style={{ background: iconBg ?? "var(--dash-primary-wash)" }}>
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs" style={{ color: "var(--dash-muted)" }}>{label}</p>
        <p className="text-xl font-bold mt-1 truncate">{value}</p>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="text-xs font-semibold underline mt-1"
            style={{ color: "var(--dash-gold-ink)" }}
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
