"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  supabase,
  getMyShop,
  getShopProducts,
  getMyOrders,
  getCategories,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
  markOrderShipped,
  markOrderAccepted,
  updateShop,
  getShopRatingSummary,
  type Shop,
  type Product,
  type ProductCondition,
  type Order,
  type Category,
  type ShopRatingSummary,
} from "@/lib/supabase";
import { formatFcfa } from "@/lib/format";
import { calculateCommission } from "@/lib/commission";
import { useLocale } from "@/components/locale-provider";
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const deliveryFeeFcfa = deliveryFee.trim() ? Number(deliveryFee) : null;
      await updateShop(shop.id, {
        description,
        deliveryInfo,
        deliveryFeeFcfa,
        deliveryEtaText: deliveryEta,
      });
      onSaved({
        ...shop,
        description: description || null,
        delivery_info: deliveryInfo || null,
        delivery_fee_fcfa: deliveryFeeFcfa,
        delivery_eta_text: deliveryEta || null,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 mb-10 flex flex-col gap-4">
      <p className="text-sm font-semibold">{t.dashboard.shopSettingsTitle}</p>
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

function ProductForm({
  shopId,
  categories,
  existingProduct,
  t,
  onDone,
  onCancel,
}: {
  shopId: string;
  categories: Category[];
  existingProduct?: Product;
  t: Dictionary;
  onDone: () => void;
  onCancel: () => void;
}) {
  const isEditing = Boolean(existingProduct);
  const [title, setTitle] = useState(existingProduct?.title ?? "");
  const [description, setDescription] = useState(existingProduct?.description ?? "");
  const [brand, setBrand] = useState(existingProduct?.brand ?? "");
  const [price, setPrice] = useState(existingProduct ? String(existingProduct.price_fcfa) : "");
  const [stock, setStock] = useState(existingProduct ? String(existingProduct.stock_quantity) : "1");
  const [categoryId, setCategoryId] = useState(
    existingProduct?.category_id ?? categories[0]?.id ?? ""
  );
  const [condition, setCondition] = useState<ProductCondition>(
    existingProduct?.condition ?? "new"
  );
  const [sizes, setSizes] = useState(existingProduct?.sizes?.join(", ") ?? "");
  const [colors, setColors] = useState(existingProduct?.colors?.join(", ") ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "38, 39, 40" -> ["38", "39", "40"]; blank input -> [] rather than [""].
  function parseList(value: string): string[] {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      let imageUrls: string[] | undefined;
      if (file) {
        const url = await uploadProductImage(file, shopId);
        imageUrls = [url];
      }
      const sharedFields = {
        categoryId: categoryId || null,
        title,
        description,
        brand,
        priceFcfa: Number(price),
        stockQuantity: Number(stock),
        condition,
        sizes: parseList(sizes),
        colors: parseList(colors),
      };
      if (isEditing && existingProduct) {
        await updateProduct(existingProduct.id, { ...sharedFields, imageUrls });
      } else {
        await createProduct({ ...sharedFields, shopId, imageUrls: imageUrls ?? [] });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save product.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-neutral-200 bg-white p-5 mb-6 flex flex-col gap-4"
    >
      <div>
        <label className="text-sm font-medium block mb-1">{t.dashboard.productName}</label>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">{t.dashboard.description}</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">{t.dashboard.brand}</label>
        <input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder={t.dashboard.brandPlaceholder}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium block mb-1">{t.dashboard.price}</label>
          <input
            required
            type="number"
            min={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">{t.dashboard.stock}</label>
          <input
            required
            type="number"
            min={0}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">{t.dashboard.category}</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">{t.dashboard.condition}</label>
        <select
          value={condition}
          onChange={(e) => setCondition(e.target.value as ProductCondition)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white"
        >
          <option value="new">{t.dashboard.conditionNew}</option>
          <option value="like_new">{t.dashboard.conditionLikeNew}</option>
          <option value="used">{t.dashboard.conditionUsed}</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium block mb-1">{t.dashboard.sizes}</label>
          <input
            value={sizes}
            onChange={(e) => setSizes(e.target.value)}
            placeholder={t.dashboard.sizesPlaceholder}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">{t.dashboard.colors}</label>
          <input
            value={colors}
            onChange={(e) => setColors(e.target.value)}
            placeholder={t.dashboard.colorsPlaceholder}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">
          {t.dashboard.photo}
          {isEditing ? t.dashboard.photoKeepCurrent : ""}
        </label>
        {isEditing && existingProduct?.image_urls?.[0] && !file && (
          <div className="w-16 h-16 rounded-lg overflow-hidden mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={existingProduct.image_urls[0]}
              alt={existingProduct.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm"
        />
      </div>
      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-neutral-900 text-white font-semibold px-6 py-2.5 text-sm hover:bg-neutral-700 disabled:opacity-60"
        >
          {submitting ? t.dashboard.saving : isEditing ? t.dashboard.saveChanges : t.dashboard.addProductBtn}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-neutral-300 px-6 py-2.5 text-sm font-semibold hover:border-neutral-900"
        >
          {t.dashboard.cancel}
        </button>
      </div>
    </form>
  );
}
