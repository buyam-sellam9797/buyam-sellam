import { NextRequest, NextResponse, after } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { sendOrderEmails } from "@/lib/order-emails";
import { MAX_HANDOVER_ATTEMPTS } from "@/lib/order-secrets";

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

  let body: { action?: string; code?: string };
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

  if (body.action === "handover") {
    // The buyer gives the seller their 4-digit code only once they have
    // the item; entering it confirms delivery straight away.
    if (!["paid_held", "shipped"].includes(order.status)) {
      return NextResponse.json({ error: "This order can't be confirmed right now." }, { status: 409 });
    }
    // Checked and counted inside one locked database call, so firing
    // many guesses at once can't get past the attempt limit.
    const code = String(body.code ?? "").replace(/\D/g, "").slice(0, 8);
    const { data: verdict } = await admin.rpc("check_handover_code", { p_order: id, p_code: code, p_max: MAX_HANDOVER_ATTEMPTS });
    if (verdict === "missing") return NextResponse.json({ error: "No delivery code for this order." }, { status: 409 });
    if (verdict === "locked") return NextResponse.json({ error: "locked" }, { status: 429 });
    if (typeof verdict === "string" && verdict.startsWith("wrong:")) {
      return NextResponse.json({ error: "wrong", attemptsLeft: Number(verdict.slice(6)) }, { status: 400 });
    }
    if (verdict !== "ok") return NextResponse.json({ error: "Could not check the code. Try again." }, { status: 500 });
    const { data: updated } = await admin
      .from("orders")
      .update({ status: "completed", completed_at: now, updated_at: now })
      .eq("id", id)
      .in("status", ["paid_held", "shipped"])
      .select("id, shipped_at")
      .maybeSingle();
    if (!updated) return NextResponse.json({ error: "This order can't be confirmed right now." }, { status: 409 });
    if (!updated.shipped_at) await admin.from("orders").update({ shipped_at: now }).eq("id", id);
    after(() => sendOrderEmails(admin, id, "completed"));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
