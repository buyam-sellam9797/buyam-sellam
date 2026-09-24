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

// ---------------------------------------------------------------
// Several items from one shop in one order (the bag), or one item at
// a price agreed through an offer. Same rules as resolveOrderPricing:
// every price comes from the database, stock is checked per line, the
// shop must be open, and delivery is charged once per order.
// ---------------------------------------------------------------

export const MAX_BAG_LINES = 20;

export type BagLineInput = { productId: string; quantity?: number };

export type BagPricingLine = {
  product: { id: string; shop_id: string; title: string; price_fcfa: number; sale_price_fcfa: number | null; stock_quantity: number };
  quantity: number;
  unitPriceFcfa: number;
};

export type BagPricingSuccess = {
  ok: true;
  shopId: string;
  lines: BagPricingLine[];
  itemsTotalFcfa: number;
  deliveryFeeFcfa: number;
  deliveryDistanceKm: number | null;
  deliveryZoneName: string | null;
  totalAmountFcfa: number;
  description: string;
};

export async function resolveBagPricing(
  admin: SupabaseClient,
  input: {
    lines: BagLineInput[];
    // Unit price agreed through an offer, for a single-line order.
    agreedUnitPriceFcfa?: number;
    deliveryLatitude?: number;
    deliveryLongitude?: number;
    deliveryZoneId?: string;
  }
): Promise<BagPricingSuccess | OrderPricingFailure> {
  // Merge duplicate lines for the same product.
  const wanted = new Map<string, number>();
  for (const line of input.lines ?? []) {
    if (!line?.productId || !/^[0-9a-f-]{36}$/i.test(line.productId)) continue;
    const q = Number(line.quantity);
    const qty = Number.isInteger(q) && q > 0 ? Math.min(q, 999) : 1;
    wanted.set(line.productId, (wanted.get(line.productId) ?? 0) + qty);
  }
  if (wanted.size === 0) return { ok: false, error: "Your bag is empty.", status: 400 };
  if (wanted.size > MAX_BAG_LINES) return { ok: false, error: `A bag can hold up to ${MAX_BAG_LINES} different items.`, status: 400 };
  if (input.agreedUnitPriceFcfa != null && wanted.size !== 1) {
    return { ok: false, error: "An offer price applies to one item.", status: 400 };
  }

  const { data: rows, error } = await admin
    .from("products")
    .select(
      "id, shop_id, title, price_fcfa, sale_price_fcfa, stock_quantity, is_active, shop:shops(delivery_fee_fcfa, latitude, longitude, is_open, closed_message)"
    )
    .in("id", [...wanted.keys()])
    .eq("is_active", true);
  if (error || !rows || rows.length !== wanted.size) {
    return { ok: false, error: "One of these items is no longer available.", status: 404 };
  }

  const shopId = rows[0].shop_id as string;
  if (rows.some((r) => r.shop_id !== shopId)) {
    return { ok: false, error: "A bag can only hold items from one shop.", status: 400 };
  }
  const shopRecord = (Array.isArray(rows[0].shop) ? rows[0].shop[0] : rows[0].shop) as {
    delivery_fee_fcfa: number | null;
    latitude: number | null;
    longitude: number | null;
    is_open: boolean | null;
    closed_message: string | null;
  } | null;
  if (shopRecord?.is_open === false) {
    return {
      ok: false,
      error: shopRecord.closed_message || "This shop is temporarily closed and isn't accepting orders right now.",
      status: 409,
    };
  }

  const lines: BagPricingLine[] = [];
  for (const row of rows) {
    const quantity = input.agreedUnitPriceFcfa != null ? 1 : (wanted.get(row.id) ?? 1);
    if (quantity > row.stock_quantity) {
      return {
        ok: false,
        error: row.stock_quantity > 0 ? `Only ${row.stock_quantity} left of "${row.title}".` : `"${row.title}" is sold out.`,
        status: 409,
      };
    }
    lines.push({
      product: {
        id: row.id,
        shop_id: row.shop_id,
        title: row.title,
        price_fcfa: row.price_fcfa,
        sale_price_fcfa: row.sale_price_fcfa,
        stock_quantity: row.stock_quantity,
      },
      quantity,
      unitPriceFcfa: input.agreedUnitPriceFcfa ?? row.sale_price_fcfa ?? row.price_fcfa,
    });
  }

  const flatDeliveryFeeFcfa: number = shopRecord?.delivery_fee_fcfa ?? 0;
  let deliveryFeeFcfa = flatDeliveryFeeFcfa;
  let deliveryDistanceKm: number | null = null;
  if (
    shopRecord?.latitude != null &&
    shopRecord?.longitude != null &&
    typeof input.deliveryLatitude === "number" &&
    typeof input.deliveryLongitude === "number"
  ) {
    deliveryDistanceKm = haversineDistanceKm(shopRecord.latitude, shopRecord.longitude, input.deliveryLatitude, input.deliveryLongitude);
    deliveryFeeFcfa = calculateDistanceDeliveryFeeFcfa(deliveryDistanceKm, flatDeliveryFeeFcfa);
  }
  let deliveryZoneName: string | null = null;
  if (input.deliveryZoneId) {
    const { data: zone } = await admin
      .from("delivery_zones")
      .select("id, name, fee_fcfa")
      .eq("id", input.deliveryZoneId)
      .eq("shop_id", shopId)
      .maybeSingle();
    if (zone) {
      deliveryFeeFcfa = zone.fee_fcfa;
      deliveryDistanceKm = null;
      deliveryZoneName = zone.name;
    }
  }

  const itemsTotalFcfa = lines.reduce((sum, l) => sum + l.unitPriceFcfa * l.quantity, 0);
  const first = lines[0].product.title;
  const description = lines.length > 1 ? `${first} +${lines.length - 1}` : first;
  return {
    ok: true,
    shopId,
    lines,
    itemsTotalFcfa,
    deliveryFeeFcfa,
    deliveryDistanceKm,
    deliveryZoneName,
    totalAmountFcfa: itemsTotalFcfa + deliveryFeeFcfa,
    description,
  };
}
