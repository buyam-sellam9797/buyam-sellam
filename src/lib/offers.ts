import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyShop } from "@/lib/supabase-admin";
import { formatFcfa } from "@/lib/format";
import { sendMail } from "@/lib/smtp";
import { renderEmail, userEmailAndLang, type Lang, type Mail } from "@/lib/order-emails";

// "Make an offer": a buyer proposes a price, the seller accepts,
// counters once or declines, and an agreed price can be paid within
// 48 hours through the normal protected checkout. Everything that
// changes an offer runs here, on the server, so the rules (who may do
// what, from which state, within which window) can't be skipped from
// the browser. The seller can also set two private numbers per
// product: a floor (offers below it are politely declined straight
// away) and an instant-deal price (offers at or above it are accepted
// on the spot) — buyers never see either.

export const OFFER_MIN_RATIO = 0.5; // offers under 50% of the price aren't sent
export const MAX_OFFERS_PER_PRODUCT = 3; // per buyer, so haggling can't turn into spam
export const RESPOND_HOURS = 48;
export const PAY_HOURS = 48;

export type OfferStatus = "pending" | "countered" | "accepted" | "declined" | "withdrawn" | "expired" | "paid";

export type OfferRow = {
  id: string;
  product_id: string;
  shop_id: string;
  buyer_id: string;
  amount_fcfa: number;
  counter_fcfa: number | null;
  agreed_fcfa: number | null;
  message: string | null;
  status: OfferStatus;
  auto_decided: boolean;
  expires_at: string;
  pay_by: string | null;
  responded_at: string | null;
  order_id: string | null;
  created_at: string;
};

const OFFER_COLUMNS =
  "id, product_id, shop_id, buyer_id, amount_fcfa, counter_fcfa, agreed_fcfa, message, status, auto_decided, expires_at, pay_by, responded_at, order_id, created_at";

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

// Time-based expiry is worked out when reading, so nothing depends on a
// background job having run.
export function effectiveOfferStatus(o: Pick<OfferRow, "status" | "expires_at" | "pay_by">, now = Date.now()): OfferStatus {
  if ((o.status === "pending" || o.status === "countered") && new Date(o.expires_at).getTime() < now) return "expired";
  if (o.status === "accepted" && o.pay_by && new Date(o.pay_by).getTime() < now) return "expired";
  return o.status;
}

// "code" lets the page show the message in the buyer's language;
// "error" is the English fallback.
export type OfferErrorCode =
  | "unavailable" | "no_offers" | "own_item" | "shop_closed" | "sold_out" | "no_amount" | "full_price"
  | "too_low" | "too_many" | "already_open" | "failed" | "not_found" | "closed" | "counter_range"
  | "login" | "paid" | "pay_expired";
type Fail = { ok: false; error: string; status: number; code: OfferErrorCode; amount?: number; max?: number };
const fail = (code: OfferErrorCode, error: string, status: number, extra?: { amount?: number; max?: number }): Fail => ({
  ok: false,
  code,
  error,
  status,
  ...extra,
});
type Ok = { ok: true; offer: OfferRow };

type ProductForOffer = {
  id: string;
  title: string;
  shop_id: string;
  price_fcfa: number;
  sale_price_fcfa: number | null;
  stock_quantity: number;
  accepts_offers: boolean;
  shop: { owner_id: string; is_open: boolean; shop_name: string } | null;
};

async function loadProduct(admin: SupabaseClient, productId: string): Promise<ProductForOffer | null> {
  const { data } = await admin
    .from("products")
    .select("id, title, shop_id, price_fcfa, sale_price_fcfa, stock_quantity, accepts_offers, is_active, shop:shops(owner_id, is_open, shop_name)")
    .eq("id", productId)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  const shop = (Array.isArray(data.shop) ? data.shop[0] : data.shop) as ProductForOffer["shop"];
  return { ...(data as unknown as ProductForOffer), shop };
}

export const listPrice = (p: { price_fcfa: number; sale_price_fcfa: number | null }) => p.sale_price_fcfa ?? p.price_fcfa;

// Offers show up in the buyer <-> shop chat too, so the whole haggle
// lives in one conversation next to any questions about the item.
async function postChatLine(
  admin: SupabaseClient,
  input: { shopId: string; buyerId: string; productId: string; senderRole: "buyer" | "seller"; senderId: string; body: string }
) {
  try {
    let conversationId: string | null = null;
    const { data: existing } = await admin
      .from("conversations")
      .select("id")
      .eq("shop_id", input.shopId)
      .eq("buyer_id", input.buyerId)
      .maybeSingle();
    if (existing) conversationId = existing.id;
    else {
      const { data: created } = await admin
        .from("conversations")
        .insert({ shop_id: input.shopId, buyer_id: input.buyerId, product_id: input.productId })
        .select("id")
        .single();
      conversationId = created?.id ?? null;
    }
    if (!conversationId) return;
    await admin.from("messages").insert({
      conversation_id: conversationId,
      sender_role: input.senderRole,
      sender_id: input.senderId,
      body: input.body.slice(0, 1000),
    });
  } catch (err) {
    console.error("offer chat line failed:", err instanceof Error ? err.message : err);
  }
}

const CHAT: Record<Lang, Record<"made" | "accepted" | "countered" | "declined" | "acceptedCounter" | "instant", (a: string, t: string) => string>> = {
  en: {
    made: (a, t) => `Offer: ${a} for "${t}".`,
    instant: (a, t) => `Offer: ${a} for "${t}" — accepted instantly.`,
    accepted: (a, t) => `Offer accepted: ${a} for "${t}". You have 48 hours to pay.`,
    countered: (a, t) => `Counter-offer: ${a} for "${t}".`,
    declined: (_a, t) => `Offer for "${t}" declined.`,
    acceptedCounter: (a, t) => `Counter-offer accepted: ${a} for "${t}".`,
  },
  fr: {
    made: (a, t) => `Offre : ${a} pour « ${t} ».`,
    instant: (a, t) => `Offre : ${a} pour « ${t} » — acceptée immédiatement.`,
    accepted: (a, t) => `Offre acceptée : ${a} pour « ${t} ». Vous avez 48 heures pour payer.`,
    countered: (a, t) => `Contre-offre : ${a} pour « ${t} ».`,
    declined: (_a, t) => `Offre pour « ${t} » refusée.`,
    acceptedCounter: (a, t) => `Contre-offre acceptée : ${a} pour « ${t} ».`,
  },
};

const BUYER_MAIL: Record<Lang, Record<"accepted" | "countered" | "declined", (c: { amount: string; title: string; shop: string }) => Mail>> = {
  en: {
    accepted: (c) => ({
      subject: `Offer accepted — ${c.title}`,
      title: "Your offer was accepted",
      paragraphs: [
        `${c.shop} accepted ${c.amount} for "${c.title}".`,
        "Pay within 48 hours to lock in this price. Your payment is held by Buyam Sellam until you confirm delivery.",
      ],
      button: { label: "Pay now", path: "/account#offers" },
    }),
    countered: (c) => ({
      subject: `Counter-offer — ${c.title}`,
      title: "The seller made a counter-offer",
      paragraphs: [`${c.shop} proposes ${c.amount} for "${c.title}". Accept it, or make a new offer, within 48 hours.`],
      button: { label: "See the offer", path: "/account#offers" },
    }),
    declined: (c) => ({
      subject: `Offer declined — ${c.title}`,
      title: "Your offer was declined",
      paragraphs: [`${c.shop} declined your offer for "${c.title}". You can still buy it at the listed price, or try a different offer.`],
      button: { label: "See my offers", path: "/account#offers" },
    }),
  },
  fr: {
    accepted: (c) => ({
      subject: `Offre acceptée — ${c.title}`,
      title: "Votre offre a été acceptée",
      paragraphs: [
        `${c.shop} a accepté ${c.amount} pour « ${c.title} ».`,
        "Payez sous 48 heures pour garder ce prix. Votre paiement est gardé par Buyam Sellam jusqu'à votre confirmation de livraison.",
      ],
      button: { label: "Payer maintenant", path: "/account#offers" },
    }),
    countered: (c) => ({
      subject: `Contre-offre — ${c.title}`,
      title: "Le vendeur a fait une contre-offre",
      paragraphs: [`${c.shop} propose ${c.amount} pour « ${c.title} ». Acceptez-la ou faites une nouvelle offre sous 48 heures.`],
      button: { label: "Voir l'offre", path: "/account#offers" },
    }),
    declined: (c) => ({
      subject: `Offre refusée — ${c.title}`,
      title: "Votre offre a été refusée",
      paragraphs: [`${c.shop} a refusé votre offre pour « ${c.title} ». Vous pouvez toujours l'acheter au prix affiché ou proposer une autre offre.`],
      button: { label: "Voir mes offres", path: "/account#offers" },
    }),
  },
};

async function emailBuyer(
  admin: SupabaseClient,
  buyerId: string,
  kind: "accepted" | "countered" | "declined",
  ctx: { amount: number; title: string; shop: string }
) {
  try {
    const { email, lang } = await userEmailAndLang(admin, buyerId);
    if (!email) return;
    const l: Lang = lang ?? "fr";
    const mail = BUYER_MAIL[l][kind]({ amount: formatFcfa(ctx.amount), title: ctx.title, shop: ctx.shop });
    const { text, html } = renderEmail(mail, l);
    await sendMail({ to: email, subject: mail.subject, text, html });
  } catch (err) {
    console.error("offer email failed:", err instanceof Error ? err.message : err);
  }
}

async function buyerLang(admin: SupabaseClient, buyerId: string): Promise<Lang> {
  return (await userEmailAndLang(admin, buyerId)).lang ?? "fr";
}

// Buyer makes an offer. Returns the stored offer, which may already be
// "accepted" (instant-deal price reached) or "declined" (under the floor).
export async function createOffer(
  admin: SupabaseClient,
  input: { buyerId: string; productId: string; amountFcfa: number; message?: string | null }
): Promise<Ok | Fail> {
  const product = await loadProduct(admin, input.productId);
  if (!product || !product.shop) return fail("unavailable", "This item is no longer available.", 404);
  if (!product.accepts_offers) return fail("no_offers", "This seller isn't taking offers on this item.", 409);
  if (product.shop.owner_id === input.buyerId) return fail("own_item", "You can't make an offer on your own item.", 409);
  if (!product.shop.is_open) return fail("shop_closed", "This shop is closed right now.", 409);
  if (product.stock_quantity <= 0) return fail("sold_out", "This item is sold out.", 409);

  const price = listPrice(product);
  const amount = Math.round(Number(input.amountFcfa));
  if (!Number.isFinite(amount) || amount <= 0) return fail("no_amount", "Enter an amount.", 400);
  if (amount >= price) return fail("full_price", "That's the full price — just tap Buy now.", 400);
  const minimum = Math.ceil(price * OFFER_MIN_RATIO);
  if (amount < minimum) {
    return fail("too_low", `Offers start at ${formatFcfa(minimum)} for this item.`, 400, { amount: minimum });
  }

  const { count: previous } = await admin
    .from("offers")
    .select("id", { count: "exact", head: true })
    .eq("product_id", product.id)
    .eq("buyer_id", input.buyerId);
  if ((previous ?? 0) >= MAX_OFFERS_PER_PRODUCT) {
    return fail("too_many", "You've already made 3 offers on this item. Buy it at the listed price or message the seller.", 429);
  }

  // An open offer that has run out of time no longer blocks a new one.
  await admin
    .from("offers")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("product_id", product.id)
    .eq("buyer_id", input.buyerId)
    .in("status", ["pending", "countered"])
    .lt("expires_at", new Date().toISOString());

  const { data: settings } = await admin
    .from("product_offer_settings")
    .select("autoaccept_fcfa, floor_fcfa")
    .eq("product_id", product.id)
    .maybeSingle();

  const now = new Date().toISOString();
  let row: Record<string, unknown> = {
    product_id: product.id,
    shop_id: product.shop_id,
    buyer_id: input.buyerId,
    amount_fcfa: amount,
    message: input.message?.trim().slice(0, 300) || null,
    status: "pending",
    expires_at: hoursFromNow(RESPOND_HOURS),
  };
  if (settings?.floor_fcfa && amount < settings.floor_fcfa) {
    row = { ...row, status: "declined", auto_decided: true, responded_at: now };
  } else if (settings?.autoaccept_fcfa && amount >= settings.autoaccept_fcfa) {
    row = { ...row, status: "accepted", agreed_fcfa: amount, auto_decided: true, responded_at: now, pay_by: hoursFromNow(PAY_HOURS) };
  }

  const { data: offer, error } = await admin.from("offers").insert(row).select(OFFER_COLUMNS).single();
  if (error || !offer) {
    if (error?.code === "23505") return fail("already_open", "You already have an open offer on this item.", 409);
    return fail("failed", "Could not send your offer. Please try again.", 500);
  }

  const lang = await buyerLang(admin, input.buyerId);
  const amountText = formatFcfa(amount);
  if (offer.status === "declined") {
    // Nothing for the seller to do; the buyer sees the answer immediately.
    return { ok: true, offer: offer as OfferRow };
  }
  await postChatLine(admin, {
    shopId: product.shop_id,
    buyerId: input.buyerId,
    productId: product.id,
    senderRole: "buyer",
    senderId: input.buyerId,
    body: (offer.status === "accepted" ? CHAT[lang].instant : CHAT[lang].made)(amountText, product.title),
  });
  await notifyShop(admin, {
    shopId: product.shop_id,
    type: "offer",
    title: offer.status === "accepted" ? "Instant deal — offer accepted" : "New offer",
    body:
      offer.status === "accepted"
        ? `${amountText} offered for "${product.title}" reached your instant-deal price. The buyer has 48 hours to pay.`
        : `${amountText} offered for "${product.title}" (listed at ${formatFcfa(price)}). Answer within 48 hours.`,
  });
  return { ok: true, offer: offer as OfferRow };
}

async function loadOffer(admin: SupabaseClient, offerId: string) {
  const { data } = await admin
    .from("offers")
    .select(`${OFFER_COLUMNS}, product:products(title, price_fcfa, sale_price_fcfa, stock_quantity), shop:shops(owner_id, shop_name)`)
    .eq("id", offerId)
    .maybeSingle();
  if (!data) return null;
  const product = (Array.isArray(data.product) ? data.product[0] : data.product) as {
    title: string;
    price_fcfa: number;
    sale_price_fcfa: number | null;
    stock_quantity: number;
  } | null;
  const shop = (Array.isArray(data.shop) ? data.shop[0] : data.shop) as { owner_id: string; shop_name: string } | null;
  return { offer: data as unknown as OfferRow, product, shop };
}

// Seller answers a pending offer.
export async function respondToOffer(
  admin: SupabaseClient,
  input: { userId: string; offerId: string; action: "accept" | "decline" | "counter"; counterFcfa?: number }
): Promise<Ok | Fail> {
  const loaded = await loadOffer(admin, input.offerId);
  if (!loaded || loaded.shop?.owner_id !== input.userId || !loaded.product) {
    return fail("not_found", "Offer not found.", 404);
  }
  const { offer, product, shop } = loaded;
  if (effectiveOfferStatus(offer) !== "pending") {
    return fail("closed", "This offer can't be answered any more.", 409);
  }
  const now = new Date().toISOString();
  let patch: Record<string, unknown>;
  if (input.action === "accept") {
    patch = { status: "accepted", agreed_fcfa: offer.amount_fcfa, pay_by: hoursFromNow(PAY_HOURS) };
  } else if (input.action === "decline") {
    patch = { status: "declined" };
  } else {
    const counter = Math.round(Number(input.counterFcfa));
    const price = listPrice(product);
    if (!Number.isFinite(counter) || counter <= offer.amount_fcfa || counter >= price) {
      return fail(
        "counter_range",
        `A counter-offer must be between ${formatFcfa(offer.amount_fcfa + 1)} and ${formatFcfa(price - 1)}.`,
        400,
        { amount: offer.amount_fcfa + 1, max: price - 1 }
      );
    }
    patch = { status: "countered", counter_fcfa: counter, expires_at: hoursFromNow(RESPOND_HOURS) };
  }
  const { data: updated } = await admin
    .from("offers")
    .update({ ...patch, responded_at: now, updated_at: now })
    .eq("id", offer.id)
    .eq("status", "pending")
    .select(OFFER_COLUMNS)
    .maybeSingle();
  if (!updated) return fail("closed", "This offer was already answered.", 409);

  const shopName = shop?.shop_name ?? "Buyam Sellam";
  const lang = await buyerLang(admin, offer.buyer_id);
  const amount = input.action === "counter" ? (updated.counter_fcfa as number) : offer.amount_fcfa;
  const kind = input.action === "accept" ? "accepted" : input.action === "counter" ? "countered" : "declined";
  await postChatLine(admin, {
    shopId: offer.shop_id,
    buyerId: offer.buyer_id,
    productId: offer.product_id,
    senderRole: "seller",
    senderId: input.userId,
    body: CHAT[lang][kind](formatFcfa(amount), product.title),
  });
  await emailBuyer(admin, offer.buyer_id, kind, { amount, title: product.title, shop: shopName });
  return { ok: true, offer: updated as OfferRow };
}

// Buyer accepts a counter-offer, turns it down, or withdraws an offer.
export async function buyerOfferAction(
  admin: SupabaseClient,
  input: { userId: string; offerId: string; action: "accept_counter" | "decline_counter" | "withdraw" }
): Promise<Ok | Fail> {
  const loaded = await loadOffer(admin, input.offerId);
  if (!loaded || loaded.offer.buyer_id !== input.userId || !loaded.product) {
    return fail("not_found", "Offer not found.", 404);
  }
  const { offer, product } = loaded;
  const status = effectiveOfferStatus(offer);
  const now = new Date().toISOString();

  if (input.action === "accept_counter") {
    if (status !== "countered" || !offer.counter_fcfa) return fail("closed", "This counter-offer has expired.", 409);
    const { data: updated } = await admin
      .from("offers")
      .update({ status: "accepted", agreed_fcfa: offer.counter_fcfa, pay_by: hoursFromNow(PAY_HOURS), updated_at: now })
      .eq("id", offer.id)
      .eq("status", "countered")
      .select(OFFER_COLUMNS)
      .maybeSingle();
    if (!updated) return fail("closed", "This counter-offer has expired.", 409);
    const lang = await buyerLang(admin, offer.buyer_id);
    await postChatLine(admin, {
      shopId: offer.shop_id,
      buyerId: offer.buyer_id,
      productId: offer.product_id,
      senderRole: "buyer",
      senderId: input.userId,
      body: CHAT[lang].acceptedCounter(formatFcfa(offer.counter_fcfa), product.title),
    });
    await notifyShop(admin, {
      shopId: offer.shop_id,
      type: "offer",
      title: "Counter-offer accepted",
      body: `The buyer accepted ${formatFcfa(offer.counter_fcfa)} for "${product.title}". They have 48 hours to pay.`,
    });
    return { ok: true, offer: updated as OfferRow };
  }

  const allowed = input.action === "withdraw" ? ["pending", "countered", "accepted"] : ["countered"];
  if (!allowed.includes(status)) return fail("closed", "This offer is already closed.", 409);
  const { data: updated } = await admin
    .from("offers")
    .update({ status: input.action === "withdraw" ? "withdrawn" : "declined", updated_at: now })
    .eq("id", offer.id)
    .in("status", allowed)
    .select(OFFER_COLUMNS)
    .maybeSingle();
  if (!updated) return fail("closed", "This offer is already closed.", 409);
  return { ok: true, offer: updated as OfferRow };
}

// Checkout at an agreed price: only for the buyer who made the deal,
// only for that product, only before the pay-by time.
export async function resolveAgreedOffer(
  admin: SupabaseClient,
  input: { offerId: string; buyerId: string | null; productId: string }
): Promise<{ ok: true; unitPriceFcfa: number } | Fail> {
  if (!input.buyerId) return fail("login", "Log in to pay the price you agreed.", 401);
  const { data } = await admin.from("offers").select(OFFER_COLUMNS).eq("id", input.offerId).maybeSingle();
  const offer = data as OfferRow | null;
  if (!offer || offer.buyer_id !== input.buyerId || offer.product_id !== input.productId) {
    return fail("not_found", "This offer isn't available.", 404);
  }
  const status = effectiveOfferStatus(offer);
  if (status === "paid") return fail("paid", "This offer has already been paid.", 409);
  if (status !== "accepted" || !offer.agreed_fcfa) {
    return fail("pay_expired", "The time to pay this offer has passed. You can make a new offer.", 409);
  }
  return { ok: true, unitPriceFcfa: offer.agreed_fcfa };
}
