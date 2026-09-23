import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/admin-auth";
import { isMailConfigured, sendMail } from "@/lib/smtp";

// Admin → Settings → "Send test email": sends one message to the
// signed-in admin's own address, to check the SMTP settings in Vercel
// (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD) actually work.
export async function POST(req: NextRequest) {
  const check = await requireAdmin(req);
  if ("error" in check) return adminErrorResponse(check);

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { data } = await check.admin.auth.getUser(token);
  const to = data?.user?.email;
  if (!to) return NextResponse.json({ error: "Your account has no email address." }, { status: 400 });

  if (!isMailConfigured()) {
    return NextResponse.json({ error: "Email isn't configured: SMTP_HOST, SMTP_USER or SMTP_PASSWORD is missing in Vercel." }, { status: 500 });
  }
  try {
    await sendMail({
      to,
      subject: "Buyam Sellam test email",
      text: "This is a test from Buyam Sellam. If you can read it, order emails are working.",
      html: "<p style=\"font-family:Arial,sans-serif\">This is a test from <b>Buyam Sellam</b>. If you can read it, order emails are working.</p>",
    });
    return NextResponse.json({ ok: true, to });
  } catch (err) {
    return NextResponse.json({ error: `Sending failed: ${err instanceof Error ? err.message : "unknown error"}` }, { status: 502 });
  }
}
