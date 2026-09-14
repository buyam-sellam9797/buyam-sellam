import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/admin-auth";

// Every dispute — a buyer's structured "report a problem" — newest
// first, with enough order/shop context for admin to judge it without
// jumping to another screen.
export async function GET(req: NextRequest) {
  const check = await requireAdmin(req);
  if ("error" in check) return adminErrorResponse(check);

  const { data, error } = await check.admin
    .from("disputes")
    .select(
      "id, order_id, shop_id, buyer_phone, reason, description, photo_url, status, resolution, resolved_action, created_at, resolved_at, order:orders(total_amount_fcfa, status), shop:shops(shop_name, whatsapp_number)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Could not load disputes." }, { status: 500 });
  }
  return NextResponse.json({ disputes: data ?? [] });
}

// Admin resolves a dispute one of two ways, matching the Refund Policy:
// "released" means the report didn't hold up (or was settled directly
// with the buyer) and the order goes back to completed so the seller
// can be paid; "refunded" means the buyer is refunded from the held
// payment and the seller is not paid for this order.
export async function POST(req: NextRequest) {
  const check = await requireAdmin(req);
  if ("error" in check) return adminErrorResponse(check);
  const { admin } = check;

  let body: { disputeId?: string; action?: "refunded" | "released"; resolution?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.disputeId || !["refunded", "released"].includes(body.action ?? "")) {
    return NextResponse.json({ error: "Missing disputeId or a valid action." }, { status: 400 });
  }

  const { data: dispute, error: disputeError } = await admin
    .from("disputes")
    .select("id, order_id, status")
    .eq("id", body.disputeId)
    .maybeSingle();
  if (disputeError || !dispute) {
    return NextResponse.json({ error: "Dispute not found." }, { status: 404 });
  }
  if (dispute.status === "resolved") {
    return NextResponse.json({ error: "This dispute is already resolved." }, { status: 409 });
  }

  const { error: updateDisputeError } = await admin
    .from("disputes")
    .update({
      status: "resolved",
      resolved_action: body.action,
      resolution: body.resolution?.trim().slice(0, 1000) || null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", dispute.id);
  if (updateDisputeError) {
    return NextResponse.json({ error: "Could not resolve this dispute." }, { status: 500 });
  }

  const newOrderStatus = body.action === "refunded" ? "refunded" : "completed";
  await admin
    .from("orders")
    .update({ status: newOrderStatus, updated_at: new Date().toISOString() })
    .eq("id", dispute.order_id);

  return NextResponse.json({ ok: true });
}
