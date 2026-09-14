import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";

// Guest order recovery: buyers never create an account, so a lost
// order link has no other way back. This looks orders up by the phone
// number given at checkout and returns only a short summary — never
// delivery_name/address/notes — because a phone number is far easier
// to guess or share than an order's UUID. Full order details remain
// reachable only through the existing unguarded /order/[id] page, so
// this keeps the same risk model as today rather than widening it.
export async function POST(req: NextRequest) {
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  let body: { phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const phone = body.phone?.trim();
  if (!phone) {
    return NextResponse.json({ error: "Enter the phone number used at checkout." }, { status: 400 });
  }

  const { data: orders, error } = await admin
    .from("orders")
    .select("id, status, total_amount_fcfa, created_at, shop:shops(shop_name)")
    .eq("buyer_phone", phone)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: "Could not look up orders right now." }, { status: 500 });
  }

  return NextResponse.json({ orders: orders ?? [] });
}
