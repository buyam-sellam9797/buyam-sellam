import type { SupabaseClient } from "@supabase/supabase-js";
import { sendMail } from "@/lib/smtp";
import { formatFcfa } from "@/lib/format";
import { renderEmail, userEmailAndLang, type Lang, type Mail } from "@/lib/order-emails";

// Automatic emails triggered when a seller saves a product:
//  - "Back in stock" to everyone on that product's waitlist who left an
//    email (or has an account), once the product has stock again.
//  - "New from <shop>" to the shop's followers when new products are
//    added, at most once every 12 hours per shop, listing what's new.
// Everything is idempotent (waitlist rows get notified_at, products get
// announced_at), so calling this twice never sends twice.

const DROP_EMAIL_GAP_HOURS = 12;
const NEW_PRODUCT_WINDOW_HOURS = 24;
const MAX_EMAILS_PER_RUN = 150;

type ProductRow = {
  id: string;
  title: string;
  shop_id: string;
  stock_quantity: number;
  is_active: boolean;
  created_at: string;
  announced_at: string | null;
  price_fcfa: number;
  sale_price_fcfa: number | null;
};

const priceOf = (p: Pick<ProductRow, "price_fcfa" | "sale_price_fcfa">) =>
  formatFcfa(p.sale_price_fcfa != null && p.sale_price_fcfa < p.price_fcfa ? p.sale_price_fcfa : p.price_fcfa);

const RESTOCK: Record<Lang, (title: string, shop: string, price: string, productId: string) => Mail> = {
  en: (title, shop, price, id) => ({
    subject: `Back in stock: ${title}`,
    title: "It's back in stock",
    paragraphs: [
      `Good news — ${title} from ${shop} is available again (${price}).`,
      "Stock can go quickly, so order soon if you still want it. Your payment is held safely until you confirm delivery.",
    ],
    button: { label: "View the product", path: `/product/${id}` },
    footer: "You asked Buyam Sellam to tell you when this item was back. This is a one-time email.",
  }),
  fr: (title, shop, price, id) => ({
    subject: `De nouveau disponible : ${title}`,
    title: "C'est de nouveau disponible",
    paragraphs: [
      `Bonne nouvelle — ${title} chez ${shop} est de nouveau disponible (${price}).`,
      "Le stock peut partir vite : commandez bientôt si vous le voulez toujours. Votre paiement est gardé en sécurité jusqu'à votre confirmation de livraison.",
    ],
    button: { label: "Voir le produit", path: `/product/${id}` },
    footer: "Vous avez demandé à Buyam Sellam d'être prévenu du retour de cet article. Cet e-mail est unique.",
  }),
};

const DROP: Record<Lang, (shop: string, slug: string, lines: string[]) => Mail> = {
  en: (shop, slug, lines) => ({
    subject: `New from ${shop}`,
    title: `${shop} just added new items`,
    paragraphs: [...lines, "Pay by MTN MoMo or Orange Money — your money is held safely until you confirm delivery."],
    button: { label: "Visit the shop", path: `/shop/${slug}` },
    footer: `You follow ${shop} on Buyam Sellam. To stop these emails, open the shop and tap “Following”.`,
  }),
  fr: (shop, slug, lines) => ({
    subject: `Nouveautés chez ${shop}`,
    title: `${shop} vient d'ajouter des articles`,
    paragraphs: [...lines, "Payez par MTN MoMo ou Orange Money — votre argent est gardé en sécurité jusqu'à votre confirmation de livraison."],
    button: { label: "Voir la boutique", path: `/shop/${slug}` },
    footer: `Vous suivez ${shop} sur Buyam Sellam. Pour ne plus recevoir ces e-mails, ouvrez la boutique et appuyez sur « Abonné ».`,
  }),
};

async function send(to: string, mail: Mail, lang: Lang) {
  const { text, html } = renderEmail(mail, lang);
  try {
    await sendMail({ to, subject: mail.subject, text, html, replyTo: "support@buyamsellam.shop" });
    return true;
  } catch (err) {
    console.error(`shop alert to ${to} failed:`, err instanceof Error ? err.message : err);
    return false;
  }
}

async function sendRestockEmails(admin: SupabaseClient, product: ProductRow, shopName: string) {
  const { data: waiting } = await admin
    .from("restock_requests")
    .select("id, buyer_id, contact_email, locale")
    .eq("product_id", product.id)
    .is("notified_at", null)
    .limit(MAX_EMAILS_PER_RUN);

  for (const row of waiting ?? []) {
    const account = row.buyer_id ? await userEmailAndLang(admin, row.buyer_id) : { email: null, lang: null };
    const email = (row.contact_email as string | null) || account.email;
    // Phone-only guests stay on the seller's WhatsApp list in the dashboard.
    if (!email) continue;
    const lang: Lang = row.locale === "en" ? "en" : row.locale === "fr" ? "fr" : account.lang ?? "fr";
    const ok = await send(email, RESTOCK[lang](product.title, shopName, priceOf(product), product.id), lang);
    if (ok) await admin.from("restock_requests").update({ notified_at: new Date().toISOString() }).eq("id", row.id);
  }
}

async function sendDropEmails(admin: SupabaseClient, shop: { id: string; shop_name: string; slug: string; last_drop_email_at: string | null }) {
  const now = Date.now();
  if (shop.last_drop_email_at && now - new Date(shop.last_drop_email_at).getTime() < DROP_EMAIL_GAP_HOURS * 3600_000) return;

  const since = new Date(now - NEW_PRODUCT_WINDOW_HOURS * 3600_000).toISOString();
  const { data: fresh } = await admin
    .from("products")
    .select("id, title, price_fcfa, sale_price_fcfa")
    .eq("shop_id", shop.id)
    .eq("is_active", true)
    .is("announced_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(6);
  if (!fresh || fresh.length === 0) return;

  // Claim this announcement first so a second call can't send it again.
  const { data: claimed } = await admin
    .from("shops")
    .update({ last_drop_email_at: new Date(now).toISOString() })
    .eq("id", shop.id)
    .or(`last_drop_email_at.is.null,last_drop_email_at.lt.${new Date(now - DROP_EMAIL_GAP_HOURS * 3600_000).toISOString()}`)
    .select("id")
    .maybeSingle();
  if (!claimed) return;
  await admin
    .from("products")
    .update({ announced_at: new Date(now).toISOString() })
    .in("id", fresh.map((p) => p.id));

  const { data: follows } = await admin.from("shop_follows").select("user_id").eq("shop_id", shop.id).limit(MAX_EMAILS_PER_RUN);
  for (const f of follows ?? []) {
    const account = await userEmailAndLang(admin, f.user_id as string);
    if (!account.email) continue;
    const lang: Lang = account.lang ?? "fr";
    const lines = fresh.map((p) => `• ${p.title} — ${priceOf(p as ProductRow)}`);
    await send(account.email, DROP[lang](shop.shop_name, shop.slug, lines), lang);
  }
}

export async function processProductEvents(admin: SupabaseClient, productId: string): Promise<void> {
  try {
    const { data: product } = await admin
      .from("products")
      .select("id, title, shop_id, stock_quantity, is_active, created_at, announced_at, price_fcfa, sale_price_fcfa")
      .eq("id", productId)
      .maybeSingle();
    if (!product || !product.is_active) return;
    const { data: shop } = await admin
      .from("shops")
      .select("id, shop_name, slug, last_drop_email_at")
      .eq("id", product.shop_id)
      .maybeSingle();
    if (!shop) return;

    if (product.stock_quantity > 0) await sendRestockEmails(admin, product as ProductRow, shop.shop_name);
    if (!product.announced_at) await sendDropEmails(admin, shop);
  } catch (err) {
    console.error("processProductEvents failed:", err instanceof Error ? err.message : err);
  }
}
