import { NextRequest, NextResponse, after } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/admin-auth";
import { notifyShop } from "@/lib/supabase-admin";
import { sendMail } from "@/lib/smtp";
import { renderEmail, userEmailAndLang, type Lang } from "@/lib/order-emails";

// Admin: Signature applications to review, and the decision on one.
export async function GET(req: NextRequest) {
  const check = await requireAdmin(req);
  if ("error" in check) return adminErrorResponse(check);
  const { data } = await check.admin
    .from("shops")
    .select(
      "id, shop_name, slug, city, is_verified, signature_status, signature_kind, signature_story, signature_founder, signature_founded_year, signature_audience, signature_proof_url, made_in_cameroon, signature_applied_at, signature_reviewed_at, signature_note, instagram_url, facebook_url, tiktok_url"
    )
    .in("signature_status", ["pending", "approved", "rejected"])
    .order("signature_applied_at", { ascending: false })
    .limit(100);
  return NextResponse.json({ shops: data ?? [] });
}

export async function POST(req: NextRequest) {
  const check = await requireAdmin(req);
  if ("error" in check) return adminErrorResponse(check);
  const admin = check.admin;
  let body: { shopId?: string; decision?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const decision = body.decision;
  if (!body.shopId || !["approved", "rejected", "none"].includes(decision ?? "")) {
    return NextResponse.json({ error: "Missing shop or decision." }, { status: 400 });
  }
  const note = (body.note ?? "").trim().slice(0, 500) || null;
  const { data: shop } = await admin
    .from("shops")
    .update({ signature_status: decision, signature_reviewed_at: new Date().toISOString(), signature_note: note })
    .eq("id", body.shopId)
    .select("id, owner_id, shop_name")
    .maybeSingle();
  if (!shop) return NextResponse.json({ error: "Shop not found." }, { status: 404 });

  if (decision === "approved" || decision === "rejected") {
    await notifyShop(admin, {
      shopId: shop.id,
      type: "signature",
      title: decision === "approved" ? "Your shop is now Signature" : "Signature application not approved",
      body: decision === "approved" ? "Your seal, story and homepage spot are live." : note ?? "You can update your story and apply again.",
    });
    const ownerId = shop.owner_id as string;
    after(async () => {
      try {
        const { email, lang } = await userEmailAndLang(admin, ownerId);
        if (!email) return;
        const l: Lang = lang ?? "fr";
        const approved = decision === "approved";
        const mail =
          l === "fr"
            ? {
                subject: approved ? "Votre boutique est maintenant Signature" : "Votre demande Signature",
                title: approved ? "Bienvenue dans Buyam Sellam Signature" : "Votre demande n'a pas été retenue pour l'instant",
                paragraphs: approved
                  ? [`${shop.shop_name} porte désormais le sceau Signature. Votre histoire apparaît sur votre boutique et vous êtes mis en avant sur la page d'accueil et sur /signature.`]
                  : [note ?? "Nous n'avons pas pu vérifier assez d'éléments.", "Vous pouvez compléter votre histoire et vos liens, puis refaire une demande depuis votre tableau de bord."],
                button: { label: approved ? "Voir ma boutique" : "Mon tableau de bord", path: "/dashboard" },
              }
            : {
                subject: approved ? "Your shop is now Signature" : "Your Signature application",
                title: approved ? "Welcome to Buyam Sellam Signature" : "Your application wasn't approved for now",
                paragraphs: approved
                  ? [`${shop.shop_name} now carries the Signature seal. Your story shows on your shop, and you're featured on the homepage and on /signature.`]
                  : [note ?? "We couldn't verify enough about you yet.", "You can complete your story and links, then apply again from your dashboard."],
                button: { label: approved ? "View my shop" : "My dashboard", path: "/dashboard" },
              };
        const { text, html } = renderEmail(mail, l);
        await sendMail({ to: email, subject: mail.subject, text, html });
      } catch (err) {
        console.error("signature decision email failed:", err instanceof Error ? err.message : err);
      }
    });
  }
  return NextResponse.json({ ok: true });
}
