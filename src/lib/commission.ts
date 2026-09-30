// Buyam Sellam's cut on every completed order. Sellers list and sell
// for free — this is the only place money is made, taken out of the
// held payment before the rest is sent to the seller. Keep this as
// the single source of truth so the rate is never calculated two
// different ways in two different pages.
export const COMMISSION_RATE = 0.05;

// The commission is taken on the items only: the delivery fee passes
// through to the seller untouched (they're the one delivering).
export function calculateCommission(totalFcfa: number, deliveryFeeFcfa = 0) {
  const delivery = Math.max(0, Math.min(deliveryFeeFcfa || 0, totalFcfa));
  const commissionFcfa = Math.round((totalFcfa - delivery) * COMMISSION_RATE);
  const sellerPayoutFcfa = totalFcfa - commissionFcfa;
  return { commissionFcfa, sellerPayoutFcfa };
}

/** Commission for an order row (total includes the delivery fee). */
export function orderCommission(order: { total_amount_fcfa: number; delivery_fee_fcfa?: number | null }) {
  return calculateCommission(order.total_amount_fcfa, order.delivery_fee_fcfa ?? 0);
}
