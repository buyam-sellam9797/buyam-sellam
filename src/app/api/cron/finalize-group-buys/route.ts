import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { expireGroupBuy } from "@/lib/order-fulfillment";

// Vercel calls this daily (see vercel.json), the same way
// auto-confirm-orders handles shipped-but-unconfirmed orders. A
// campaign that reaches its target is finalized immediately, right
// after the join that tips it over (see tryFinalizeGroupBuy) — this
// route only ever has to handle the other outcome: a campaign whose
// deadline passed while it was still short of its target.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  if (!expected || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  const { data: expired } = await admin
    .from("group_buys")
    .select("id")
    .eq("status", "open")
    .lt("deadline", new Date().toISOString());

  for (const g of expired ?? []) {
    await expireGroupBuy(admin, g.id);
  }

  return NextResponse.json({ expired: expired?.length ?? 0 });
}
