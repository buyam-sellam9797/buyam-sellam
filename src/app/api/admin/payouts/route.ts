import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/admin-auth";
import { notifyShop } from "@/lib/supabase-admin";
import { calculateCommission } from "@/lib/commission";
import { formatFcfa } from "@/lib/format";

// Lists every order that's ready for a real-world payout: the buyer
// confirmed receipt (status = completed) but Lio hasn't sent the
// seller their money yet (payout_sent = false).
export async function GET(req: NextRequest) {
  const check = await requireAdmin(req);
  if ("error" in check) {
    return adminErrorResponse(check);
  }

  const { data, error } = await check.admin
    .from("orders")
    .select(
      "id, total_amount_fcfa, buyer_phone, created_at, shop:shops(shop_name, whatsapp_number, payout_provider, payout_phone_number)"
    )
    .eq("status", "completed")
    .eq("payout_sent", false)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Could not load payouts." }, { status: 500 });
  }

  return NextResponse.json({ orders: data ?? [] });
}

// Lio taps "Mark paid" once she's actually sent the seller their money
// by hand (mobile money transfer outside the platform, for now).
export async function POST(req: NextRequest) {
  const check = await requireAdmin(req);
  if ("error" in check) {
    return adminErrorResponse(check);
  }

  let body: { orderId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.orderId) {
    return NextResponse.json({ error: "Missing orderId." }, { status: 400 });
  }

  const { data: updated, error } = await check.admin
    .from("orders")
    .update({ payout_sent: true, payout_sent_at: new Date().toISOString() })
    .eq("id", body.orderId)
    .eq("status", "completed")
    .select("id, shop_id, total_amount_fcfa")
    .maybeSingle();

  if (error || !updated) {
    return NextResponse.json({ error: "Could not update this order." }, { status: 500 });
  }

  const { sellerPayoutFcfa } = calculateCommission(updated.total_amount_fcfa);
  await notifyShop(check.admin, {
    shopId: updated.shop_id,
    type: "payout_released",
    title: "Payout sent",
    body: `${formatFcfa(sellerPayoutFcfa)} has been sent to your mobile money number for this order.`,
    orderId: updated.id,
  });

  return NextResponse.json({ ok: true });
}
