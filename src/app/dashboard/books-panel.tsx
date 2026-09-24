"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, type Order, type Product, type Shop } from "@/lib/supabase";
import { calculateCommission } from "@/lib/commission";
import { formatFcfa } from "@/lib/format";
import type { Dictionary, Locale } from "@/lib/i18n";
import { IconBook, IconPrinter, IconCart, IconBox, IconBanknote, IconTrendingUp, IconTrendingDown } from "@/components/dash-icons";

// Shop books: a simple money notebook for sellers who also sell in a
// physical shop or at the market. Walk-in sales take stock off the
// shelf, new stock adds it back (with its cost), expenses are logged in
// a tap, and every month gets a plain report — money in, money out,
// what the shop kept — that can be printed or exported for an
// accountant. Online orders from Buyam Sellam are included
// automatically (after the 5% fee).

export const EXPENSE_CATEGORIES = ["stock", "transport", "rent", "staff", "marketing", "phone_internet", "packaging", "fees", "other"] as const;
type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

type Sale = { id: string; product_id: string | null; title: string; quantity: number; unit_price_fcfa: number; payment_method: "cash" | "momo" | "other"; sold_on: string; note: string | null; created_at: string };
type Expense = { id: string; spent_on: string; category: ExpenseCategory; amount_fcfa: number; note: string | null; created_at: string };
type Movement = { id: string; product_id: string; change: number; reason: string; unit_cost_fcfa: number | null; note: string | null; created_at: string };

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const monthOf = (iso: string) => iso.slice(0, 7);
const localMonth = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

function monthLabel(key: string, locale: Locale) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", { month: "long", year: "numeric" });
}

function problemText(t: Dictionary, message: string) {
  const known = t.books.errors as Record<string, string>;
  const code = Object.keys(known).find((k) => message.includes(k));
  return code ? known[code] : t.books.errors.generic;
}

export function BooksPanel({
  shop,
  products,
  orders,
  t,
  locale,
  onStockChanged,
}: {
  shop: Shop;
  products: Product[];
  orders: Order[];
  t: Dictionary;
  locale: Locale;
  onStockChanged: () => void;
}) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [costs, setCosts] = useState<Map<string, number>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState<null | "sale" | "restock" | "expense">(null);
  const [month, setMonth] = useState(() => today().slice(0, 7));

  const load = useCallback(async () => {
    const since = new Date();
    since.setMonth(since.getMonth() - 13);
    const sinceDay = since.toISOString().slice(0, 10);
    const [s, e, m, c] = await Promise.all([
      supabase.from("offline_sales").select("*").eq("shop_id", shop.id).gte("sold_on", sinceDay).order("sold_on", { ascending: false }).order("created_at", { ascending: false }).limit(2000),
      supabase.from("shop_expenses").select("*").eq("shop_id", shop.id).gte("spent_on", sinceDay).order("spent_on", { ascending: false }).order("created_at", { ascending: false }).limit(2000),
      supabase.from("stock_movements").select("*").eq("shop_id", shop.id).eq("reason", "restock").order("created_at", { ascending: false }).limit(30),
      supabase.from("product_costs").select("product_id, unit_cost_fcfa").eq("shop_id", shop.id),
    ]);
    setSales((s.data ?? []) as Sale[]);
    setExpenses((e.data ?? []) as Expense[]);
    setMovements((m.data ?? []) as Movement[]);
    setCosts(new Map(((c.data ?? []) as { product_id: string; unit_cost_fcfa: number }[]).map((r) => [r.product_id, r.unit_cost_fcfa])));
    setLoaded(true);
  }, [shop.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const productTitle = useCallback((id: string | null) => products.find((p) => p.id === id)?.title ?? "—", [products]);

  // ---- Monthly figures -------------------------------------------------
  const report = useMemo(() => {
    const paid = orders.filter((o) => o.paid_at && ["paid_held", "shipped", "completed", "disputed"].includes(o.status));
    const build = (key: string) => {
      const online = paid.filter((o) => localMonth(o.paid_at as string) === key);
      const onlineGross = online.reduce((s, o) => s + o.total_amount_fcfa, 0);
      const onlineNet = online.reduce((s, o) => s + calculateCommission(o.total_amount_fcfa).sellerPayoutFcfa, 0);
      const shopSales = sales.filter((x) => monthOf(x.sold_on) === key);
      const shopTotal = shopSales.reduce((s, x) => s + x.quantity * x.unit_price_fcfa, 0);
      const monthExpenses = expenses.filter((x) => monthOf(x.spent_on) === key);
      const byCategory = new Map<ExpenseCategory, number>();
      for (const x of monthExpenses) byCategory.set(x.category, (byCategory.get(x.category) ?? 0) + x.amount_fcfa);
      const spent = monthExpenses.reduce((s, x) => s + x.amount_fcfa, 0);

      // Best sellers across both channels, by money brought in.
      const top = new Map<string, { title: string; units: number; amount: number }>();
      for (const o of online) {
        for (const i of o.items ?? []) {
          const k = i.product?.id ?? i.product?.title ?? "?";
          const row = top.get(k) ?? { title: i.product?.title ?? "—", units: 0, amount: 0 };
          row.units += i.quantity;
          row.amount += i.quantity * i.unit_price_fcfa;
          top.set(k, row);
        }
      }
      for (const x of shopSales) {
        const k = x.product_id ?? `free:${x.title}`;
        const row = top.get(k) ?? { title: x.title, units: 0, amount: 0 };
        row.units += x.quantity;
        row.amount += x.quantity * x.unit_price_fcfa;
        top.set(k, row);
      }
      const moneyIn = onlineNet + shopTotal;
      return {
        onlineCount: online.length,
        onlineGross,
        onlineFee: onlineGross - onlineNet,
        onlineNet,
        shopCount: shopSales.length,
        shopTotal,
        moneyIn,
        spent,
        kept: moneyIn - spent,
        byCategory: [...byCategory.entries()].sort((a, b) => b[1] - a[1]),
        top: [...top.values()].sort((a, b) => b.amount - a.amount).slice(0, 5),
        shopSales,
        monthExpenses,
        online,
      };
    };
    const [y, m] = month.split("-").map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
    return { cur: build(month), prev: build(prevKey), prevKey };
  }, [orders, sales, expenses, month]);

  const months = useMemo(() => {
    const list: string[] = [];
    const d = new Date();
    d.setDate(1);
    for (let i = 0; i < 12; i++) {
      list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      d.setMonth(d.getMonth() - 1);
    }
    return list;
  }, []);

  // ---- Stock value -----------------------------------------------------
  const stock = useMemo(() => {
    const rows = products
      .filter((p) => p.is_active || p.stock_quantity > 0)
      .map((p) => {
        const price = p.sale_price_fcfa ?? p.price_fcfa;
        const cost = costs.get(p.id) ?? null;
        return { p, price, cost, margin: cost != null && price > 0 ? Math.round(((price - cost) / price) * 100) : null };
      });
    const atPrice = rows.reduce((s, r) => s + r.price * r.p.stock_quantity, 0);
    const atCost = rows.reduce((s, r) => s + (r.cost ?? 0) * r.p.stock_quantity, 0);
    const missingCost = rows.filter((r) => r.cost == null && r.p.stock_quantity > 0).length;
    return { rows, atPrice, atCost, missingCost };
  }, [products, costs]);

  async function saveCost(productId: string, value: string) {
    const n = value.trim() === "" ? null : Math.round(Number(value));
    if (n != null && (!Number.isFinite(n) || n < 0)) return;
    if (n == null) {
      await supabase.from("product_costs").delete().eq("product_id", productId);
    } else {
      await supabase.from("product_costs").upsert({ product_id: productId, shop_id: shop.id, unit_cost_fcfa: n, updated_at: new Date().toISOString() }, { onConflict: "product_id" });
    }
    setCosts((prev) => {
      const next = new Map(prev);
      if (n == null) next.delete(productId);
      else next.set(productId, n);
      return next;
    });
  }

  function exportCsv() {
    const r = report.cur;
    const rows: string[][] = [[t.books.csvDate, t.books.csvType, t.books.csvDescription, t.books.csvQuantity, t.books.csvAmount]];
    for (const o of r.online) {
      rows.push([
        (o.paid_at ?? o.created_at).slice(0, 10),
        t.books.csvOnline,
        (o.items ?? []).map((i) => `${i.quantity} x ${i.product?.title ?? ""}`).join("; ") || `#${o.id.slice(0, 8)}`,
        String((o.items ?? []).reduce((n, i) => n + i.quantity, 0)),
        String(calculateCommission(o.total_amount_fcfa).sellerPayoutFcfa),
      ]);
    }
    for (const s of r.shopSales) rows.push([s.sold_on, t.books.csvShopSale, s.title, String(s.quantity), String(s.quantity * s.unit_price_fcfa)]);
    for (const e of r.monthExpenses) rows.push([e.spent_on, t.books.csvExpense, `${t.books.categories[e.category]}${e.note ? ` — ${e.note}` : ""}`, "", String(-e.amount_fcfa)]);
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `buyam-sellam-${shop.slug}-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const cur = report.cur;
  const prev = report.prev;
  const keptChange = prev.kept !== 0 ? Math.round(((cur.kept - prev.kept) / Math.abs(prev.kept)) * 100) : null;
  const summary = (cur.moneyIn === 0 && cur.spent === 0
    ? t.books.summaryEmpty
    : t.books.summary
        .replace("{month}", monthLabel(month, locale))
        .replace("{in}", formatFcfa(cur.moneyIn))
        .replace("{out}", formatFcfa(cur.spent))
        .replace("{kept}", formatFcfa(cur.kept))
  ) + (keptChange != null && cur.moneyIn + cur.spent > 0
    ? " " + (keptChange >= 0 ? t.books.summaryUp : t.books.summaryDown).replace("{pct}", String(Math.abs(keptChange))).replace("{prev}", monthLabel(report.prevKey, locale))
    : "");

  const recent = useMemo(() => {
    type Row = { key: string; date: string; kind: "sale" | "expense" | "restock"; label: string; amount: number | null; id: string };
    const rows: Row[] = [
      ...sales.slice(0, 30).map((s) => ({ key: `s${s.id}`, id: s.id, date: s.created_at, kind: "sale" as const, label: `${s.quantity} × ${s.title} · ${t.books.methods[s.payment_method]}`, amount: s.quantity * s.unit_price_fcfa })),
      ...expenses.slice(0, 30).map((e) => ({ key: `e${e.id}`, id: e.id, date: e.created_at, kind: "expense" as const, label: `${t.books.categories[e.category]}${e.note ? ` — ${e.note}` : ""}`, amount: -e.amount_fcfa })),
      ...movements.map((m) => ({ key: `m${m.id}`, id: m.id, date: m.created_at, kind: "restock" as const, label: `+${m.change} ${productTitle(m.product_id)}${m.unit_cost_fcfa != null ? ` · ${formatFcfa(m.unit_cost_fcfa)}/u` : ""}`, amount: null })),
    ];
    return rows.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
  }, [sales, expenses, movements, t, productTitle]);

  async function removeEntry(kind: "sale" | "expense", id: string) {
    if (!window.confirm(t.books.confirmDelete)) return;
    if (kind === "sale") {
      await supabase.rpc("books_delete_sale", { p_sale: id });
      onStockChanged();
    } else {
      await supabase.from("shop_expenses").delete().eq("id", id);
    }
    await load();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="dash-hero p-5 no-print">
        <p className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5" style={{ color: "var(--dash-muted)" }}>
          <IconBook className="w-4 h-4" /> {t.books.title}
        </p>
        <p className="text-sm mt-1 max-w-2xl">{t.books.intro}</p>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button type="button" onClick={() => setForm(form === "sale" ? null : "sale")} className={form === "sale" ? "dash-btn justify-center" : "dash-btn-outline justify-center"}>
            <IconCart className="w-4 h-4" /> {t.books.actionSale}
          </button>
          <button type="button" onClick={() => setForm(form === "restock" ? null : "restock")} className={form === "restock" ? "dash-btn justify-center" : "dash-btn-outline justify-center"}>
            <IconBox className="w-4 h-4" /> {t.books.actionRestock}
          </button>
          <button type="button" onClick={() => setForm(form === "expense" ? null : "expense")} className={form === "expense" ? "dash-btn justify-center" : "dash-btn-outline justify-center"}>
            <IconBanknote className="w-4 h-4" /> {t.books.actionExpense}
          </button>
        </div>
        {form === "sale" && <SaleForm shop={shop} products={products} t={t} onDone={async () => { setForm(null); await load(); onStockChanged(); }} />}
        {form === "restock" && <RestockForm products={products} costs={costs} t={t} onDone={async () => { setForm(null); await load(); onStockChanged(); }} />}
        {form === "expense" && <ExpenseForm shop={shop} t={t} onDone={async () => { setForm(null); await load(); }} />}
      </div>

      {/* Monthly report */}
      <div className="dash-card p-5 print-area">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--dash-muted)" }}>{t.books.reportTitle}</p>
            <p className="text-lg font-bold capitalize">{shop.shop_name} — {monthLabel(month, locale)}</p>
          </div>
          <div className="flex items-center gap-2 no-print">
            <select value={month} onChange={(e) => setMonth(e.target.value)} className="dash-input !w-auto capitalize">
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m, locale)}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => window.print()} className="dash-btn-outline" title={t.books.print}>
              <IconPrinter className="w-4 h-4" /> <span className="hidden sm:inline">{t.books.print}</span>
            </button>
            <button type="button" onClick={exportCsv} className="dash-btn-outline">
              CSV
            </button>
          </div>
        </div>

        <p className="mt-3 text-sm leading-relaxed rounded-xl px-4 py-3" style={{ background: "var(--dash-bg-2)" }}>
          {loaded ? summary : t.dashboard.loading}
        </p>

        <div className="mt-4 grid sm:grid-cols-3 gap-3">
          <Figure label={t.books.moneyIn} value={cur.moneyIn} prev={prev.moneyIn} t={t} />
          <Figure label={t.books.moneyOut} value={cur.spent} prev={prev.spent} t={t} invert />
          <Figure label={t.books.kept} value={cur.kept} prev={prev.kept} t={t} strong />
        </div>

        <div className="mt-5 grid md:grid-cols-2 gap-5">
          <div>
            <p className="text-sm font-semibold mb-2">{t.books.inTitle}</p>
            <Line label={t.books.onlineSales.replace("{n}", String(cur.onlineCount))} value={formatFcfa(cur.onlineGross)} />
            <Line label={t.books.onlineFee} value={`− ${formatFcfa(cur.onlineFee)}`} muted />
            <Line label={t.books.shopSales.replace("{n}", String(cur.shopCount))} value={formatFcfa(cur.shopTotal)} />
            <Line label={t.books.moneyIn} value={formatFcfa(cur.moneyIn)} strong />
          </div>
          <div>
            <p className="text-sm font-semibold mb-2">{t.books.outTitle}</p>
            {cur.byCategory.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--dash-muted)" }}>{t.books.noExpenses}</p>
            ) : (
              cur.byCategory.map(([cat, amount]) => (
                <div key={cat} className="mb-1.5">
                  <div className="flex justify-between text-sm">
                    <span>{t.books.categories[cat]}</span>
                    <span>{formatFcfa(amount)}</span>
                  </div>
                  <div className="h-1.5 rounded-full mt-1" style={{ background: "var(--dash-bg-2)" }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.round((amount / Math.max(1, cur.spent)) * 100)}%`, background: "var(--dash-ink)" }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {cur.top.length > 0 && (
          <div className="mt-5">
            <p className="text-sm font-semibold mb-2">{t.books.topTitle}</p>
            <ol className="text-sm flex flex-col gap-1">
              {cur.top.map((row, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="truncate">
                    {i + 1}. {row.title} <span style={{ color: "var(--dash-muted)" }}>× {row.units}</span>
                  </span>
                  <span className="shrink-0">{formatFcfa(row.amount)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        <p className="mt-5 text-[11px]" style={{ color: "var(--dash-muted)" }}>{t.books.reportFootnote}</p>
      </div>

      {/* Stock and its value */}
      <div className="dash-card p-5 no-print">
        <p className="text-sm font-semibold">{t.books.stockTitle}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--dash-muted)" }}>{t.books.stockHint}</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl px-3 py-2.5" style={{ background: "var(--dash-bg-2)" }}>
            <p className="text-[11px] font-semibold" style={{ color: "var(--dash-muted)" }}>{t.books.valueAtPrice}</p>
            <p className="text-lg font-bold">{formatFcfa(stock.atPrice)}</p>
          </div>
          <div className="rounded-xl px-3 py-2.5" style={{ background: "var(--dash-bg-2)" }}>
            <p className="text-[11px] font-semibold" style={{ color: "var(--dash-muted)" }}>{t.books.valueAtCost}</p>
            <p className="text-lg font-bold">{formatFcfa(stock.atCost)}</p>
            {stock.missingCost > 0 && <p className="text-[10px]" style={{ color: "var(--dash-gold-ink)" }}>{t.books.missingCost.replace("{n}", String(stock.missingCost))}</p>}
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="text-left text-xs" style={{ color: "var(--dash-muted)" }}>
                <th className="py-2 font-semibold">{t.books.colItem}</th>
                <th className="py-2 font-semibold text-right">{t.books.colStock}</th>
                <th className="py-2 font-semibold text-right">{t.books.colCost}</th>
                <th className="py-2 font-semibold text-right">{t.books.colPrice}</th>
                <th className="py-2 font-semibold text-right">{t.books.colMargin}</th>
              </tr>
            </thead>
            <tbody>
              {stock.rows.map(({ p, price, cost, margin }) => (
                <tr key={p.id} className="border-t" style={{ borderColor: "var(--dash-border)" }}>
                  <td className="py-2 pr-2 max-w-[220px] truncate">{p.title}</td>
                  <td className="py-2 text-right" style={{ color: p.stock_quantity <= 3 ? "var(--dash-danger)" : undefined }}>{p.stock_quantity}</td>
                  <td className="py-2 text-right">
                    <input
                      key={`${p.id}-${cost ?? ""}`}
                      defaultValue={cost ?? ""}
                      inputMode="numeric"
                      placeholder="—"
                      onBlur={(e) => {
                        if (e.target.value !== String(cost ?? "")) saveCost(p.id, e.target.value);
                      }}
                      className="dash-input !w-24 !py-1 text-right"
                      aria-label={`${t.books.colCost} — ${p.title}`}
                    />
                  </td>
                  <td className="py-2 text-right">{formatFcfa(price)}</td>
                  <td className="py-2 text-right" style={{ color: margin != null && margin < 10 ? "var(--dash-danger)" : undefined }}>
                    {margin == null ? "—" : `${margin}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent entries */}
      <div className="dash-card p-5 no-print">
        <p className="text-sm font-semibold mb-2">{t.books.recentTitle}</p>
        {recent.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--dash-muted)" }}>{t.books.recentEmpty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--dash-border)]">
            {recent.map((r) => (
              <li key={r.key} className="py-2 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wide mr-2" style={{ color: r.kind === "expense" ? "var(--dash-danger)" : r.kind === "sale" ? "var(--dash-success)" : "var(--dash-muted)" }}>
                    {t.books.kinds[r.kind]}
                  </span>
                  <span className="truncate">{r.label}</span>
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  {r.amount != null && <span className="font-semibold">{r.amount < 0 ? `− ${formatFcfa(-r.amount)}` : formatFcfa(r.amount)}</span>}
                  {r.kind !== "restock" && (
                    <button type="button" onClick={() => removeEntry(r.kind as "sale" | "expense", r.id)} className="text-xs underline" style={{ color: "var(--dash-muted)" }}>
                      {t.books.delete}
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Figure({ label, value, prev, t, invert, strong }: { label: string; value: number; prev: number; t: Dictionary; invert?: boolean; strong?: boolean }) {
  const change = prev !== 0 ? Math.round(((value - prev) / Math.abs(prev)) * 100) : null;
  const good = change == null ? true : invert ? change <= 0 : change >= 0;
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: strong ? "var(--dash-ink)" : "var(--dash-bg-2)", color: strong ? "white" : undefined }}>
      <p className="text-xs font-semibold" style={{ opacity: 0.7 }}>{label}</p>
      <p className="text-xl font-bold mt-0.5">{value < 0 ? `− ${formatFcfa(-value)}` : formatFcfa(value)}</p>
      {change != null && (
        <p className="text-[11px] mt-0.5 inline-flex items-center gap-1" style={{ color: strong ? undefined : good ? "var(--dash-success)" : "var(--dash-danger)", opacity: strong ? 0.8 : 1 }}>
          {change >= 0 ? <IconTrendingUp className="w-3 h-3" /> : <IconTrendingDown className="w-3 h-3" />}
          {change > 0 ? "+" : ""}
          {change}% {t.money.vsPrevious}
        </p>
      )}
    </div>
  );
}

function Line({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className={`flex justify-between text-sm py-1 ${strong ? "font-bold border-t mt-1 pt-2" : ""}`} style={{ color: muted ? "var(--dash-muted)" : undefined, borderColor: "var(--dash-border)" }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function SaleForm({ shop, products, t, onDone }: { shop: Shop; products: Product[]; t: Dictionary; onDone: () => void }) {
  const [productId, setProductId] = useState<string>(products.find((p) => p.stock_quantity > 0)?.id ?? "");
  const product = products.find((p) => p.id === productId) ?? null;
  const [title, setTitle] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState(product ? String(product.sale_price_fcfa ?? product.price_fcfa) : "");
  const [method, setMethod] = useState<"cash" | "momo" | "other">("cash");
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("books_record_sale", {
      p_shop: shop.id,
      p_product: productId || null,
      p_title: productId ? null : title,
      p_qty: Math.round(Number(qty)),
      p_unit_price: Math.round(Number(price)),
      p_method: method,
      p_sold_on: date,
      p_note: null,
    });
    setBusy(false);
    if (err) setError(problemText(t, err.message));
    else onDone();
  }

  return (
    <form onSubmit={submit} className="mt-4 rounded-xl bg-white p-4 grid sm:grid-cols-2 gap-3 border" style={{ borderColor: "var(--dash-border)" }}>
      <label className="text-xs font-medium sm:col-span-2">
        {t.books.saleItem}
        <select
          value={productId}
          onChange={(e) => {
            setProductId(e.target.value);
            const p = products.find((x) => x.id === e.target.value);
            if (p) setPrice(String(p.sale_price_fcfa ?? p.price_fcfa));
          }}
          className="dash-input mt-1"
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} ({p.stock_quantity})
            </option>
          ))}
          <option value="">{t.books.saleOtherItem}</option>
        </select>
      </label>
      {!productId && (
        <label className="text-xs font-medium sm:col-span-2">
          {t.books.saleTitle}
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className="dash-input mt-1" />
        </label>
      )}
      <label className="text-xs font-medium">
        {t.books.quantity}
        <input required type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className="dash-input mt-1" />
      </label>
      <label className="text-xs font-medium">
        {t.books.unitPrice}
        <input required type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className="dash-input mt-1" />
      </label>
      <div className="text-xs font-medium">
        {t.books.paidWith}
        <div className="mt-1 flex gap-1.5">
          {(["cash", "momo", "other"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMethod(m)} className={method === m ? "dash-btn !py-1.5 !px-3 text-xs" : "dash-btn-outline !py-1.5 !px-3 text-xs"}>
              {t.books.methods[m]}
            </button>
          ))}
        </div>
      </div>
      <label className="text-xs font-medium">
        {t.books.date}
        <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className="dash-input mt-1" />
      </label>
      {product && Number(qty) > product.stock_quantity && (
        <p className="text-xs sm:col-span-2" style={{ color: "var(--dash-gold-ink)" }}>{t.books.saleMoreThanStock.replace("{n}", String(product.stock_quantity))}</p>
      )}
      {error && <p className="text-xs sm:col-span-2" style={{ color: "var(--dash-danger)" }}>{error}</p>}
      <button type="submit" disabled={busy} className="dash-btn justify-center sm:col-span-2">
        {busy ? t.dashboard.saving : `${t.books.saveSale}${Number(qty) > 0 && Number(price) >= 0 ? ` · ${formatFcfa(Math.round(Number(qty) * Number(price)))}` : ""}`}
      </button>
    </form>
  );
}

function RestockForm({ products, costs, t, onDone }: { products: Product[]; costs: Map<string, number>; t: Dictionary; onDone: () => void }) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState("1");
  const [cost, setCost] = useState(() => (products[0] && costs.has(products[0].id) ? String(costs.get(products[0].id)) : ""));
  const [asExpense, setAsExpense] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("books_restock", {
      p_product: productId,
      p_qty: Math.round(Number(qty)),
      p_unit_cost: cost.trim() === "" ? null : Math.round(Number(cost)),
      p_record_expense: asExpense,
      p_note: null,
    });
    setBusy(false);
    if (err) setError(problemText(t, err.message));
    else onDone();
  }

  if (products.length === 0) return <p className="mt-4 text-sm">{t.books.noProducts}</p>;

  return (
    <form onSubmit={submit} className="mt-4 rounded-xl bg-white p-4 grid sm:grid-cols-2 gap-3 border" style={{ borderColor: "var(--dash-border)" }}>
      <label className="text-xs font-medium sm:col-span-2">
        {t.books.restockItem}
        <select
          value={productId}
          onChange={(e) => {
            setProductId(e.target.value);
            setCost(costs.has(e.target.value) ? String(costs.get(e.target.value)) : "");
          }}
          className="dash-input mt-1"
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} ({p.stock_quantity})
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium">
        {t.books.quantityAdded}
        <input required type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className="dash-input mt-1" />
      </label>
      <label className="text-xs font-medium">
        {t.books.unitCost}
        <input type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} placeholder={t.books.optional} className="dash-input mt-1" />
      </label>
      {cost.trim() !== "" && (
        <label className="text-xs flex items-center gap-2 sm:col-span-2">
          <input type="checkbox" checked={asExpense} onChange={(e) => setAsExpense(e.target.checked)} />
          {t.books.recordAsExpense.replace("{amount}", formatFcfa(Math.round(Number(qty) * Number(cost)) || 0))}
        </label>
      )}
      {error && <p className="text-xs sm:col-span-2" style={{ color: "var(--dash-danger)" }}>{error}</p>}
      <button type="submit" disabled={busy || !productId} className="dash-btn justify-center sm:col-span-2">
        {busy ? t.dashboard.saving : t.books.saveRestock}
      </button>
    </form>
  );
}

function ExpenseForm({ shop, t, onDone }: { shop: Shop; t: Dictionary; onDone: () => void }) {
  const [category, setCategory] = useState<ExpenseCategory>("transport");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Math.round(Number(amount));
    if (!Number.isFinite(n) || n <= 0) {
      setError(t.books.errors.generic);
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from("shop_expenses").insert({ shop_id: shop.id, category, amount_fcfa: n, note: note.trim() || null, spent_on: date });
    setBusy(false);
    if (err) setError(t.books.errors.generic);
    else onDone();
  }

  return (
    <form onSubmit={submit} className="mt-4 rounded-xl bg-white p-4 flex flex-col gap-3 border" style={{ borderColor: "var(--dash-border)" }}>
      <div className="flex flex-wrap gap-1.5">
        {EXPENSE_CATEGORIES.map((c) => (
          <button key={c} type="button" onClick={() => setCategory(c)} className={category === c ? "dash-btn !py-1.5 !px-3 text-xs" : "dash-btn-outline !py-1.5 !px-3 text-xs"}>
            {t.books.categories[c]}
          </button>
        ))}
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="text-xs font-medium">
          {t.books.amount}
          <input required type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="dash-input mt-1" />
        </label>
        <label className="text-xs font-medium">
          {t.books.date}
          <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className="dash-input mt-1" />
        </label>
        <label className="text-xs font-medium">
          {t.books.note}
          <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} placeholder={t.books.optional} className="dash-input mt-1" />
        </label>
      </div>
      {error && <p className="text-xs" style={{ color: "var(--dash-danger)" }}>{error}</p>}
      <button type="submit" disabled={busy} className="dash-btn justify-center">
        {busy ? t.dashboard.saving : t.books.saveExpense}
      </button>
    </form>
  );
}
