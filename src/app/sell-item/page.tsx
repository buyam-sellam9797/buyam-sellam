"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  supabase,
  getMyShop,
  getMyProfile,
  getCategories,
  openShopForCurrentUser,
  uploadProductImage,
  createProduct,
  type Category,
  type ProductCondition,
} from "@/lib/supabase";
import { useLocale } from "@/components/locale-provider";
import { formatFcfa } from "@/lib/format";
import { CITIES } from "@/lib/cities";

type Suggestion = {
  category: { id: string; slug: string; name: string } | null;
  price: { low: number; typical: number; high: number; basedOn: number } | null;
};

type Stage = { kind: "checking" } | { kind: "loggedOut" } | { kind: "hasShop" } | { kind: "form" };

// "Sell one item": for someone who just wants to sell something they own
// (a phone, a dress, shoes) without setting up a business shop. One short
// form; behind the scenes it creates a small personal shop on the same
// account, so the item gets the same safe payment, chat and delivery flow
// as any other listing. As the title is typed, it suggests a category and
// — when there are enough similar items on the site — a price range.
export default function SellItemPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ kind: "checking" });
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [condition, setCondition] = useState<ProductCondition>("used");
  const [categoryId, setCategoryId] = useState("");
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [price, setPrice] = useState("");
  const [city, setCity] = useState<string>(CITIES[0].name);
  const [whatsapp, setWhatsapp] = useState("");
  const [fullName, setFullName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        setStage({ kind: "loggedOut" });
        return;
      }
      const [shop, profile, cats] = await Promise.all([getMyShop(), getMyProfile(), getCategories()]);
      if (cancelled) return;
      if (shop) {
        setStage({ kind: "hasShop" });
        return;
      }
      setCategories(cats);
      setCategoryId(cats[0]?.id ?? "");
      if (profile?.full_name) setFullName(profile.full_name);
      if (profile?.city) setCity(profile.city);
      if (profile?.phone_number) setWhatsapp(profile.phone_number);
      setStage({ kind: "form" });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function onTitleChange(value: string) {
    setTitle(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (value.trim().length < 3) {
        setSuggestion(null);
        return;
      }
      try {
        const res = await fetch(`/api/listing-suggest?title=${encodeURIComponent(value)}`);
        const s: Suggestion = await res.json();
        setSuggestion(s);
        if (s.category && !categoryTouched) setCategoryId(s.category.id);
      } catch {
        // suggestions are optional
      }
    }, 600);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError(t.sellItem.errorPhoto);
      return;
    }
    setSubmitting(true);
    try {
      const first = fullName.trim().split(/\s+/)[0] || "";
      const shopName = first ? t.sellItem.shopNamePattern.replace("{name}", first) : t.sellItem.shopNameFallback;
      await openShopForCurrentUser({ shopName, whatsappNumber: whatsapp, city, isPersonal: true });
      const shop = await getMyShop();
      if (!shop) throw new Error(t.sellItem.errorGeneric);
      const imageUrl = await uploadProductImage(file, shop.id);
      const { id } = await createProduct({
        shopId: shop.id,
        categoryId: categoryId || null,
        title: title.trim(),
        description: description.trim(),
        brand: "",
        priceFcfa: Number(price),
        stockQuantity: 1,
        imageUrls: [imageUrl],
        condition,
        sizes: [],
        colors: [],
      });
      router.push(id ? `/product/${id}` : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.sellItem.errorGeneric);
      setSubmitting(false);
    }
  }

  if (stage.kind === "checking") {
    return <div className="mx-auto max-w-xl px-4 py-16 text-center text-sm text-neutral-500">{t.becomeSeller.checking}</div>;
  }

  const intro = (
    <>
      <p className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-2">{t.sellItem.kicker}</p>
      <h1 className="text-3xl font-bold tracking-tight">{t.sellItem.title}</h1>
      <p className="text-neutral-600 mt-3">{t.sellItem.subtitle}</p>
    </>
  );

  if (stage.kind === "loggedOut") {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        {intro}
        <div className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
          <p className="text-sm text-neutral-700">{t.sellItem.needAccount}</p>
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <Link href="/signup?role=buyer" className="rounded-full bg-neutral-900 text-white font-semibold px-6 py-3 hover:bg-neutral-700 text-center">
              {t.sellItem.createAccount}
            </Link>
            <Link href="/login" className="rounded-full border border-neutral-300 font-semibold px-6 py-3 hover:border-neutral-900 text-center">
              {t.becomeSeller.haveAccount}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (stage.kind === "hasShop") {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        {intro}
        <div className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
          <p className="text-sm text-neutral-700">{t.sellItem.hasShop}</p>
          <Link href="/dashboard" className="inline-block mt-4 rounded-full bg-neutral-900 text-white font-semibold px-6 py-3 hover:bg-neutral-700">
            {t.sellItem.goToDashboard}
          </Link>
        </div>
      </div>
    );
  }

  const field = "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm";

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      {intro}
      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
        <div>
          <label className="text-sm font-medium block mb-1" htmlFor="photo">{t.sellItem.photo}</label>
          <input id="photo" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1" htmlFor="title">{t.sellItem.itemTitle}</label>
          <input id="title" required maxLength={120} value={title} onChange={(e) => onTitleChange(e.target.value)} placeholder={t.sellItem.itemTitlePlaceholder} className={field} />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1" htmlFor="category">{t.sellItem.category}</label>
          <select
            id="category"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setCategoryTouched(true);
            }}
            className={field}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {suggestion?.category && (
            <p className="text-xs text-neutral-500 mt-1">{t.sellItem.suggestedCategory.replace("{name}", suggestion.category.name)}</p>
          )}
        </div>
        <div>
          <label className="text-sm font-medium block mb-1" htmlFor="condition">{t.sellItem.condition}</label>
          <select id="condition" value={condition} onChange={(e) => setCondition(e.target.value as ProductCondition)} className={field}>
            <option value="new">{t.product.conditionNew}</option>
            <option value="like_new">{t.product.conditionLikeNew}</option>
            <option value="used">{t.product.conditionUsed}</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1" htmlFor="price">{t.sellItem.price}</label>
          <input id="price" required type="number" min={100} step={50} value={price} onChange={(e) => setPrice(e.target.value)} className={field} />
          {suggestion?.price ? (
            <div className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
              <p>
                {t.sellItem.priceRange
                  .replace("{low}", formatFcfa(suggestion.price.low))
                  .replace("{high}", formatFcfa(suggestion.price.high))
                  .replace("{n}", String(suggestion.price.basedOn))}
              </p>
              <button type="button" onClick={() => setPrice(String(suggestion.price!.typical))} className="mt-1 font-semibold underline underline-offset-2">
                {t.sellItem.useTypical.replace("{price}", formatFcfa(suggestion.price.typical))}
              </button>
            </div>
          ) : (
            title.trim().length >= 3 && suggestion && <p className="text-xs text-neutral-500 mt-1">{t.sellItem.noPriceYet}</p>
          )}
        </div>
        <div>
          <label className="text-sm font-medium block mb-1" htmlFor="description">{t.sellItem.description}</label>
          <textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t.sellItem.descriptionPlaceholder} className={field} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium block mb-1" htmlFor="city">{t.sellItem.city}</label>
            <select id="city" value={city} onChange={(e) => setCity(e.target.value)} className={field}>
              {CITIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1" htmlFor="whatsapp">{t.sellItem.whatsapp}</label>
            <input id="whatsapp" required type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={field} />
          </div>
        </div>
        <label className="flex items-start gap-3 text-sm cursor-pointer">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 w-4 h-4 accent-neutral-900" />
          <span>
            {t.sellItem.agree}{" "}
            <Link href="/terms" target="_blank" className="font-semibold underline underline-offset-2">
              {t.becomeSeller.terms}
            </Link>
            .
          </span>
        </label>
        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <button type="submit" disabled={!agreed || submitting} className="rounded-full bg-neutral-900 text-white font-semibold px-6 py-3 hover:bg-neutral-700 disabled:opacity-40">
          {submitting ? t.sellItem.publishing : t.sellItem.publish}
        </button>
        <p className="text-xs text-neutral-500">{t.sellItem.afterNote}</p>
      </form>
    </div>
  );
}
