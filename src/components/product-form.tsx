"use client";

import { useState } from "react";
import {
  createProduct,
  updateProduct,
  uploadProductImage,
  type Category,
  type Product,
  type ProductCondition,
} from "@/lib/supabase";
import type { Dictionary } from "@/lib/i18n";

// Shared add/edit product form — used by the seller dashboard and by
// the "add your first product" step of the onboarding wizard, so the
// two don't drift into two slightly different product forms over time.
export function ProductForm({
  shopId,
  categories,
  existingProduct,
  t,
  onDone,
  onCancel,
  cancelLabel,
}: {
  shopId: string;
  categories: Category[];
  existingProduct?: Product;
  t: Dictionary;
  onDone: () => void;
  onCancel: () => void;
  cancelLabel?: string;
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
          {cancelLabel ?? t.dashboard.cancel}
        </button>
      </div>
    </form>
  );
}
