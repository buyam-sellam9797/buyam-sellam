import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/admin-auth";

// Every order on the platform, newest first — the admin's single view
// into what's actually happening across every shop, not just one
// seller's own dashboard. Capped at 200 so this stays fast; a proper
// paginated/filterable view is a later upgrade once volume needs it.
export async function GET(req: NextRequest) {
  const check = await requireAdmin(req);
  if ("error" in check) return adminErrorResponse(check);

  const { data, error } = await check.admin
    .from("orders")
    .select(
      "id, status, total_amount_fcfa, buyer_phone, payout_sent, created_at, shop:shops(shop_name)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: "Could not load orders." }, { status: 500 });
  }
  return NextResponse.json({ orders: data ?? [] });
}
