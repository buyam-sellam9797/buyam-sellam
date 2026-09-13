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
  uploadProductImage,
  markOrderShipped,
  type Shop,
  type Product,
  type Order,
  type Category,
} from "@/lib/supabase";
import { formatFcfa } from "@/lib/format";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAddProduct, setShowAddProduct] = useState(false);

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
    const [myProducts, myOrders, cats] = await Promise.all([
      getShopProducts(myShop.id),
      getMyOrders(myShop.id),
      getCategories(),
    ]);
    setProducts(myProducts);
    setOrders(myOrders);
    setCategories(cats);
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
    return <div className="mx-auto max-w-4xl px-4 py-16 text-center text-neutral-500">Loading…</div>;
  }

  if (!shop) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-neutral-500">
        We couldn&apos;t find a shop linked to your account.
      </div>
    );
  }

  const heldOrders = orders.filter((o) => o.status === "paid_held").length;
  const totalPaidOut = orders
    .filter((o) => o.status === "completed")
    .reduce((sum, o) => sum + o.total_amount_fcfa, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">{shop.shop_name}</h1>
      <p className="text-neutral-500 text-sm mb-8">Seller dashboard</p>

      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        <Stat label="Listings" value={String(products.length)} />
        <Stat label="Orders held" value={String(heldOrders)} />
        <Stat label="Paid out" value={formatFcfa(totalPaidOut)} />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Your listings</h2>
        <button
          onClick={() => setShowAddProduct((v) => !v)}
          className="text-sm rounded-full bg-neutral-900 text-white px-4 py-1.5"
        >
          {showAddProduct ? "Cancel" : "+ Add product"}
        </button>
      </div>

      {showAddProduct && (
        <AddProductForm
          shopId={shop.id}
          categories={categories}
          onDone={() => {
            setShowAddProduct(false);
            loadData();
          }}
        />
      )}

      <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100">
        {products.map((p) => (
          <div key={p.id} className="flex items-center gap-3 p-4">
            <div className="w-12 h-12 rounded-lg bg-neutral-100 flex items-center justify-center text-xl overflow-hidden">
              {p.image_urls?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_urls[0]} alt={p.title} className="w-full h-full object-cover" />
              ) : (
                "🛍️"
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{p.title}</p>
              <p className="text-xs text-neutral-500">{p.category?.name}</p>
            </div>
            <p className="text-sm font-semibold">{formatFcfa(p.price_fcfa)}</p>
          </div>
        ))}
        {products.length === 0 && (
          <p className="text-sm text-neutral-500 p-8 text-center">
            No listings yet — add your first product above.
          </p>
        )}
      </div>

      <h2 className="text-lg font-semibold mt-10 mb-4">Orders</h2>
      {orders.length === 0 ? (
        <p className="text-sm text-neutral-500 rounded-xl border border-dashed border-neutral-300 p-8 text-center">
          No orders yet. Once a buyer pays, it will show up here as
          &ldquo;held&rdquo; until you mark it shipped and the buyer confirms
          receipt.
        </p>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100">
          {orders.map((o) => (
            <div key={o.id} className="flex items-center gap-3 p-4">
              <div className="flex-1">
                <p className="text-sm font-medium">{formatFcfa(o.total_amount_fcfa)}</p>
                <p className="text-xs text-neutral-500">
                  {o.buyer_phone ?? "unknown buyer"} · {o.status}
                </p>
              </div>
              {o.status === "paid_held" && (
                <button
                  onClick={async () => {
                    await markOrderShipped(o.id);
                    loadData();
                  }}
                  className="text-xs rounded-full border border-neutral-300 px-3 py-1.5 hover:border-neutral-900"
                >
                  Mark shipped
                </button>
              )}
            </div>
          ))}
        </div>
      )}
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

function AddProductForm({
  shopId,
  categories,
  onDone,
}: {
  shopId: string;
  categories: Category[];
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      let imageUrls: string[] = [];
      if (file) {
        const url = await uploadProductImage(file, shopId);
        imageUrls = [url];
      }
      await createProduct({
        shopId,
        categoryId: categoryId || null,
        title,
        description,
        priceFcfa: Number(price),
        stockQuantity: Number(stock),
        imageUrls,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add product.");
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
        <label className="text-sm font-medium block mb-1">Product name</label>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium block mb-1">Price (FCFA)</label>
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
          <label className="text-sm font-medium block mb-1">Stock</label>
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
        <label className="text-sm font-medium block mb-1">Category</label>
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
        <label className="text-sm font-medium block mb-1">Photo</label>
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
      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-neutral-900 text-white font-semibold px-6 py-2.5 text-sm hover:bg-neutral-700 disabled:opacity-60"
      >
        {submitting ? "Saving…" : "Add product"}
      </button>
    </form>
  );
}
