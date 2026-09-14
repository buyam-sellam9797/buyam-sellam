"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  supabase,
  getMyProfile,
  updateBuyerProfile,
  getMyBuyerOrders,
  getMyAddresses,
  createAddress,
  deleteAddress,
  getMyShop,
  type BuyerProfile,
  type BuyerOrder,
  type BuyerAddress,
} from "@/lib/supabase";
import { formatFcfa } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";

export default function AccountPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<BuyerProfile | null>(null);
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [addresses, setAddresses] = useState<BuyerAddress[]>([]);
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
    const [myProfile, myOrders, myAddresses, myShop] = await Promise.all([
      getMyProfile(),
      getMyBuyerOrders(),
      getMyAddresses(),
      getMyShop(),
    ]);
    setProfile(myProfile);
    setOrders(myOrders);
    setAddresses(myAddresses);
    setHasShop(!!myShop);
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
        <h1 className="text-2xl font-bold">{t.account.title}</h1>
        <button
          onClick={handleLogout}
          className="text-sm rounded-full border border-neutral-300 px-4 py-1.5 hover:border-neutral-900"
        >
          {t.account.logout}
        </button>
      </div>

      {hasShop && (
        <Link
          href="/dashboard"
          className="text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 hover:bg-amber-100 self-start"
        >
          {t.account.goToSellerDashboard}
        </Link>
      )}

      <ProfileSection profile={profile} t={t} onSaved={(p) => setProfile((prev) => (prev ? { ...prev, ...p } : prev))} />

      <AddressesSection
        addresses={addresses}
        t={t}
        onChanged={async () => setAddresses(await getMyAddresses())}
      />

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

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocationError(t.account.locationUnsupported);
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setLocating(false);
      },
      () => {
        setLocationError(t.account.locationDenied);
        setLocating(false);
      },
      { timeout: 10000 }
    );
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
              className="text-xs rounded-full border border-neutral-300 px-3 py-1.5 hover:border-neutral-900 disabled:opacity-60"
            >
              {locating
                ? t.account.locating
                : latitude != null
                  ? t.account.locationSet
                  : t.account.useMyLocation}
            </button>
            {locationError && <p className="text-xs text-red-600 mt-1">{locationError}</p>}
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
