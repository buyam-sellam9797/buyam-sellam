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
  uploadShopLogo,
  markOrderShipped,
  markOrderAccepted,
  updateShop,
  getShopRatingSummary,
  type Shop,
  type Product,
  type Order,
  type Category,
  type ShopRatingSummary,
} from "@/lib/supabase";
import { formatFcfa } from "@/lib/format";
import { calculateCommission } from "@/lib/commission";
import { useLocale } from "@/components/locale-provider";
import { ProductForm } from "@/components/product-form";
import type { Dictionary } from "@/lib/i18n";

// Which product form is open, if any: closed, adding a new one, or
// editing an existing one (carries the product being edited).
type FormState = { mode: "closed" } | { mode: "add" } | { mode: "edit"; product: Product };

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rating, setRating] = useState<ShopRatingSummary | null>(null);
  const [formState, setFormState] = useState<FormState>({ mode: "closed" });
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
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
    const [myProducts, myOrders, cats, ratingSummary] = await Promise.all([
      getShopProducts(myShop.id),
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

  async function handleDelete(productId: string) {
    if (!window.confirm(t.dashboard.removeConfirm)) return;
    await deleteProduct(productId);
    loadData();
  }

  async function handleAccept(orderId: string) {
    setAcceptingId(orderId);
    try {
      await markOrderAccepted(orderId);
      loadData();
    } finally {
      setAcceptingId(null);
    }
  }

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

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">{shop.shop_name}</h1>
      <p className="text-neutral-500 text-sm mb-8">{t.dashboard.sellerDashboard}</p>

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
      <p className="text-xs text-neutral-400 mb-10">
        {t.dashboard.commissionNote} {t.dashboard.paidOut}: {formatFcfa(paidOut)}
      </p>

      <ShopSettingsForm shop={shop} t={t} onSaved={(updated) => setShop(updated)} />

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{t.dashboard.yourListings}</h2>
        <button
          onClick={() =>
            setFormState((s) => (s.mode === "add" ? { mode: "closed" } : { mode: "add" }))
          }
          className="text-sm rounded-full bg-neutral-900 text-white px-4 py-1.5"
        >
          {formState.mode === "add" ? t.dashboard.cancel : t.dashboard.addProduct}
        </button>
      </div>

      {formState.mode === "add" && (
        <ProductForm
          shopId={shop.id}
          categories={categories}
          t={t}
          onDone={() => {
            setFormState({ mode: "closed" });
            loadData();
          }}
          onCancel={() => setFormState({ mode: "closed" })}
        />
      )}

      <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100">
        {products.map((p) => (
          <div key={p.id}>
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
                <p className="text-sm font-medium truncate">{p.title}</p>
                <p className="text-xs text-neutral-500">{p.category?.name}</p>
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
                onClick={() => handleDelete(p.id)}
                className="text-xs rounded-full border border-red-200 text-red-700 px-3 py-1.5 hover:border-red-400 shrink-0"
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
                  onDone={() => {
                    setFormState({ mode: "closed" });
                    loadData();
                  }}
                  onCancel={() => setFormState({ mode: "closed" })}
                />
              </div>
            )}
          </div>
        ))}
        {products.length === 0 && (
          <p className="text-sm text-neutral-500 p-8 text-center">
            {t.dashboard.noListingsYet}
          </p>
        )}
      </div>

      <h2 className="text-lg font-semibold mt-10 mb-4">{t.dashboard.orders}</h2>
      {orders.length === 0 ? (
        <p className="text-sm text-neutral-500 rounded-xl border border-dashed border-neutral-300 p-8 text-center">
          {t.dashboard.noOrdersYet}
        </p>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100">
          {orders.map((o) => (
            <div key={o.id} className="flex items-center gap-3 p-4">
              <div className="flex-1">
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
              {o.status === "paid_held" && !o.accepted_at && (
                <button
                  onClick={() => handleAccept(o.id)}
                  disabled={acceptingId === o.id}
                  className="text-xs rounded-full border border-neutral-300 px-3 py-1.5 hover:border-neutral-900 disabled:opacity-60"
                >
                  {acceptingId === o.id ? t.dashboard.accepting : t.dashboard.acceptOrder}
                </button>
              )}
              {o.status === "paid_held" && (
                <button
                  onClick={async () => {
                    await markOrderShipped(o.id);
                    loadData();
                  }}
                  className="text-xs rounded-full border border-neutral-300 px-3 py-1.5 hover:border-neutral-900"
                >
                  {t.dashboard.markShipped}
                </button>
              )}
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
      });
      onSaved({
        ...shop,
        description: description || null,
        delivery_info: deliveryInfo || null,
        delivery_fee_fcfa: deliveryFeeFcfa,
        delivery_eta_text: deliveryEta || null,
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
    <div className="rounded-xl border border-neutral-200 bg-white p-5 mb-10 flex flex-col gap-4">
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
