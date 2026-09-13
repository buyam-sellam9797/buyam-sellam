import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";

// Public order-status endpoint used by the buyer-facing /order/[id]
// page. An order id (UUID) is hard to guess, but this route still
// only ever returns the handful of fields a buyer needs to see, and
// only allows the one write it exists for (confirming receipt) — it
// never lets a caller set arbitrary columns the way a public RLS
// write policy on the whole table would.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  const { data: order, error } = await admin
    .from("orders")
    .select("id, status, total_amount_fcfa, created_at, shop:shops(shop_name)")
    .eq("id", id)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  return NextResponse.json({ order });
}

// The buyer taps "I received my order" on that page, which calls this
// with { action: "confirm" }. Only a shipped -> completed transition
// is allowed, so this can never be used to fabricate a payment or
// skip straight from "held" to "completed".
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (body.action !== "confirm") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  const { data: updated, error } = await admin
    .from("orders")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "shipped")
    .select("id, status, total_amount_fcfa, created_at, shop:shops(shop_name)")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Could not confirm this order." }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json(
      { error: "This order can't be confirmed right now — it may not be marked shipped yet, or was already confirmed." },
      { status: 409 }
    );
  }

  return NextResponse.json({ order: updated });
}
