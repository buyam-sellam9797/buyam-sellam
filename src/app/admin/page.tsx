"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatFcfa } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";

type PayoutOrder = {
  id: string;
  total_amount_fcfa: number;
  buyer_phone: string | null;
  created_at: string;
  shop?: { shop_name: string; whatsapp_number: string | null } | null;
};

// A minimal admin view: every completed order that hasn't been paid
// out to its seller yet, with a one-tap "mark paid" once Lio has
// actually sent the money by hand. Access is enforced server-side in
// /api/admin/payouts (profiles.role = 'admin'), not just by this page
// being unlinked from the nav.
export default function AdminPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<PayoutOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }
    const res = await fetch("/api/admin/payouts", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? t.admin.notAuthorized);
      setLoading(false);
      return;
    }
    setOrders(data.orders);
    setLoading(false);
    // t is stable per render and not needed as a dep beyond this call
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleMarkPaid(orderId: string) {
    setMarkingId(orderId);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    await fetch("/api/admin/payouts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ orderId }),
    });
    setMarkingId(null);
    load();
  }

  if (loading) {
    return <div className="mx-auto max-w-4xl px-4 py-16 text-center text-neutral-500">{t.admin.loading}</div>;
  }

  if (error) {
    return <div className="mx-auto max-w-4xl px-4 py-16 text-center text-neutral-500">{error}</div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">{t.admin.title}</h1>

      {!orders || orders.length === 0 ? (
        <p className="text-sm text-neutral-500 rounded-xl border border-dashed border-neutral-300 p-8 text-center">
          {t.admin.noneOwed}
        </p>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100">
          {orders.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="flex-1 min-w-[10rem]">
                <p className="text-sm font-medium">{o.shop?.shop_name}</p>
                <p className="text-xs text-neutral-500">
                  {o.shop?.whatsapp_number ?? o.buyer_phone ?? ""} ·{" "}
                  {new Date(o.created_at).toLocaleDateString()}
                </p>
              </div>
              <p className="text-sm font-semibold whitespace-nowrap">{formatFcfa(o.total_amount_fcfa)}</p>
              <button
                onClick={() => handleMarkPaid(o.id)}
                disabled={markingId === o.id}
                className="text-xs rounded-full bg-neutral-900 text-white px-4 py-1.5 disabled:opacity-60"
              >
                {markingId === o.id ? t.admin.marking : t.admin.markPaid}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
