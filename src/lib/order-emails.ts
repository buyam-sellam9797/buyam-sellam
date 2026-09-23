import type { SupabaseClient } from "@supabase/supabase-js";
import { sendMail } from "@/lib/smtp";
import { formatFcfa } from "@/lib/format";
import { calculateCommission } from "@/lib/commission";
import { getSiteUrl } from "@/lib/site";

// Order emails for buyers and sellers, sent from support@buyamsellam.shop.
// Every call is best-effort: a mail problem is logged and never breaks
// the payment, shipping or confirmation step that triggered it. Callers
// run it inside next/server's after() so the response isn't delayed.

export type OrderEmailEvent = "paid" | "accepted" | "shipped" | "completed" | "disputed" | "payout";
type Lang = "en" | "fr";

const SUPPORT_EMAIL = "support@buyamsellam.shop";

type Ctx = {
  ref: string;
  amount: string;
  payout: string;
  items: string;
  shop: string;
  name: string;
  city: string;
  phone: string;
};

type Mail = { subject: string; title: string; paragraphs: string[]; button?: { label: string; path: string } };

const BUYER: Record<Lang, Partial<Record<OrderEmailEvent, (c: Ctx) => Mail>>> = {
  en: {
    paid: (c) => ({
      subject: `Payment received — order ${c.ref}`,
      title: "Your payment is held safely",
      paragraphs: [
        `Hi ${c.name}, we received your payment of ${c.amount} for ${c.items} from ${c.shop}.`,
        "Buyam Sellam holds the money: the seller is only paid after you confirm delivery. The seller will now prepare your order and contact you through the chat or on WhatsApp to arrange delivery.",
        "Only confirm delivery once you have received and checked your order.",
      ],
      button: { label: "Track my order", path: "/order/{id}" },
    }),
    accepted: (c) => ({
      subject: `${c.shop} is preparing your order ${c.ref}`,
      title: "Your order is being prepared",
      paragraphs: [`${c.shop} has accepted your order (${c.items}) and is preparing it. They will contact you to arrange delivery.`],
      button: { label: "Track my order", path: "/order/{id}" },
    }),
    shipped: (c) => ({
      subject: `Your order ${c.ref} is on its way`,
      title: "Your order is on its way",
      paragraphs: [
        `${c.shop} has marked your order (${c.items}) as sent.`,
        "When it arrives, check it, then tap “I received my order” on your order page. If something is wrong, report the problem before confirming — your payment stays on hold while we look at it.",
        "If you do nothing, the order is confirmed automatically 5 days after it was sent.",
      ],
      button: { label: "Open my order", path: "/order/{id}" },
    }),
    completed: (c) => ({
      subject: `Order ${c.ref} completed — thank you`,
      title: "Thank you for your order",
      paragraphs: [
        `Your order from ${c.shop} is complete. We hope you like ${c.items}.`,
        "A short review helps other buyers and rewards good sellers.",
      ],
      button: { label: "Leave a review", path: "/order/{id}" },
    }),
    disputed: (c) => ({
      subject: `We received your report — order ${c.ref}`,
      title: "We received your report",
      paragraphs: [
        `Thanks for telling us about the problem with your order from ${c.shop}. Your payment stays on hold and is not sent to the seller while we look into it.`,
        "Our team will review the order, the conversation and any photos, and contact you. You can reply to this email if you want to add anything.",
      ],
      button: { label: "Open my order", path: "/order/{id}" },
    }),
  },
  fr: {
    paid: (c) => ({
      subject: `Paiement reçu — commande ${c.ref}`,
      title: "Votre paiement est gardé en sécurité",
      paragraphs: [
        `Bonjour ${c.name}, nous avons reçu votre paiement de ${c.amount} pour ${c.items} chez ${c.shop}.`,
        "Buyam Sellam garde l'argent : le vendeur n'est payé qu'après votre confirmation de livraison. Le vendeur va maintenant préparer votre commande et vous contacter via la messagerie ou WhatsApp pour organiser la livraison.",
        "Ne confirmez la livraison qu'après avoir reçu et vérifié votre commande.",
      ],
      button: { label: "Suivre ma commande", path: "/order/{id}" },
    }),
    accepted: (c) => ({
      subject: `${c.shop} prépare votre commande ${c.ref}`,
      title: "Votre commande est en préparation",
      paragraphs: [`${c.shop} a accepté votre commande (${c.items}) et la prépare. Le vendeur vous contactera pour organiser la livraison.`],
      button: { label: "Suivre ma commande", path: "/order/{id}" },
    }),
    shipped: (c) => ({
      subject: `Votre commande ${c.ref} est en route`,
      title: "Votre commande est en route",
      paragraphs: [
        `${c.shop} a indiqué que votre commande (${c.items}) est envoyée.`,
        "À la réception, vérifiez-la, puis appuyez sur « J'ai reçu ma commande » sur la page de votre commande. En cas de problème, signalez-le avant de confirmer — votre paiement reste bloqué pendant notre examen.",
        "Sans action de votre part, la commande est confirmée automatiquement 5 jours après l'envoi.",
      ],
      button: { label: "Voir ma commande", path: "/order/{id}" },
    }),
    completed: (c) => ({
      subject: `Commande ${c.ref} terminée — merci`,
      title: "Merci pour votre commande",
      paragraphs: [
        `Votre commande chez ${c.shop} est terminée. Nous espérons que ${c.items} vous plaît.`,
        "Un court avis aide les autres acheteurs et récompense les bons vendeurs.",
      ],
      button: { label: "Laisser un avis", path: "/order/{id}" },
    }),
    disputed: (c) => ({
      subject: `Nous avons reçu votre signalement — commande ${c.ref}`,
      title: "Nous avons reçu votre signalement",
      paragraphs: [
        `Merci de nous avoir signalé le problème avec votre commande chez ${c.shop}. Votre paiement reste bloqué et n'est pas versé au vendeur pendant notre examen.`,
        "Notre équipe va examiner la commande, la conversation et les photos, puis vous contacter. Vous pouvez répondre à cet e-mail pour ajouter des informations.",
      ],
      button: { label: "Voir ma commande", path: "/order/{id}" },
    }),
  },
};

const SELLER: Record<Lang, Partial<Record<OrderEmailEvent, (c: Ctx) => Mail>>> = {
  en: {
    paid: (c) => ({
      subject: `New order ${c.ref}: ${c.amount} paid`,
      title: "New order — payment received",
      paragraphs: [
        `A buyer paid ${c.amount} for ${c.items}. The money is held by Buyam Sellam and released to you after the buyer confirms delivery.`,
        `Deliver to: ${c.name}, ${c.city}${c.phone ? ` — ${c.phone}` : ""}. Contact the buyer through the chat or on WhatsApp to arrange delivery, then mark the order as sent in your dashboard.`,
      ],
      button: { label: "Open my dashboard", path: "/dashboard" },
    }),
    completed: (c) => ({
      subject: `Order ${c.ref} completed — payout on its way`,
      title: "Order completed",
      paragraphs: [
        `The order for ${c.items} is complete. Your payout of ${c.payout} (after the 5% commission) is being sent to your mobile money number.`,
      ],
      button: { label: "Open my dashboard", path: "/dashboard" },
    }),
    disputed: (c) => ({
      subject: `A buyer reported a problem — order ${c.ref}`,
      title: "A buyer reported a problem",
      paragraphs: [
        `The buyer of ${c.items} reported a problem. The payment of ${c.amount} stays on hold while the Buyam Sellam team reviews the order.`,
        "Please reply to the buyer in the chat and keep any proof of delivery. We may contact you for details.",
      ],
      button: { label: "Open my dashboard", path: "/dashboard" },
    }),
    payout: (c) => ({
      subject: `Payout sent: ${c.payout} — order ${c.ref}`,
      title: "Payout sent",
      paragraphs: [`${c.payout} has been sent to your mobile money number for the order of ${c.items}.`],
      button: { label: "Open my dashboard", path: "/dashboard" },
    }),
  },
  fr: {
    paid: (c) => ({
      subject: `Nouvelle commande ${c.ref} : ${c.amount} payés`,
      title: "Nouvelle commande — paiement reçu",
      paragraphs: [
        `Un acheteur a payé ${c.amount} pour ${c.items}. L'argent est gardé par Buyam Sellam et vous est versé après la confirmation de livraison par l'acheteur.`,
        `Livrer à : ${c.name}, ${c.city}${c.phone ? ` — ${c.phone}` : ""}. Contactez l'acheteur via la messagerie ou WhatsApp pour organiser la livraison, puis marquez la commande comme envoyée dans votre tableau de bord.`,
      ],
      button: { label: "Ouvrir mon tableau de bord", path: "/dashboard" },
    }),
    completed: (c) => ({
      subject: `Commande ${c.ref} terminée — versement en cours`,
      title: "Commande terminée",
      paragraphs: [
        `La commande de ${c.items} est terminée. Votre versement de ${c.payout} (après la commission de 5 %) est en cours d'envoi sur votre numéro mobile money.`,
      ],
      button: { label: "Ouvrir mon tableau de bord", path: "/dashboard" },
    }),
    disputed: (c) => ({
      subject: `Un acheteur a signalé un problème — commande ${c.ref}`,
      title: "Un acheteur a signalé un problème",
      paragraphs: [
        `L'acheteur de ${c.items} a signalé un problème. Le paiement de ${c.amount} reste bloqué pendant que l'équipe Buyam Sellam examine la commande.`,
        "Répondez à l'acheteur dans la messagerie et gardez toute preuve de livraison. Nous pourrons vous contacter pour plus de détails.",
      ],
      button: { label: "Ouvrir mon tableau de bord", path: "/dashboard" },
    }),
    payout: (c) => ({
      subject: `Versement envoyé : ${c.payout} — commande ${c.ref}`,
      title: "Versement envoyé",
      paragraphs: [`${c.payout} ont été envoyés sur votre numéro mobile money pour la commande de ${c.items}.`],
      button: { label: "Ouvrir mon tableau de bord", path: "/dashboard" },
    }),
  },
};

const FOOTER: Record<Lang, string> = {
  en: "Buyam Sellam — buy and sell safely in Cameroon. Questions? Just reply to this email.",
  fr: "Buyam Sellam — achetez et vendez en sécurité au Cameroun. Des questions ? Répondez simplement à cet e-mail.",
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function render(mail: Mail, lang: Lang, orderId: string) {
  const site = getSiteUrl();
  const url = mail.button ? site + mail.button.path.replace("{id}", orderId) : null;
  const text = [mail.title, "", ...mail.paragraphs, ...(url ? ["", `${mail.button!.label}: ${url}`] : []), "", FOOTER[lang]].join("\n");
  const html = `<!doctype html><html lang="${lang}"><body style="margin:0;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#171717">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e5e5;border-radius:16px">
<tr><td style="padding:24px 28px 0;font-size:20px;font-weight:bold">Buyam<span style="color:#d97706">Sellam</span></td></tr>
<tr><td style="padding:20px 28px 8px"><h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">${escapeHtml(mail.title)}</h1>
${mail.paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#404040">${escapeHtml(p)}</p>`).join("\n")}
${url ? `<p style="margin:20px 0 8px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 22px;border-radius:999px">${escapeHtml(mail.button!.label)}</a></p>` : ""}
</td></tr>
<tr><td style="padding:16px 28px 24px;font-size:12px;line-height:1.5;color:#737373;border-top:1px solid #f0f0f0">${escapeHtml(FOOTER[lang])}</td></tr>
</table></td></tr></table></body></html>`;
  return { text, html };
}

async function userEmailAndLang(
  admin: SupabaseClient,
  userId: string | null
): Promise<{ email: string | null; lang: Lang | null }> {
  if (!userId) return { email: null, lang: null };
  const { data } = await admin.auth.admin.getUserById(userId);
  const user = data?.user;
  const metaLocale = (user?.user_metadata as { locale?: string } | undefined)?.locale;
  return { email: user?.email ?? null, lang: metaLocale === "fr" ? "fr" : metaLocale === "en" ? "en" : null };
}

async function deliver(to: string | null, lang: Lang, build: ((c: Ctx) => Mail) | undefined, ctx: Ctx, orderId: string) {
  if (!to || !build) return;
  const mail = build(ctx);
  const { text, html } = render(mail, lang, orderId);
  try {
    await sendMail({ to, subject: mail.subject, text, html, replyTo: SUPPORT_EMAIL });
  } catch (err) {
    console.error(`order email (${mail.subject}) to ${to} failed:`, err instanceof Error ? err.message : err);
  }
}

export async function sendOrderEmails(admin: SupabaseClient, orderId: string, event: OrderEmailEvent): Promise<void> {
  try {
    const { data: order } = await admin
      .from("orders")
      .select("id, buyer_id, buyer_email, buyer_locale, total_amount_fcfa, delivery_name, delivery_city, delivery_phone, shop:shops(shop_name, owner_id)")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return;

    const { data: items } = await admin.from("order_items").select("quantity, product:products(title)").eq("order_id", orderId);
    const itemText =
      (items ?? [])
        .map((i) => {
          const product = (Array.isArray(i.product) ? i.product[0] : i.product) as { title?: string } | null;
          return `${i.quantity > 1 ? `${i.quantity} × ` : ""}${product?.title ?? ""}`.trim();
        })
        .filter(Boolean)
        .join(", ") || "your order";

    const shop = (Array.isArray(order.shop) ? order.shop[0] : order.shop) as { shop_name: string; owner_id: string } | null;
    const ctx: Ctx = {
      ref: order.id.slice(0, 8).toUpperCase(),
      amount: formatFcfa(order.total_amount_fcfa),
      payout: formatFcfa(calculateCommission(order.total_amount_fcfa).sellerPayoutFcfa),
      items: itemText,
      shop: shop?.shop_name ?? "Buyam Sellam",
      name: order.delivery_name ?? "",
      city: order.delivery_city ?? "",
      phone: order.delivery_phone ?? "",
    };

    const buyerAccount = await userEmailAndLang(admin, order.buyer_id);
    const buyerEmail = order.buyer_email || buyerAccount.email;
    const buyerLang: Lang = order.buyer_locale === "fr" ? "fr" : order.buyer_locale === "en" ? "en" : buyerAccount.lang ?? "fr";

    const seller = await userEmailAndLang(admin, shop?.owner_id ?? null);
    const sellerLang: Lang = seller.lang ?? "fr";

    await Promise.all([
      deliver(buyerEmail, buyerLang, BUYER[buyerLang][event], ctx, order.id),
      deliver(seller.email, sellerLang, SELLER[sellerLang][event], ctx, order.id),
      event === "disputed"
        ? deliver(SUPPORT_EMAIL, "en", (c) => ({
            subject: `[Dispute] Order ${c.ref} — ${c.shop}`,
            title: `Dispute opened on order ${c.ref}`,
            paragraphs: [`Shop: ${c.shop}. Items: ${c.items}. Amount: ${c.amount}. Buyer: ${c.name}, ${c.city} ${c.phone}.`, `Order id: ${order.id}`],
            button: { label: "Open admin", path: "/admin" },
          }), ctx, order.id)
        : Promise.resolve(),
    ]);
  } catch (err) {
    console.error("sendOrderEmails failed:", err instanceof Error ? err.message : err);
  }
}
