"use client";

import { useState } from "react";
import { updateShop, type Shop } from "@/lib/supabase";
import type { Dictionary } from "@/lib/i18n";
import { formatFcfa } from "@/lib/format";
import {
  resolveLayawaySettings,
  computeLayawayPlan,
  LAYAWAY_MIN_INSTALLMENTS,
  LAYAWAY_MAX_INSTALLMENTS,
  LAYAWAY_MIN_DEPOSIT_PERCENT,
  LAYAWAY_MAX_DEPOSIT_PERCENT,
  LAYAWAY_MIN_INTERVAL_DAYS,
  LAYAWAY_MAX_INTERVAL_DAYS,
} from "@/lib/layaway";

// Where a seller decides how buyers may pay in installments: on/off,
// how many payments, how big the first one is, and how many days apart
// the rest are due. A single product can still override the number of
// payments (or switch installments off) from its own edit form. A live
// example underneath shows exactly what a buyer would be asked to pay,
// using the same helper the checkout and the server use.
export function LayawaySettingsPanel({
  shop,
  t,
  onSaved,
}: {
  shop: Shop;
  t: Dictionary;
  onSaved: (patch: Partial<Shop>) => void;
}) {
  const initial = resolveLayawaySettings(shop);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [installments, setInstallments] = useState(initial.installments);
  const [depositPercent, setDepositPercent] = useState(initial.depositPercent);
  const [intervalDays, setIntervalDays] = useState(initial.intervalDays);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const example = computeLayawayPlan(20000, { enabled, installments, depositPercent, intervalDays });

  function clamp(v: number, min: number, max: number) {
    if (!Number.isFinite(v)) return min;
    return Math.min(max, Math.max(min, Math.round(v)));
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    const patch = {
      layaway_enabled: enabled,
      layaway_installments: clamp(installments, LAYAWAY_MIN_INSTALLMENTS, LAYAWAY_MAX_INSTALLMENTS),
      layaway_deposit_percent: clamp(depositPercent, LAYAWAY_MIN_DEPOSIT_PERCENT, LAYAWAY_MAX_DEPOSIT_PERCENT),
      layaway_interval_days: clamp(intervalDays, LAYAWAY_MIN_INTERVAL_DAYS, LAYAWAY_MAX_INTERVAL_DAYS),
    };
    try {
      await updateShop(shop.id, {
        layawayEnabled: patch.layaway_enabled,
        layawayInstallments: patch.layaway_installments,
        layawayDepositPercent: patch.layaway_deposit_percent,
        layawayIntervalDays: patch.layaway_interval_days,
      });
      setInstallments(patch.layaway_installments);
      setDepositPercent(patch.layaway_deposit_percent);
      setIntervalDays(patch.layaway_interval_days);
      onSaved(patch);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your installment settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dash-card p-5 flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold">{t.dashboard.layawaySettingsTitle}</p>
        <p className="text-xs mt-1" style={{ color: "var(--dash-muted)" }}>{t.dashboard.layawaySettingsHint}</p>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            setSaved(false);
          }}
        />
        {t.dashboard.layawayEnabledLabel}
      </label>

      {enabled && (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1" htmlFor="layawayInstallments">
                {t.dashboard.layawayInstallmentsLabel}
              </label>
              <select
                id="layawayInstallments"
                value={installments}
                onChange={(e) => {
                  setInstallments(Number(e.target.value));
                  setSaved(false);
                }}
                className="dash-input"
              >
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" htmlFor="layawayDeposit">
                {t.dashboard.layawayDepositLabel}
              </label>
              <input
                id="layawayDeposit"
                type="number"
                min={LAYAWAY_MIN_DEPOSIT_PERCENT}
                max={LAYAWAY_MAX_DEPOSIT_PERCENT}
                step={5}
                value={depositPercent}
                onChange={(e) => {
                  setDepositPercent(Number(e.target.value));
                  setSaved(false);
                }}
                className="dash-input"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" htmlFor="layawayInterval">
                {t.dashboard.layawayIntervalLabel}
              </label>
              <input
                id="layawayInterval"
                type="number"
                min={LAYAWAY_MIN_INTERVAL_DAYS}
                max={LAYAWAY_MAX_INTERVAL_DAYS}
                value={intervalDays}
                onChange={(e) => {
                  setIntervalDays(Number(e.target.value));
                  setSaved(false);
                }}
                className="dash-input"
              />
            </div>
          </div>

          {example.length >= 2 && (
            <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "var(--dash-bg-2)", border: "1px solid var(--dash-border)" }}>
              <p className="font-medium mb-1">{t.dashboard.layawayExample}</p>
              <ol className="flex flex-col gap-0.5">
                {example.map((p) => (
                  <li key={p.installmentNumber} className="flex justify-between gap-3">
                    <span style={{ color: "var(--dash-muted)" }}>
                      {p.dueInDays === 0
                        ? t.checkout.layawayToday
                        : t.checkout.layawayInDays.replace("{days}", String(p.dueInDays))}
                    </span>
                    <span className="font-medium">{formatFcfa(p.amountFcfa)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}

      {error && (
        <p className="text-sm rounded-lg px-3 py-2" style={{ color: "var(--dash-danger)", background: "var(--dash-danger-wash)", border: "1px solid var(--dash-danger)" }}>
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button type="button" onClick={handleSave} disabled={saving} className="dash-btn self-start">
          {saving ? t.dashboard.saving : t.dashboard.shopSettingsSave}
        </button>
        {saved && !saving && (
          <span className="text-sm" style={{ color: "var(--dash-success)" }}>{t.dashboard.shopSettingsSaved}</span>
        )}
      </div>
    </div>
  );
}
