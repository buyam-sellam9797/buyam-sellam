import { NextRequest, NextResponse, after } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { sendOrderEmails } from "@/lib/order-emails";

// The seller's two actions on a paid order — "Accept" (I'm preparing
// it) and "Mark as sent" — done on the server so the buyer can be
// emailed at the same moment. Only the owner of the order's shop can
// call it, and each action only applies from the right state, so
// repeating a click never sends a second email.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "Server is not configured." }, { status: 500 });

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const { data: userData } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { data: order } = await admin
    .from("orders")
    .select("id, status, accepted_at, shop:shops(owner_id)")
    .eq("id", id)
    .maybeSingle();
  const shop = (Array.isArray(order?.shop) ? order?.shop[0] : order?.shop) as { owner_id: string } | null | undefined;
  if (!order || shop?.owner_id !== user.id) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const now = new Date().toISOString();
  if (body.action === "accept") {
    const { data: updated } = await admin
      .from("orders")
      .update({ accepted_at: now })
      .eq("id", id)
      .is("accepted_at", null)
      .select("id")
      .maybeSingle();
    if (updated) after(() => sendOrderEmails(admin, id, "accepted"));
    return NextResponse.json({ ok: true });
  }

  if (body.action === "ship") {
    const { data: updated } = await admin
      .from("orders")
      .update({ status: "shipped", shipped_at: now, updated_at: now })
      .eq("id", id)
      .eq("status", "paid_held")
      .select("id")
      .maybeSingle();
    if (!updated) {
      return NextResponse.json({ error: "This order can't be marked as sent right now." }, { status: 409 });
    }
    after(() => sendOrderEmails(admin, id, "shipped"));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
