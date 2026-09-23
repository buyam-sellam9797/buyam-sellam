import { NextRequest, NextResponse, after } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { sendOrderEmails } from "@/lib/order-emails";

// A shipped order with no response from the buyer would otherwise sit
// forever with the seller never getting paid. Vercel calls this once a
// day (see vercel.json) and it auto-confirms anything that's been
// sitting in "shipped" for 5+ days, exactly like a real marketplace's
// escrow timeout.
const AUTO_CONFIRM_AFTER_DAYS = 5;

export async function GET(req: NextRequest) {
  // Vercel automatically sends this header (using the CRON_SECRET env
  // var) when it triggers a scheduled Cron Job — this stops anyone
  // else from calling the route and force-releasing payments early.
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  if (!expected || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  const cutoff = new Date(
    Date.now() - AUTO_CONFIRM_AFTER_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const nowIso = new Date().toISOString();
  const { data: updated, error } = await admin
    .from("orders")
    .update({ status: "completed", completed_at: nowIso, updated_at: nowIso })
    .eq("status", "shipped")
    .lt("updated_at", cutoff)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const confirmedIds = (updated ?? []).map((o) => o.id as string);
  after(async () => {
    for (const orderId of confirmedIds) await sendOrderEmails(admin, orderId, "completed");
  });

  return NextResponse.json({ autoConfirmed: confirmedIds.length });
}
