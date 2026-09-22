import Link from "next/link";
import Image from "next/image";
import {
  getCategories,
  getActiveProducts,
  getActiveShopCities,
  type ProductCondition,
  type ProductSort,
} from "@/lib/supabase";
import { formatFcfa } from "@/lib/format";
import { getLocale } from "@/lib/get-locale";
import { getDictionary, plural } from "@/lib/i18n";
import NearMeButton from "./near-me-button";
import { IconShield, IconBag, IconStar, IconPin, StatusDot } from "@/components/dash-icons";
import { FavoriteButton } from "@/components/favorite-button";

export const dynamic = "force-dynamic";

const VALID_CONDITIONS: ProductCondition[] = ["new", "like_new", "used"];
const VALID_SORTS: ProductSort[] = ["newest", "price_asc", "price_desc", "rating_desc", "nearest"];

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
  }>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { category, q, minPrice, maxPrice, condition, sort, verified, city, brand, size, color, lat, lng } =
    await searchParams;
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
          <option value="new">{t.product.conditionNew}</option>
          <option value="like_new">{t.product.conditionLikeNew}</option>
          <option value="used">{t.product.conditionUsed}</option>
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
          <option value="price_asc">{t.browse.sortPriceAsc}</option>
          <option value="price_desc">{t.browse.sortPriceDesc}</option>
          <option value="rating_desc">{t.browse.sortRatingDesc}</option>
          {lat && lng && <option value="nearest">{t.browse.sortNearest}</option>}
        </select>
        <label className="flex items-center gap-1.5 text-sm rounded-lg border border-neutral-300 px-3 py-2 cursor-pointer">
          <input type="checkbox" name="verified" value="1" defaultChecked={verifiedOnly} />
          <IconShield className="w-3.5 h-3.5" /> {t.browse.verifiedOnly}
        </label>
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
          <Link
            key={p.id}
            href={`/product/${p.id}`}
            className="rounded-xl border border-neutral-200 bg-white overflow-hidden hover:shadow-md transition"
          >
            <div className="relative aspect-square bg-neutral-100 flex items-center justify-center overflow-hidden">
              <div className="absolute top-2 right-2 z-10">
                <FavoriteButton productId={p.id} size="sm" />
              </div>
              {p.image_urls?.[0] ? (
                <Image
                  src={p.image_urls[0]}
                  alt={p.title}
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover"
                />
              ) : (
                <IconBag className="w-10 h-10 text-neutral-300" />
              )}
            </div>
            <div className="p-3">
              <p className="text-sm font-medium line-clamp-1">{p.title}</p>
              <p className="text-xs text-neutral-500 mt-0.5 flex items-center gap-1">
                {p.shop?.shop_name}
                {p.shop?.is_verified && <StatusDot tone="success" className="inline-block w-1.5 h-1.5 rounded-full shrink-0" />}
              </p>
              {p.condition !== "new" && (
                <span className="inline-block mt-1 text-[10px] font-semibold rounded-full bg-neutral-100 px-2 py-0.5">
                  {p.condition === "like_new" ? t.product.conditionLikeNew : t.product.conditionUsed}
                </span>
              )}
              <p className="text-sm font-semibold mt-1">
                {formatFcfa(p.price_fcfa)}
              </p>
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
            </div>
          </Link>
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
