"use client";

import { useCallback, useEffect, useState } from "react";
import { createGroupBuy, cancelGroupBuy, getMyShopGroupBuys, type GroupBuy, type Product } from "@/lib/supabase";
import { formatFcfa } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import { IconTag } from "@/components/dash-icons";

type GroupBuyRow = GroupBuy & { productTitle: string };

const MIN_TARGET_QUANTITY = 2;

// Lets a seller run a njangi-style group buy: buyers join and pay
// immediately, but the order only ships once enough of them have
// joined by the deadline (see order-fulfillment.ts's
// tryFinalizeGroupBuy/expireGroupBuy for what actually happens to
// those payments). This panel is purely campaign management — create
// one, watch it fill up, cancel it if needed; the money side is
// handled entirely server-side.
export function GroupBuyPanel({ shopId, products, t }: { shopId: string; products: Product[]; t: Dictionary }) {
  const [groupBuys, setGroupBuys] = useState<GroupBuyRow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setGroupBuys((await getMyShopGroupBuys(shopId)) as GroupBuyRow[]);
  }, [shopId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleCancel(id: string) {
    setCancellingId(id);
    try {
      await cancelGroupBuy(id);
      await load();
    } finally {
      setCancellingId(null);
    }
  }

  const activeProducts = products.filter((p) => p.is_active);

  return (
    <div className="dash-card p-5 mb-6">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <IconTag className="w-4 h-4" style={{ color: "var(--dash-gold-ink)" }} />
          {t.dashboard.groupBuyTitle}
        </p>
        {!creating && activeProducts.length > 0 && (
          <button type="button" onClick={() => setCreating(true)} className="dash-btn-outline !py-1 !px-2.5 text-xs">
            {t.dashboard.groupBuyCreate}
          </button>
        )}
      </div>
      <p className="text-xs mb-3" style={{ color: "var(--dash-muted)" }}>
        {t.dashboard.groupBuyHint}
      </p>

      {creating && (
        <GroupBuyForm
          shopId={shopId}
          products={activeProducts}
          t={t}
          onCreated={async () => {
            setCreating(false);
            await load();
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {groupBuys === null ? null : groupBuys.length === 0 ? (
        !creating && <p className="text-xs" style={{ color: "var(--dash-muted)" }}>{t.dashboard.groupBuyNone}</p>
      ) : (
        <div className="flex flex-col gap-2 mt-2">
          {groupBuys.map((g) => {
            const joined = g.joined_quantity ?? 0;
            const pct = Math.min(100, Math.round((joined / g.target_quantity) * 100));
            return (
              <div key={g.id} className="rounded-lg p-3" style={{ background: "var(--dash-bg-2)" }}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{g.productTitle}</p>
                  <span className="dash-badge shrink-0">
                    {t.dashboard.groupBuyStatusLabels[g.status] ?? g.status}
                  </span>
                </div>
                <p className="text-xs mt-1" style={{ color: "var(--dash-muted)" }}>
                  {formatFcfa(g.group_price_fcfa)} ·{" "}
                  {t.dashboard.groupBuyProgress.replace("{joined}", String(joined)).replace("{target}", String(g.target_quantity))}{" "}
                  · {t.dashboard.groupBuyDeadline.replace("{date}", new Date(g.deadline).toLocaleDateString())}
                </p>
                <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--dash-border)" }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--dash-gold-ink)" }} />
                </div>
                {g.status === "open" && (
                  <button
                    type="button"
                    onClick={() => handleCancel(g.id)}
                    disabled={cancellingId === g.id}
                    className="text-xs mt-2 hover:underline disabled:opacity-60"
                    style={{ color: "var(--dash-muted)" }}
                  >
                    {t.dashboard.groupBuyCancel}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GroupBuyForm({
  shopId,
  products,
  t,
  onCreated,
  onCancel,
}: {
  shopId: string;
  products: Product[];
  t: Dictionary;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [targetQuantity, setTargetQuantity] = useState(5);
  const [groupPrice, setGroupPrice] = useState<number | "">("");
  const [deadline, setDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!productId || !groupPrice || targetQuantity < MIN_TARGET_QUANTITY) {
      setError(t.dashboard.groupBuyErrorInvalid);
      return;
    }
    setSubmitting(true);
    try {
      await createGroupBuy({
        shopId,
        productId,
        targetQuantity,
        groupPriceFcfa: Number(groupPrice),
        deadline: new Date(`${deadline}T23:59:59`).toISOString(),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.dashboard.groupBuyErrorGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg p-3 mb-3 flex flex-col gap-2" style={{ background: "var(--dash-bg-2)" }}>
      <select
        value={productId}
        onChange={(e) => setProductId(e.target.value)}
        className="w-full rounded-lg border px-3 py-2 text-sm"
        style={{ borderColor: "var(--dash-border)", background: "var(--dash-surface)" }}
      >
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs block mb-1" style={{ color: "var(--dash-muted)" }}>
            {t.dashboard.groupBuyTargetLabel}
          </label>
          <input
            type="number"
            min={MIN_TARGET_QUANTITY}
            required
            value={targetQuantity}
            onChange={(e) => setTargetQuantity(Number(e.target.value))}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--dash-border)", background: "var(--dash-surface)" }}
          />
        </div>
        <div>
          <label className="text-xs block mb-1" style={{ color: "var(--dash-muted)" }}>
            {t.dashboard.groupBuyPriceLabel}
          </label>
          <input
            type="number"
            min={1}
            required
            value={groupPrice}
            onChange={(e) => setGroupPrice(e.target.value ? Number(e.target.value) : "")}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--dash-border)", background: "var(--dash-surface)" }}
          />
        </div>
      </div>
      <div>
        <label className="text-xs block mb-1" style={{ color: "var(--dash-muted)" }}>
          {t.dashboard.groupBuyDeadlineLabel}
        </label>
        <input
          type="date"
          required
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          min={new Date().toISOString().slice(0, 10)}
          className="w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--dash-border)", background: "var(--dash-surface)" }}
        />
      </div>
      {error && (
        <p className="text-xs rounded-lg px-3 py-2" style={{ background: "rgba(220, 38, 38, 0.1)", color: "#b91c1c" }}>
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="dash-btn !py-1.5 !px-3 text-xs disabled:opacity-60">
          {submitting ? t.dashboard.groupBuySaving : t.dashboard.groupBuySave}
        </button>
        <button type="button" onClick={onCancel} className="dash-btn-outline !py-1.5 !px-3 text-xs">
          {t.account.cancel}
        </button>
      </div>
    </form>
  );
}
