import Link from "next/link";
import {
  getCategories,
  getActiveProducts,
  getActiveShopCities,
  type ProductCondition,
  type ProductSort,
} from "@/lib/supabase";
import { getLocale } from "@/lib/get-locale";
import { getDictionary, plural } from "@/lib/i18n";
import NearMeButton from "./near-me-button";
import { IconShield, IconStar, IconPin, IconHandshake } from "@/components/dash-icons";
import { ProductCard } from "@/components/product-card";
import { CONDITIONS } from "@/lib/conditions";

export const dynamic = "force-dynamic";

const VALID_CONDITIONS: ProductCondition[] = [...CONDITIONS, "used"];
const VALID_SORTS: ProductSort[] = ["newest", "popular", "price_asc", "price_desc", "rating_desc", "nearest"];

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    q?: string;
    minPrice?: string;
    maxPrice?: string;
    condition?: string;
    sort?: string;
    verified?: string;
    city?: string;
    brand?: string;
    size?: string;
    color?: string;
    lat?: string;
    lng?: string;
    offers?: string;
    sale?: string;
  }>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { category, q, minPrice, maxPrice, condition, sort, verified, city, brand, size, color, lat, lng, offers, sale } =
    await searchParams;
  const offersOnly = offers === "1";
  const onSale = sale === "1";
  const minPriceNum = minPrice ? Number(minPrice) : undefined;
  const maxPriceNum = maxPrice ? Number(maxPrice) : undefined;
  const conditionFilter = VALID_CONDITIONS.includes(condition as ProductCondition)
    ? (condition as ProductCondition)
    : undefined;
  const sortOption = VALID_SORTS.includes(sort as ProductSort) ? (sort as ProductSort) : "newest";
  const verifiedOnly = verified === "1";
  const nearLat = lat ? Number(lat) : undefined;
  const nearLng = lng ? Number(lng) : undefined;
  const [categories, cities, filtered] = await Promise.all([
    getCategories(),
    getActiveShopCities(),
    getActiveProducts(category, {
      q,
      minPrice: Number.isFinite(minPriceNum) ? minPriceNum : undefined,
      maxPrice: Number.isFinite(maxPriceNum) ? maxPriceNum : undefined,
      condition: conditionFilter,
      sort: sortOption,
      verifiedOnly,
      city: city || undefined,
      brand: brand || undefined,
      size: size || undefined,
      color: color || undefined,
      nearLat: Number.isFinite(nearLat) ? nearLat : undefined,
      nearLng: Number.isFinite(nearLng) ? nearLng : undefined,
      offersOnly,
      onSale,
    }),
  ]);
  const activeCategory = categories.find((c) => c.slug === category);
  const hasFilters = Boolean(
    q ||
      minPrice ||
      maxPrice ||
      category ||
      condition ||
      verifiedOnly ||
      city ||
      brand ||
      size ||
      color ||
      offersOnly ||
      onSale ||
      (sort && sort !== "newest")
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">{t.browse.title}</h1>
      <p className="text-neutral-500 text-sm mb-6">
        {filtered.length} {plural(filtered.length, locale, t.browse.itemOne, t.browse.itemOther)}
        {activeCategory ? ` ${t.browse.inCategory} ${activeCategory.name}` : ""}
      </p>

      <NearMeButton
        t={{ nearMe: t.browse.nearMe, locating: t.browse.locating, locationDenied: t.browse.locationDenied }}
      />

      <form className="flex flex-wrap gap-2 mb-4" method="GET" action="/browse">
        {category && <input type="hidden" name="category" value={category} />}
        {lat && <input type="hidden" name="lat" value={lat} />}
        {lng && <input type="hidden" name="lng" value={lng} />}
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder={t.browse.searchPlaceholder}
          className="flex-1 min-w-[10rem] rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          type="number"
          name="minPrice"
          defaultValue={minPrice ?? ""}
          placeholder={t.browse.minPrice}
          className="w-28 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          type="number"
          name="maxPrice"
          defaultValue={maxPrice ?? ""}
          placeholder={t.browse.maxPrice}
          className="w-28 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <select
          name="condition"
          defaultValue={conditionFilter ?? ""}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white"
        >
          <option value="">{t.browse.anyCondition}</option>
          {CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {t.conditions.grades[c]}
            </option>
          ))}
        </select>
        {cities.length > 0 && (
          <select
            name="city"
            defaultValue={city ?? ""}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white"
          >
            <option value="">{t.browse.anyLocation}</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        <input
          type="text"
          name="brand"
          defaultValue={brand ?? ""}
          placeholder={t.browse.brandPlaceholder}
          className="w-32 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          type="text"
          name="size"
          defaultValue={size ?? ""}
          placeholder={t.browse.sizePlaceholder}
          className="w-24 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          type="text"
          name="color"
          defaultValue={color ?? ""}
          placeholder={t.browse.colorPlaceholder}
          className="w-24 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <select
          name="sort"
          defaultValue={sortOption}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white"
        >
          <option value="newest">{t.browse.sortNewest}</option>
          <option value="popular">{t.shelves.sortPopular}</option>
          <option value="price_asc">{t.browse.sortPriceAsc}</option>
          <option value="price_desc">{t.browse.sortPriceDesc}</option>
          <option value="rating_desc">{t.browse.sortRatingDesc}</option>
          {lat && lng && <option value="nearest">{t.browse.sortNearest}</option>}
        </select>
        <label className="flex items-center gap-1.5 text-sm rounded-lg border border-neutral-300 px-3 py-2 cursor-pointer">
          <input type="checkbox" name="verified" value="1" defaultChecked={verifiedOnly} />
          <IconShield className="w-3.5 h-3.5" /> {t.browse.verifiedOnly}
        </label>
        <label className="flex items-center gap-1.5 text-sm rounded-lg border border-neutral-300 px-3 py-2 cursor-pointer">
          <input type="checkbox" name="offers" value="1" defaultChecked={offersOnly} />
          <IconHandshake className="w-3.5 h-3.5" /> {t.offers.openToOffers}
        </label>
        {onSale && <input type="hidden" name="sale" value="1" />}
        <button
          type="submit"
          className="rounded-lg bg-neutral-900 text-white px-4 py-2 text-sm font-semibold hover:bg-neutral-700"
        >
          {t.browse.searchButton}
        </button>
        {hasFilters && (
          <Link
            href="/browse"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold hover:border-neutral-900"
          >
            {t.browse.clearFilters}
          </Link>
        )}
      </form>

      <div className="flex flex-wrap gap-2 mb-8">
        <Link
          href="/browse"
          className={`text-sm rounded-full px-4 py-1.5 border ${
            !category
              ? "bg-neutral-900 text-white border-neutral-900"
              : "border-neutral-300 hover:border-neutral-900"
          }`}
        >
          {t.browse.all}
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/browse?category=${encodeURIComponent(c.slug)}`}
            className={`text-sm rounded-full px-4 py-1.5 border ${
              category === c.slug
                ? "bg-neutral-900 text-white border-neutral-900"
                : "border-neutral-300 hover:border-neutral-900"
            }`}
          >
            {c.name}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {filtered.map((p) => (
          <ProductCard key={p.id} product={p} t={t}>
            {sortOption === "rating_desc" && typeof p.shopRating === "number" && p.shopRating > 0 && (
              <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                <IconStar filled className="w-3 h-3 shrink-0" /> {p.shopRating.toFixed(1)}
              </p>
            )}
            {sortOption === "nearest" && typeof p.distanceKm === "number" && (
              <p className="text-xs text-neutral-500 mt-0.5 flex items-center gap-1">
                <IconPin className="w-3 h-3 shrink-0" /> {p.distanceKm.toFixed(1)} km
              </p>
            )}
          </ProductCard>
        ))}
        {filtered.length === 0 && (
          <p className="text-neutral-500 text-sm col-span-full py-12 text-center">
            {t.browse.noListings}
          </p>
        )}
      </div>
    </div>
  );
}
