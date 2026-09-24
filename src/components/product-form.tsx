"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  createProduct,
  updateProduct,
  uploadProductImage,
  uploadProductVoiceNote,
  getOfferSettings,
  saveOfferSettings,
  type Category,
  type Product,
} from "@/lib/supabase";
import type { Dictionary } from "@/lib/i18n";
import { VoiceNoteRecorder } from "@/components/voice-note-recorder";
import { ConditionPicker } from "@/components/condition-picker";
import { normalizeCondition, isSecondHand, isOwnedFor, type Condition } from "@/lib/conditions";

export const MAX_PHOTOS = 8;

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
  const [condition, setCondition] = useState<Condition>(normalizeCondition(existingProduct?.condition ?? "new"));
  const [ownedFor, setOwnedFor] = useState(existingProduct?.owned_for ?? "");
  const [acceptsOffers, setAcceptsOffers] = useState(Boolean(existingProduct?.accepts_offers));
  const [autoAccept, setAutoAccept] = useState("");
  const [floor, setFloor] = useState("");
  const [sizes, setSizes] = useState(existingProduct?.sizes?.join(", ") ?? "");
  const [colors, setColors] = useState(existingProduct?.colors?.join(", ") ?? "");
  const [salePrice, setSalePrice] = useState(
    existingProduct?.sale_price_fcfa != null ? String(existingProduct.sale_price_fcfa) : ""
  );
  const [isFeatured, setIsFeatured] = useState(existingProduct?.is_featured ?? false);
  // "" = follow the shop's installment setting, "0" = off, "2".."6" = that many payments.
  const [layawayChoice, setLayawayChoice] = useState(
    existingProduct?.layaway_installments == null ? "" : String(existingProduct.layaway_installments)
  );
  // Photos: the ones already saved (in order, first = cover) plus new
  // files picked now, up to MAX_PHOTOS in total.
  const [keptPhotos, setKeptPhotos] = useState<string[]>(existingProduct?.image_urls ?? []);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const previews = useMemo(() => newFiles.map((f) => URL.createObjectURL(f)), [newFiles]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  // The private negotiation numbers are loaded separately (owner-only).
  useEffect(() => {
    if (!existingProduct) return;
    let cancelled = false;
    getOfferSettings(existingProduct.id).then((settings) => {
      if (cancelled || !settings) return;
      setAutoAccept(settings.autoaccept_fcfa ? String(settings.autoaccept_fcfa) : "");
      setFloor(settings.floor_fcfa ? String(settings.floor_fcfa) : "");
    });
    return () => {
      cancelled = true;
    };
  }, [existingProduct]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const room = MAX_PHOTOS - keptPhotos.length - newFiles.length;
    setNewFiles((prev) => [...prev, ...Array.from(list).slice(0, Math.max(0, room))]);
  }
  // undefined = unchanged, null = removed, object = newly recorded.
  const [voice, setVoice] = useState<{ blob: Blob; ext: string } | null | undefined>(undefined);
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
    if (salePrice.trim() && Number(salePrice) >= Number(price)) {
      setError(t.dashboard.salePriceMustBeLower);
      return;
    }
    const listPrice = salePrice.trim() ? Number(salePrice) : Number(price);
    const autoAcceptFcfa = acceptsOffers && autoAccept.trim() ? Number(autoAccept) : null;
    const floorFcfa = acceptsOffers && floor.trim() ? Number(floor) : null;
    if (
      (autoAcceptFcfa != null && autoAcceptFcfa >= listPrice) ||
      (floorFcfa != null && floorFcfa >= listPrice) ||
      (autoAcceptFcfa != null && floorFcfa != null && autoAcceptFcfa <= floorFcfa)
    ) {
      setError(t.offers.formRangeError);
      return;
    }
    setSubmitting(true);
    try {
      const uploaded: string[] = [];
      for (const f of newFiles) uploaded.push(await uploadProductImage(f, shopId));
      const imageUrls = [...keptPhotos, ...uploaded].slice(0, MAX_PHOTOS);
      let voiceNoteUrl: string | null | undefined;
      if (voice === null) voiceNoteUrl = null;
      else if (voice) voiceNoteUrl = await uploadProductVoiceNote(voice.blob, shopId, voice.ext);
      const salePriceFcfa = salePrice.trim() ? Number(salePrice) : null;
      const sharedFields = {
        categoryId: categoryId || null,
        title,
        description,
        brand,
        priceFcfa: Number(price),
        stockQuantity: Number(stock),
        condition,
        ownedFor: isSecondHand(condition) && isOwnedFor(ownedFor) ? ownedFor : null,
        acceptsOffers,
        sizes: parseList(sizes),
        colors: parseList(colors),
        salePriceFcfa,
        isFeatured,
        layawayInstallments: layawayChoice === "" ? null : Number(layawayChoice),
        voiceNoteUrl,
      };
      let productId = existingProduct?.id ?? null;
      if (isEditing && existingProduct) {
        await updateProduct(existingProduct.id, { ...sharedFields, imageUrls });
      } else {
        productId = (await createProduct({ ...sharedFields, shopId, imageUrls })).id;
      }
      if (productId && (acceptsOffers || autoAccept || floor)) {
        await saveOfferSettings({ productId, shopId, autoacceptFcfa: autoAcceptFcfa, floorFcfa: floorFcfa });
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
      <VoiceNoteRecorder existingUrl={existingProduct?.voice_note_url ?? null} t={t} onChange={setVoice} />
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
        <label className="text-sm font-medium block mb-1">{t.dashboard.salePriceLabel}</label>
        <input
          type="number"
          min={1}
          value={salePrice}
          onChange={(e) => setSalePrice(e.target.value)}
          placeholder={t.dashboard.salePricePlaceholder}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <p className="text-xs text-neutral-500 mt-1">{t.dashboard.salePriceHint}</p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
        {t.dashboard.isFeaturedLabel}
      </label>
      <p className="text-xs text-neutral-500 -mt-3">{t.dashboard.isFeaturedHint}</p>
      <div>
        <label className="text-sm font-medium block mb-1" htmlFor="layawayChoice">
          {t.dashboard.layawayProductLabel}
        </label>
        <select
          id="layawayChoice"
          value={layawayChoice}
          onChange={(e) => setLayawayChoice(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="">{t.dashboard.layawayProductDefault}</option>
          <option value="0">{t.dashboard.layawayProductOff}</option>
          {[2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={String(n)}>
              {t.dashboard.layawayProductCount.replace("{n}", String(n))}
            </option>
          ))}
        </select>
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
      <ConditionPicker
        value={condition}
        onChange={setCondition}
        ownedFor={ownedFor}
        onOwnedForChange={setOwnedFor}
        t={t}
      />
      <div className="rounded-xl border border-neutral-200 p-4">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" className="mt-1" checked={acceptsOffers} onChange={(e) => setAcceptsOffers(e.target.checked)} />
          <span>
            <span className="block text-sm font-semibold">{t.offers.formToggle}</span>
            <span className="block text-xs text-neutral-500">{t.offers.formToggleHint}</span>
          </span>
        </label>
        {acceptsOffers && (
          <div className="mt-3 grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1" htmlFor="offer-auto">{t.offers.formAutoAccept}</label>
              <input
                id="offer-auto"
                type="number"
                min={1}
                value={autoAccept}
                onChange={(e) => setAutoAccept(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
              <p className="text-[11px] text-neutral-500 mt-1">{t.offers.formAutoAcceptHint}</p>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" htmlFor="offer-floor">{t.offers.formFloor}</label>
              <input
                id="offer-floor"
                type="number"
                min={1}
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
              <p className="text-[11px] text-neutral-500 mt-1">{t.offers.formFloorHint}</p>
            </div>
          </div>
        )}
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
        <p className="text-sm font-medium mb-1">{t.dashboard.photo}</p>
        <p className="text-xs text-neutral-500 mb-2">{t.photos.hint.replace("{max}", String(MAX_PHOTOS))}</p>
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
          {keptPhotos.map((url, i) => (
            <div key={url} className="relative aspect-square rounded-lg overflow-hidden bg-neutral-100">
              <Image src={url} alt="" fill sizes="96px" className="object-cover" />
              {i === 0 && (
                <span className="absolute bottom-1 left-1 rounded bg-black/70 text-white text-[10px] font-semibold px-1.5 py-0.5">
                  {t.photos.cover}
                </span>
              )}
              <button
                type="button"
                onClick={() => setKeptPhotos((prev) => prev.filter((u) => u !== url))}
                aria-label={t.photos.remove}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 text-sm leading-none shadow"
              >
                ×
              </button>
            </div>
          ))}
          {previews.map((url, i) => (
            <div key={url} className="relative aspect-square rounded-lg overflow-hidden bg-neutral-100">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a file not uploaded yet */}
              <img src={url} alt="" className="w-full h-full object-cover" />
              {keptPhotos.length === 0 && i === 0 && (
                <span className="absolute bottom-1 left-1 rounded bg-black/70 text-white text-[10px] font-semibold px-1.5 py-0.5">
                  {t.photos.cover}
                </span>
              )}
              <button
                type="button"
                onClick={() => setNewFiles((prev) => prev.filter((_, j) => j !== i))}
                aria-label={t.photos.remove}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 text-sm leading-none shadow"
              >
                ×
              </button>
            </div>
          ))}
          {keptPhotos.length + newFiles.length < MAX_PHOTOS && (
            <label className="aspect-square rounded-lg border-2 border-dashed border-neutral-300 hover:border-neutral-900 flex flex-col items-center justify-center cursor-pointer text-neutral-500 text-xs text-center px-1">
              <span className="text-2xl leading-none">+</span>
              {t.photos.add}
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
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
