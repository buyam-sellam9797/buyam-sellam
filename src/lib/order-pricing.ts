import type { SupabaseClient } from "@supabase/supabase-js";
import { haversineDistanceKm, calculateDistanceDeliveryFeeFcfa } from "@/lib/delivery";

// Shared by every payment gateway's checkout route (NotchPay, SebPay,
// and whichever comes next) so the price a buyer is quoted — and the
// price actually charged — is computed exactly once, the same way,
// everywhere. Before this was extracted, this logic lived duplicated
// inside each gateway's route; a future change to how delivery zones or
// promotions are priced only has to happen here now.
export type OrderPricingInput = {
  productId: string;
  quantity?: number;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliveryZoneId?: string;
};

export type OrderPricingSuccess = {
  ok: true;
  product: {
    id: string;
    shop_id: string;
    title: string;
    price_fcfa: number;
    sale_price_fcfa: number | null;
    stock_quantity: number;
    layaway_installments: number | null;
  };
  // The shop's pay-in-installments settings, for the layaway route.
  shopLayaway: {
    layaway_enabled: boolean | null;
    layaway_installments: number | null;
    layaway_deposit_percent: number | null;
    layaway_interval_days: number | null;
  } | null;
  quantity: number;
  unitPriceFcfa: number;
  deliveryFeeFcfa: number;
  deliveryDistanceKm: number | null;
  deliveryZoneName: string | null;
  totalAmountFcfa: number;
};

export type OrderPricingFailure = { ok: false; error: string; status: number };

export async function resolveOrderPricing(
  admin: SupabaseClient,
  input: OrderPricingInput
): Promise<OrderPricingSuccess | OrderPricingFailure> {
  const { data: product, error: productError } = await admin
    .from("products")
    .select(
      "id, shop_id, title, price_fcfa, sale_price_fcfa, stock_quantity, is_active, layaway_installments, shop:shops(delivery_fee_fcfa, latitude, longitude, is_open, closed_message, layaway_enabled, layaway_installments, layaway_deposit_percent, layaway_interval_days)"
    )
    .eq("id", input.productId)
    .eq("is_active", true)
    .maybeSingle();

  if (productError || !product) {
    return { ok: false, error: "This product is no longer available.", status: 404 };
  }

  const requestedQuantity = Number(input.quantity);
  const quantity =
    Number.isInteger(requestedQuantity) && requestedQuantity > 0 ? requestedQuantity : 1;
  if (quantity > product.stock_quantity) {
    return { ok: false, error: `Only ${product.stock_quantity} left in stock.`, status: 409 };
  }

  const shopRecord = Array.isArray(product.shop) ? product.shop[0] : product.shop;

  // A seller can mark their shop temporarily closed (vacation, out of
  // stock everywhere, etc.) without deactivating it — blocked here so
  // an order can't sneak through payment while nobody's there to
  // fulfill it, even if a buyer had the product page open from before
  // the shop closed.
  if (shopRecord?.is_open === false) {
    return {
      ok: false,
      error:
        shopRecord.closed_message ||
        "This shop is temporarily closed and isn't accepting orders right now.",
      status: 409,
    };
  }

  const flatDeliveryFeeFcfa: number = shopRecord?.delivery_fee_fcfa ?? 0;

  // Distance-based delivery pricing: automatic whenever the shop has
  // pinned its location AND the buyer shared theirs at checkout — the
  // seller's own flat fee becomes the fallback for everyone else
  // (guests who didn't share a location, or shops that never pinned
  // one), so nothing changes for anyone not using location.
  let deliveryFeeFcfa = flatDeliveryFeeFcfa;
  let deliveryDistanceKm: number | null = null;
  if (
    shopRecord?.latitude != null &&
    shopRecord?.longitude != null &&
    typeof input.deliveryLatitude === "number" &&
    typeof input.deliveryLongitude === "number"
  ) {
    deliveryDistanceKm = haversineDistanceKm(
      shopRecord.latitude,
      shopRecord.longitude,
      input.deliveryLatitude,
      input.deliveryLongitude
    );
    deliveryFeeFcfa = calculateDistanceDeliveryFeeFcfa(deliveryDistanceKm, flatDeliveryFeeFcfa);
  }

  // Delivery zones: optional, seller-defined named prices. When the
  // buyer picked one (only possible when the shop has configured at
  // least one — see getDeliveryZones), its fee replaces the flat/
  // distance-based fee above entirely, since a seller who set up zones
  // is deliberately opting into that pricing instead. Looked up and
  // trusted server-side, never taken from the client body directly, and
  // re-validated against this exact shop so a buyer can't pass another
  // shop's cheaper zone id.
  let deliveryZoneName: string | null = null;
  if (input.deliveryZoneId) {
    const { data: zone } = await admin
      .from("delivery_zones")
      .select("id, name, fee_fcfa")
      .eq("id", input.deliveryZoneId)
      .eq("shop_id", product.shop_id)
      .maybeSingle();
    if (zone) {
      deliveryFeeFcfa = zone.fee_fcfa;
      deliveryDistanceKm = null;
      deliveryZoneName = zone.name;
    }
  }

  // Promotions: a seller-set sale price always wins over the regular
  // price when present — same rule the shop/product pages use to show
  // the crossed-out price, so what a buyer is quoted is what they pay.
  const unitPriceFcfa = product.sale_price_fcfa ?? product.price_fcfa;
  const totalAmountFcfa = unitPriceFcfa * quantity + deliveryFeeFcfa;

  return {
    ok: true,
    product,
    shopLayaway: shopRecord
      ? {
          layaway_enabled: shopRecord.layaway_enabled ?? null,
          layaway_installments: shopRecord.layaway_installments ?? null,
          layaway_deposit_percent: shopRecord.layaway_deposit_percent ?? null,
          layaway_interval_days: shopRecord.layaway_interval_days ?? null,
        }
      : null,
    quantity,
    unitPriceFcfa,
    deliveryFeeFcfa,
    deliveryDistanceKm,
    deliveryZoneName,
    totalAmountFcfa,
  };
}
