"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, updateShop, type Order, type Product, type Shop } from "@/lib/supabase";
import { calculateCommission } from "@/lib/commission";
import { formatFcfa } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import { IconBanknote, IconEye, IconBox, IconChat, IconTrendingUp, IconTrendingDown, IconAlertTriangle, IconCart } from "@/components/dash-icons";

type Range = 7 | 30 | 90;
const DAY = 86400_000;
const COUNTED = new Set(["paid_held", "shipped", "completed", "disputed"]);

// Local calendar day key (YYYY-MM-DD) without time-zone surprises.
function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// The top of the seller's overview: what the shop actually earned
// (after Buyam Sellam's 5%) over the last 7, 30 or 90 days compared
// with the period before, a small day-by-day chart, and the numbers
// that explain it — views, items sold, how many views became orders,
// live listings and unread messages. When no payout number is set, a
// warning with the form to fix it comes first: buyers can pay, but the
// money can't be released without it.
export function MoneyPulse({
  shop,
  orders,
  products,
  t,
  onShopUpdated,
  onOpenMessages,
}: {
  shop: Shop;
  orders: Order[];
  products: Product[];
  t: Dictionary;
  onShopUpdated: (patch: Partial<Shop>) => void;
  onOpenMessages: () => void;
}) {
  const [range, setRange] = useState<Range>(30);
  const [now, setNow] = useState(0);
  const [views, setViews] = useState<Map<string, number>>(new Map());
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const since = dayKey(new Date(Date.now() - 181 * DAY));
      const [{ data: viewRows }, { data: convRows }] = await Promise.all([
        supabase.from("product_view_days").select("day, views").eq("shop_id", shop.id).gte("day", since).limit(20000),
        supabase.from("conversations").select("seller_unread_count").eq("shop_id", shop.id),
      ]);
      if (cancelled) return;
      const map = new Map<string, number>();
      for (const r of (viewRows ?? []) as { day: string; views: number }[]) map.set(r.day, (map.get(r.day) ?? 0) + r.views);
      setViews(map);
      setUnread(((convRows ?? []) as { seller_unread_count: number }[]).reduce((s, c) => s + (c.seller_unread_count ?? 0), 0));
      setNow(Date.now());
    })();
    return () => {
      cancelled = true;
    };
  }, [shop.id]);

  const stats = useMemo(() => {
    const end = now || 0;
    const start = end - range * DAY;
    const prevStart = start - range * DAY;
    const inWindow = (iso: string | null, a: number, b: number) => {
      if (!iso) return false;
      const ts = new Date(iso).getTime();
      return ts > a && ts <= b;
    };
    const paid = orders.filter((o) => COUNTED.has(o.status) && o.paid_at);
    const cur = paid.filter((o) => inWindow(o.paid_at, start, end));
    const prev = paid.filter((o) => inWindow(o.paid_at, prevStart, start));
    const net = (list: Order[]) => list.reduce((s, o) => s + calculateCommission(o.total_amount_fcfa).sellerPayoutFcfa, 0);
    const units = (list: Order[]) => list.reduce((s, o) => s + (o.items ?? []).reduce((n, i) => n + i.quantity, 0), 0);
    const viewsBetween = (a: number, b: number) => {
      let total = 0;
      for (let ts = a + DAY; ts <= b + 1; ts += DAY) total += views.get(dayKey(new Date(ts))) ?? 0;
      return total;
    };

    // Chart buckets: one per day for 7/30 days, one per week for 90.
    const bucketDays = range === 90 ? 7 : 1;
    const bucketCount = Math.ceil(range / bucketDays);
    const buckets = Array.from({ length: bucketCount }, (_, i) => {
      const bEnd = end - (bucketCount - 1 - i) * bucketDays * DAY;
      const bStart = bEnd - bucketDays * DAY;
      return { amount: net(cur.filter((o) => inWindow(o.paid_at, bStart, bEnd))), label: new Date(bEnd - DAY / 2) };
    });

    return {
      net: net(cur),
      netPrev: net(prev),
      orders: cur.length,
      units: units(cur),
      unitsPrev: units(prev),
      views: viewsBetween(start, end),
      viewsPrev: viewsBetween(prevStart, start),
      buckets,
    };
  }, [orders, views, range, now]);

  const active = products.filter((p) => p.is_active && p.stock_quantity > 0).length;
  const conversion = stats.views > 0 ? (stats.orders / stats.views) * 100 : null;
  const max = Math.max(1, ...stats.buckets.map((b) => b.amount));

  function delta(cur: number, prev: number) {
    if (prev === 0) return cur > 0 ? { text: t.money.newThisPeriod, up: true } : null;
    const pct = Math.round(((cur - prev) / prev) * 100);
    return { text: `${pct > 0 ? "+" : ""}${pct}% ${t.money.vsPrevious}`, up: pct >= 0 };
  }
  const netDelta = delta(stats.net, stats.netPrev);

  return (
    <div className="flex flex-col gap-4 mb-6">
      {(!shop.payout_phone_number || !shop.payout_provider) && <PayoutWarning shop={shop} t={t} onSaved={onShopUpdated} />}

      <div className="dash-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--dash-muted)" }}>
              {t.money.earnedTitle.replace("{days}", String(range))}
            </p>
            <p className="text-3xl font-bold mt-1">{formatFcfa(stats.net)}</p>
            {netDelta ? (
              <p className="text-xs mt-1 inline-flex items-center gap-1" style={{ color: netDelta.up ? "var(--dash-success)" : "var(--dash-danger)" }}>
                {netDelta.up ? <IconTrendingUp className="w-3.5 h-3.5" /> : <IconTrendingDown className="w-3.5 h-3.5" />}
                {netDelta.text}
              </p>
            ) : (
              <p className="text-xs mt-1" style={{ color: "var(--dash-muted)" }}>{t.money.noSalesYet}</p>
            )}
            <p className="text-[11px] mt-1" style={{ color: "var(--dash-muted)" }}>{t.money.afterFee}</p>
          </div>
          <div className="inline-flex rounded-full p-0.5" style={{ background: "var(--dash-bg-2)" }}>
            {([7, 30, 90] as Range[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className="px-3 py-1 rounded-full text-xs font-semibold"
                style={range === r ? { background: "white", boxShadow: "0 1px 2px rgba(0,0,0,.08)" } : { color: "var(--dash-muted)" }}
              >
                {t.money.rangeDays.replace("{days}", String(r))}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-end gap-[3px] h-20" aria-hidden="true">
          {stats.buckets.map((b, i) => (
            <div
              key={i}
              className="flex-1 rounded-t"
              style={{
                height: `${Math.max(4, Math.round((b.amount / max) * 100))}%`,
                background: b.amount > 0 ? "var(--dash-gold)" : "var(--dash-bg-2)",
              }}
              title={`${b.label.toLocaleDateString()} — ${formatFcfa(b.amount)}`}
            />
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Tile icon={<IconEye className="w-4 h-4" />} label={t.money.views} value={String(stats.views)} sub={delta(stats.views, stats.viewsPrev)?.text} />
          <Tile icon={<IconCart className="w-4 h-4" />} label={t.money.itemsSold} value={String(stats.units)} sub={delta(stats.units, stats.unitsPrev)?.text} />
          <Tile
            icon={<IconBanknote className="w-4 h-4" />}
            label={t.money.conversion}
            value={conversion == null ? "—" : `${conversion < 10 ? conversion.toFixed(1) : Math.round(conversion)}%`}
            sub={t.money.conversionHint}
          />
          <Tile icon={<IconBox className="w-4 h-4" />} label={t.money.activeListings} value={String(active)} />
          <button type="button" onClick={onOpenMessages} className="text-left">
            <Tile icon={<IconChat className="w-4 h-4" />} label={t.money.unreadMessages} value={String(unread)} highlight={unread > 0} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Tile({ icon, label, value, sub, highlight }: { icon: React.ReactNode; label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl px-3 py-2.5 h-full" style={{ background: highlight ? "rgba(245, 158, 11, 0.14)" : "var(--dash-bg-2)" }}>
      <p className="text-[11px] font-semibold flex items-center gap-1" style={{ color: "var(--dash-muted)" }}>
        {icon}
        {label}
      </p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
      {sub && <p className="text-[10px] leading-tight" style={{ color: "var(--dash-muted)" }}>{sub}</p>}
    </div>
  );
}

function PayoutWarning({ shop, t, onSaved }: { shop: Shop; t: Dictionary; onSaved: (patch: Partial<Shop>) => void }) {
  const [provider, setProvider] = useState<"mtn" | "orange" | "">(shop.payout_provider ?? "");
  const [phone, setPhone] = useState(shop.payout_phone_number ?? shop.whatsapp_number ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!provider || phone.replace(/\D/g, "").length < 8) {
      setError(t.money.payoutIncomplete);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateShop(shop.id, { payoutProvider: provider, payoutPhoneNumber: phone.trim() });
      onSaved({ payout_provider: provider, payout_phone_number: phone.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.money.payoutIncomplete);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={save}
      className="rounded-2xl p-5 border-2"
      style={{ borderColor: "var(--dash-danger)", background: "var(--dash-danger-wash)" }}
    >
      <p className="text-sm font-bold flex items-center gap-1.5" style={{ color: "var(--dash-danger)" }}>
        <IconAlertTriangle className="w-4 h-4" /> {t.money.payoutTitle}
      </p>
      <p className="text-sm mt-1">{t.money.payoutBody}</p>
      <div className="mt-3 grid sm:grid-cols-[180px_1fr_auto] gap-2">
        <select value={provider} onChange={(e) => setProvider(e.target.value as "mtn" | "orange" | "")} className="dash-input" aria-label={t.dashboard.payoutProviderLabel}>
          <option value="">{t.dashboard.payoutProviderPlaceholder}</option>
          <option value="mtn">MTN Mobile Money</option>
          <option value="orange">Orange Money</option>
        </select>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+237 6XX XXX XXX" className="dash-input" aria-label={t.dashboard.payoutPhoneLabel} />
        <button type="submit" disabled={saving} className="dash-btn justify-center">
          {saving ? t.dashboard.saving : t.money.payoutSave}
        </button>
      </div>
      {error && <p className="text-xs mt-2" style={{ color: "var(--dash-danger)" }}>{error}</p>}
    </form>
  );
}
