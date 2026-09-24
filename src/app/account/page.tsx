"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  supabase,
  getMyProfile,
  updateBuyerProfile,
  getMyBuyerOrders,
  getMyAddresses,
  createAddress,
  deleteAddress,
  getMyShop,
  getMyFavorites,
  getMyFollowedShops,
  setFollowing,
  type FollowedShop,
  toggleFavorite,
  getMyLayawayOrders,
  type BuyerProfile,
  type BuyerOrder,
  type BuyerAddress,
  type FavoriteProduct,
  type LayawayOrder,
} from "@/lib/supabase";
import { getMyConversationsAsBuyer, type BuyerConversation } from "@/lib/messaging";
import { formatFcfa } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";
import { SpaceSwitch } from "@/components/space-switch";
import { requestLocation, geoProblem } from "@/lib/geolocate";
import { LocationProblem } from "@/components/location-problem";
import { useFavoritesContext } from "@/components/favorites-provider";
import { IconPin, IconChat, IconHeart, IconBag } from "@/components/dash-icons";

export default function AccountPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<BuyerProfile | null>(null);
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [addresses, setAddresses] = useState<BuyerAddress[]>([]);
  const [conversations, setConversations] = useState<BuyerConversation[]>([]);
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);
  const [layawayOrders, setLayawayOrders] = useState<LayawayOrder[]>([]);
  const [hasShop, setHasShop] = useState(false);

  const loadData = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }
    // Buyer accounts and seller accounts share the same login, so
    // someone who owns a shop and lands here (e.g. via the "Account"
    // link in the header) still needs a way back to their dashboard —
    // otherwise this page is a dead end for them.
    const [myProfile, myOrders, myAddresses, myShop, myConversations, myFavorites, myLayawayOrders] = await Promise.all([
      getMyProfile(),
      getMyBuyerOrders(),
      getMyAddresses(),
      getMyShop(),
      getMyConversationsAsBuyer(),
      getMyFavorites(),
      getMyLayawayOrders(),
    ]);
    setProfile(myProfile);
    setOrders(myOrders);
    setAddresses(myAddresses);
    setHasShop(!!myShop);
    setConversations(myConversations);
    setFavorites(myFavorites);
    setLayawayOrders(myLayawayOrders);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-neutral-500">{t.account.loading}</div>;
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-neutral-500">
        {t.account.noProfile}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 flex flex-col gap-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">{t.spaces.buyerSpace}</p>
          <h1 className="text-2xl font-bold">{t.account.title}</h1>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm rounded-full border border-neutral-300 px-4 py-1.5 hover:border-neutral-900"
        >
          {t.account.logout}
        </button>
      </div>

      <div className="flex flex-col gap-2 -mt-4">
        <SpaceSwitch active="buying" hasShop={hasShop} />
        <p className="text-xs text-neutral-500">{hasShop ? t.spaces.buyerHintSeller : t.spaces.buyerHint}</p>
      </div>

      <ProfileSection profile={profile} t={t} onSaved={(p) => setProfile((prev) => (prev ? { ...prev, ...p } : prev))} />

      <AddressesSection
        addresses={addresses}
        t={t}
        onChanged={async () => setAddresses(await getMyAddresses())}
      />

      <MessagesSection conversations={conversations} t={t} />

      <FollowedShopsSection t={t} />

      <FavoritesSection
        favorites={favorites}
        t={t}
        onRemoved={(productId) => setFavorites((prev) => prev.filter((p) => p.id !== productId))}
      />

      {layawayOrders.length > 0 && (
        <LayawaySection
          layawayOrders={layawayOrders}
          t={t}
          onPaid={(orderId) =>
            setLayawayOrders((prev) =>
              prev.map((o) =>
                o.id === orderId
                  ? { ...o, installments: o.installments.map((i) => ({ ...i, status: "paid", paid_at: new Date().toISOString() })) }
                  : o
              )
            )
          }
        />
      )}

      <OrdersSection orders={orders} t={t} />
    </div>
  );
}

function ProfileSection({
  profile,
  t,
  onSaved,
}: {
  profile: BuyerProfile;
  t: ReturnType<typeof useLocale>["t"];
  onSaved: (patch: Partial<BuyerProfile>) => void;
}) {
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [phone, setPhone] = useState(profile.phone_number ?? "");
  const [city, setCity] = useState(profile.city ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateBuyerProfile({ fullName, phone, city });
      onSaved({ full_name: fullName, phone_number: phone, city });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h2 className="text-sm font-semibold mb-3">{t.account.profileTitle}</h2>
      <form onSubmit={handleSave} className="rounded-xl border border-neutral-200 bg-white p-5 flex flex-col gap-3 max-w-md">
        <div>
          <label className="text-xs font-medium block mb-1">{t.account.fullNameLabel}</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">{t.account.phoneLabel}</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">{t.account.cityLabel}</label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}
        {saved && !error && (
          <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            {t.account.profileSaved}
          </p>
        )}
        <button
          type="submit"
          disabled={saving}
          className="text-sm rounded-full bg-neutral-900 text-white px-5 py-2 disabled:opacity-60 self-start"
        >
          {saving ? t.account.saving : t.account.saveProfile}
        </button>
      </form>
    </section>
  );
}

function AddressesSection({
  addresses,
  t,
  onChanged,
}: {
  addresses: BuyerAddress[];
  t: ReturnType<typeof useLocale>["t"];
  onChanged: () => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [address, setAddress] = useState("");
  const [isDefault, setIsDefault] = useState(addresses.length === 0);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function useMyLocation() {
    setLocating(true);
    setLocationError(null);
    try {
      const pos = await requestLocation();
      setLatitude(pos.latitude);
      setLongitude(pos.longitude);
    } catch (err) {
      setLocationError(geoProblem(err, t.account.locationDenied));
    } finally {
      setLocating(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createAddress({ label, fullName, phone, city, neighborhood, address, isDefault, latitude, longitude });
      await onChanged();
      setAdding(false);
      setLabel("");
      setFullName("");
      setPhone("");
      setCity("");
      setNeighborhood("");
      setAddress("");
      setIsDefault(false);
      setLatitude(null);
      setLongitude(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this address.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteAddress(id);
      await onChanged();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">{t.account.addressesTitle}</h2>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-xs rounded-full border border-neutral-300 px-3 py-1.5 hover:border-neutral-900"
          >
            {t.account.addAddress}
          </button>
        )}
      </div>

      {addresses.length === 0 && !adding && (
        <p className="text-sm text-neutral-500">{t.account.noAddresses}</p>
      )}

      <div className="flex flex-col gap-3">
        {addresses.map((a) => (
          <div key={a.id} className="rounded-xl border border-neutral-200 bg-white p-4 text-sm flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">
                {a.label || t.account.addressUntitled} {a.is_default && `· ${t.account.defaultLabel}`}
              </p>
              <p className="text-neutral-500 text-xs mt-0.5">
                {a.full_name} · {a.phone}
              </p>
              <p className="text-neutral-500 text-xs">
                {[a.neighborhood, a.city].filter(Boolean).join(", ")}
                {a.address ? ` — ${a.address}` : ""}
              </p>
            </div>
            <button
              onClick={() => handleDelete(a.id)}
              disabled={deletingId === a.id}
              className="text-xs text-red-700 hover:underline shrink-0 disabled:opacity-60"
            >
              {t.account.removeAddress}
            </button>
          </div>
        ))}
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="rounded-xl border border-neutral-200 bg-white p-5 flex flex-col gap-3 max-w-md mt-3">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t.account.labelPlaceholder}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t.account.recipientNamePlaceholder}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t.account.phonePlaceholder}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={t.account.cityPlaceholder}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <input
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              placeholder={t.account.neighborhoodPlaceholder}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t.account.addressPlaceholder}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-xs text-neutral-600">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            {t.account.makeDefault}
          </label>
          <div>
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className="text-xs rounded-full border border-neutral-300 px-3 py-1.5 hover:border-neutral-900 disabled:opacity-60 inline-flex items-center gap-1"
            >
              {locating ? (
                t.account.locating
              ) : (
                <>
                  <IconPin className="w-3 h-3" />
                  {latitude != null ? t.account.locationSet : t.account.useMyLocation}
                </>
              )}
            </button>
            {locationError && (
              <LocationProblem problem={locationError} onRetry={useMyLocation} retrying={locating} optional />
            )}
          </div>
          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="text-sm rounded-full bg-neutral-900 text-white px-5 py-2 disabled:opacity-60"
            >
              {submitting ? t.account.saving : t.account.saveAddress}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="text-sm rounded-full border border-neutral-300 px-5 py-2"
            >
              {t.account.cancel}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function MessagesSection({
  conversations,
  t,
}: {
  conversations: BuyerConversation[];
  t: ReturnType<typeof useLocale>["t"];
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold mb-3">{t.account.messagesTitle}</h2>
      {conversations.length === 0 ? (
        <p className="text-sm text-neutral-500">{t.account.noMessages}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {conversations.map((c) => (
            <div key={c.id} className="rounded-xl border border-neutral-200 bg-white p-4 text-sm flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium flex items-center gap-1.5 truncate">
                  <IconChat className="w-3.5 h-3.5 shrink-0 text-neutral-400" />
                  {c.shop?.shop_name ?? ""}
                  {c.buyer_unread_count > 0 && (
                    <span className="text-[10px] font-bold rounded-full bg-amber-500 text-neutral-900 w-[18px] h-[18px] flex items-center justify-center shrink-0">
                      {c.buyer_unread_count}
                    </span>
                  )}
                </p>
                {c.product?.title && <p className="text-neutral-500 text-xs truncate">{c.product.title}</p>}
                {c.last_message_preview && <p className="text-neutral-500 text-xs truncate mt-0.5">{c.last_message_preview}</p>}
              </div>
              {c.shop?.slug && (
                <Link href={`/shop/${c.shop.slug}`} className="text-amber-600 text-sm font-medium hover:underline shrink-0">
                  {t.account.openConversation} →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// Shops this buyer follows, with a one-tap unfollow.
function FollowedShopsSection({ t }: { t: ReturnType<typeof useLocale>["t"] }) {
  const [shops, setShops] = useState<FollowedShop[] | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyFollowedShops().then((rows) => {
      if (!cancelled) setShops(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function unfollow(shopId: string) {
    setRemovingId(shopId);
    try {
      await setFollowing(shopId, false);
      setShops((prev) => (prev ? prev.filter((s) => s.shop_id !== shopId) : prev));
    } finally {
      setRemovingId(null);
    }
  }

  if (shops === null) return null;

  return (
    <section>
      <h2 className="text-sm font-semibold mb-1">{t.account.followingTitle}</h2>
      <p className="text-xs text-neutral-500 mb-3">{t.account.followingHint}</p>
      {shops.length === 0 ? (
        <p className="text-sm text-neutral-500">{t.account.followingEmpty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
          {shops.map((s) => (
            <li key={s.shop_id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <Link href={`/shop/${s.shop?.slug ?? ""}`} className="font-medium hover:text-amber-700 truncate">
                {s.shop?.shop_name ?? "—"}
                {s.shop?.city && <span className="text-neutral-500 font-normal"> · {s.shop.city}</span>}
              </Link>
              <button
                type="button"
                onClick={() => unfollow(s.shop_id)}
                disabled={removingId === s.shop_id}
                className="shrink-0 text-xs rounded-full border border-neutral-300 px-3 py-1 hover:border-neutral-900 disabled:opacity-60"
              >
                {t.account.unfollow}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FavoritesSection({
  favorites,
  t,
  onRemoved,
}: {
  favorites: FavoriteProduct[];
  t: ReturnType<typeof useLocale>["t"];
  onRemoved: (productId: string) => void;
}) {
  const { refresh } = useFavoritesContext();
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleRemove(productId: string) {
    setRemovingId(productId);
    try {
      await toggleFavorite(productId, true);
      onRemoved(productId);
      refresh();
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section>
      <h2 className="text-sm font-semibold mb-3">{t.account.favoritesTitle}</h2>
      {favorites.length === 0 ? (
        <p className="text-sm text-neutral-500">{t.account.noFavorites}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {favorites.map((p) => (
            <div key={p.id} className="rounded-xl border border-neutral-200 bg-white overflow-hidden text-sm">
              <Link href={`/product/${p.id}`} className="block">
                <div className="relative aspect-square bg-neutral-100 flex items-center justify-center overflow-hidden">
                  {p.image_urls?.[0] ? (
                    <Image src={p.image_urls[0]} alt={p.title} fill sizes="200px" className="object-cover" />
                  ) : (
                    <IconBag className="w-8 h-8 text-neutral-300" />
                  )}
                </div>
                <div className="p-2.5">
                  <p className="font-medium line-clamp-1">{p.title}</p>
                  <p className="text-neutral-500 text-xs mt-0.5">
                    {p.shop?.shop_name}
                    {!p.is_active && ` · ${t.product.outOfStock}`}
                  </p>
                  <p className="font-semibold mt-0.5">{formatFcfa(p.sale_price_fcfa ?? p.price_fcfa)}</p>
                </div>
              </Link>
              <button
                onClick={() => handleRemove(p.id)}
                disabled={removingId === p.id}
                className="w-full flex items-center justify-center gap-1 text-xs text-neutral-500 hover:text-red-600 border-t border-neutral-100 py-1.5 disabled:opacity-60"
              >
                <IconHeart filled className="w-3 h-3 text-red-500" /> {t.product.favoriteRemove}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function LayawaySection({
  layawayOrders,
  t,
  onPaid,
}: {
  layawayOrders: LayawayOrder[];
  t: ReturnType<typeof useLocale>["t"];
  onPaid: (orderId: string) => void;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold mb-3">{t.account.layawayTitle}</h2>
      <div className="flex flex-col gap-3">
        {layawayOrders.map((o) => (
          <LayawayCard key={o.id} order={o} t={t} onPaid={() => onPaid(o.id)} />
        ))}
      </div>
    </section>
  );
}

function LayawayCard({
  order,
  t,
  onPaid,
}: {
  order: LayawayOrder;
  t: ReturnType<typeof useLocale>["t"];
  onPaid: () => void;
}) {
  const nextInstallment = order.installments.find((i) => i.status === "pending");
  const [paying, setPaying] = useState(false);
  const [provider, setProvider] = useState<"mtn" | "orange">("mtn");
  const [phone, setPhone] = useState(order.buyer_phone ?? "");
  const [status, setStatus] = useState<"idle" | "waiting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!nextInstallment) return;
    setStatus("waiting");
    setError(null);
    try {
      const startRes = await fetch(`/api/layaway/${order.id}/installment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, phone }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) {
        setError(startData.error ?? t.checkout.errorStart);
        setStatus("error");
        return;
      }
      const reference: string = startData.reference;
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts += 1;
        try {
          const checkRes = await fetch(`/api/layaway/${order.id}/installment?reference=${encodeURIComponent(reference)}`);
          const checkData = await checkRes.json();
          if (checkData.status === "complete") {
            clearInterval(poll);
            setStatus("done");
            onPaid();
          } else if (checkData.status === "failed" || checkData.status === "canceled") {
            clearInterval(poll);
            setError(t.checkout.errorNotApproved);
            setStatus("error");
          }
        } catch {
          // transient network hiccup while polling — keep trying until timeout
        }
        if (attempts >= 20) {
          clearInterval(poll);
          setError(t.checkout.errorTimeout);
          setStatus("error");
        }
      }, 3000);
    } catch {
      setError(t.checkout.errorUnreachable);
      setStatus("error");
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{order.shop?.shop_name ?? ""}</p>
          <p className="text-neutral-500 text-xs">{formatFcfa(order.total_amount_fcfa)}</p>
        </div>
        <Link href={`/order/${order.id}`} className="text-amber-600 text-xs font-medium hover:underline shrink-0">
          {t.account.viewOrder} →
        </Link>
      </div>

      <div className="mt-3 flex flex-col gap-1">
        {order.installments.map((inst) => (
          <div key={inst.id} className="flex items-center justify-between text-xs">
            <span className="text-neutral-500">
              {t.account.layawayInstallmentLabel.replace("{n}", String(inst.installment_number))}
            </span>
            <span className={inst.status === "paid" ? "text-green-700 font-medium" : "text-neutral-500"}>
              {formatFcfa(inst.amount_fcfa)} — {inst.status === "paid" ? t.account.layawayPaid : t.account.layawayDue}
            </span>
          </div>
        ))}
      </div>

      {nextInstallment && status !== "done" && (
        <>
          {!paying ? (
            <button
              onClick={() => setPaying(true)}
              className="mt-3 text-xs rounded-full bg-neutral-900 text-white px-4 py-1.5 hover:bg-neutral-700"
            >
              {t.account.layawayPayNext.replace("{amount}", formatFcfa(nextInstallment.amount_fcfa))}
            </button>
          ) : (
            <form onSubmit={handlePay} className="mt-3 flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setProvider("mtn")}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                    provider === "mtn" ? "border-amber-500 bg-amber-50" : "border-neutral-300"
                  }`}
                >
                  {t.checkout.mtn}
                </button>
                <button
                  type="button"
                  onClick={() => setProvider("orange")}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                    provider === "orange" ? "border-amber-500 bg-amber-50" : "border-neutral-300"
                  }`}
                >
                  {t.checkout.orange}
                </button>
              </div>
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t.checkout.phonePlaceholder}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
              {error && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={status === "waiting"}
                  className="text-xs rounded-full bg-neutral-900 text-white px-4 py-1.5 disabled:opacity-60"
                >
                  {status === "waiting"
                    ? t.checkout.checkingPhone
                    : `${t.checkout.payButton} ${formatFcfa(nextInstallment.amount_fcfa)}`}
                </button>
                <button
                  type="button"
                  onClick={() => setPaying(false)}
                  disabled={status === "waiting"}
                  className="text-xs rounded-full border border-neutral-300 px-4 py-1.5"
                >
                  {t.account.cancel}
                </button>
              </div>
            </form>
          )}
        </>
      )}
      {status === "done" && (
        <p className="mt-3 text-xs text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          {t.account.layawayFullyPaid}
        </p>
      )}
    </div>
  );
}

function OrdersSection({ orders, t }: { orders: BuyerOrder[]; t: ReturnType<typeof useLocale>["t"] }) {
  return (
    <section>
      <h2 className="text-sm font-semibold mb-3">{t.account.ordersTitle}</h2>
      {orders.length === 0 ? (
        <p className="text-sm text-neutral-500">{t.account.noOrders}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((o) => (
            <div key={o.id} className="rounded-xl border border-neutral-200 bg-white p-4 text-sm flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{o.shop?.shop_name ?? ""}</p>
                <p className="text-neutral-500 text-xs">
                  {new Date(o.created_at).toLocaleDateString()} · {formatFcfa(o.total_amount_fcfa)}
                </p>
                <p className="text-xs text-neutral-500">{t.dashboard.statusLabels[o.status] ?? o.status}</p>
              </div>
              <Link href={`/order/${o.id}`} className="text-amber-600 text-sm font-medium hover:underline shrink-0">
                {t.account.viewOrder} →
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
