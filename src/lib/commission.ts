// Buyam Sellam's cut on every completed order. Sellers list and sell
// for free — this is the only place money is made, taken out of the
// held payment before the rest is sent to the seller. Keep this as
// the single source of truth so the rate is never calculated two
// different ways in two different pages.
export const COMMISSION_RATE = 0.05;

export function calculateCommission(totalFcfa: number) {
  const commissionFcfa = Math.round(totalFcfa * COMMISSION_RATE);
  const sellerPayoutFcfa = totalFcfa - commissionFcfa;
  return { commissionFcfa, sellerPayoutFcfa };
}
