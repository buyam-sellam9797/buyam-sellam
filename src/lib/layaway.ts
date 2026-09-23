// Seller-configurable layaway ("pay in installments").
//
// Each shop decides, from its dashboard, whether buyers may pay in
// installments, how many payments (2–6), how big the first payment
// (deposit) is, and how many days apart the later payments are due.
// A single product can override the number of payments, or switch
// installments off for that product only.
//
// This file is shared by the server (which computes the real, charged
// amounts) and the checkout form (which shows the buyer the same plan
// before they pay), so the two can never disagree.

export const LAYAWAY_MIN_INSTALLMENTS = 2;
export const LAYAWAY_MAX_INSTALLMENTS = 6;
export const LAYAWAY_MIN_DEPOSIT_PERCENT = 10;
export const LAYAWAY_MAX_DEPOSIT_PERCENT = 90;
export const LAYAWAY_MIN_INTERVAL_DAYS = 3;
export const LAYAWAY_MAX_INTERVAL_DAYS = 60;

export type LayawayShopSettings = {
  layaway_enabled: boolean | null;
  layaway_installments: number | null;
  layaway_deposit_percent: number | null;
  layaway_interval_days: number | null;
};

export type LayawaySettings = {
  enabled: boolean;
  installments: number;
  depositPercent: number;
  intervalDays: number;
};

export const DEFAULT_LAYAWAY: LayawaySettings = {
  enabled: true,
  installments: 2,
  depositPercent: 50,
  intervalDays: 14,
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(n)));
}

// Combine the shop's settings with an optional per-product override.
// productInstallments: null/undefined = follow the shop, 0 = no
// installments for this product, 2–6 = this many payments.
export function resolveLayawaySettings(
  shop: Partial<LayawayShopSettings> | null | undefined,
  productInstallments?: number | null
): LayawaySettings {
  const enabled = shop?.layaway_enabled ?? DEFAULT_LAYAWAY.enabled;
  let installments = shop?.layaway_installments ?? DEFAULT_LAYAWAY.installments;
  if (productInstallments === 0) {
    return { ...DEFAULT_LAYAWAY, enabled: false };
  }
  if (typeof productInstallments === "number" && productInstallments >= LAYAWAY_MIN_INSTALLMENTS) {
    installments = productInstallments;
  }
  return {
    enabled,
    installments: clamp(installments, LAYAWAY_MIN_INSTALLMENTS, LAYAWAY_MAX_INSTALLMENTS),
    depositPercent: clamp(
      shop?.layaway_deposit_percent ?? DEFAULT_LAYAWAY.depositPercent,
      LAYAWAY_MIN_DEPOSIT_PERCENT,
      LAYAWAY_MAX_DEPOSIT_PERCENT
    ),
    intervalDays: clamp(
      shop?.layaway_interval_days ?? DEFAULT_LAYAWAY.intervalDays,
      LAYAWAY_MIN_INTERVAL_DAYS,
      LAYAWAY_MAX_INTERVAL_DAYS
    ),
  };
}

export type LayawayPlanItem = { installmentNumber: number; amountFcfa: number; dueInDays: number };

// No single mobile-money charge in a plan is allowed below this — a
// cheap item split six ways would otherwise produce tiny (or zero)
// payments. When the total is too small for the seller's chosen number
// of payments, the plan simply uses fewer; if even two payments would
// go below it, installments aren't offered for that order at all.
export const LAYAWAY_MIN_PAYMENT_FCFA = 500;

// Split a total into the installment amounts: the deposit first, then
// the rest spread as evenly as possible (any rounding remainder goes
// on the last payment, so the amounts always add up to the total).
// Returns an empty list when the total is too small to split at all.
export function computeLayawayPlan(totalFcfa: number, settings: LayawaySettings): LayawayPlanItem[] {
  const deposit = Math.round((totalFcfa * settings.depositPercent) / 100);
  const rest = totalFcfa - deposit;
  if (deposit < LAYAWAY_MIN_PAYMENT_FCFA || rest < LAYAWAY_MIN_PAYMENT_FCFA) return [];
  const laterCount = Math.max(1, Math.min(settings.installments - 1, Math.floor(rest / LAYAWAY_MIN_PAYMENT_FCFA)));
  const base = Math.floor(rest / laterCount);
  const plan: LayawayPlanItem[] = [{ installmentNumber: 1, amountFcfa: deposit, dueInDays: 0 }];
  for (let i = 1; i <= laterCount; i++) {
    const isLast = i === laterCount;
    plan.push({
      installmentNumber: i + 1,
      amountFcfa: isLast ? rest - base * (laterCount - 1) : base,
      dueInDays: settings.intervalDays * i,
    });
  }
  return plan;
}
