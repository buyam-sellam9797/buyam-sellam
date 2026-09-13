import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";

// Every request here must prove it's Lio (or another admin), and that
// check happens on the server against the real database — never just
// by hiding the /admin page in the UI, which anyone could bypass by
// calling this API directly.
async function requireAdmin(req: NextRequest) {
  const admin = getAdminClient();
  if (!admin) return { error: "Server is not configured.", status: 500 } as const;

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return { error: "Not signed in.", status: 401 } as const;

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) {
    return { error: "Not signed in.", status: 401 } as const;
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { error: "You're not authorized to view this page.", status: 403 } as const;
  }

  return { admin } as const;
}

// Lists every order that's ready for a real-world payout: the buyer
// confirmed receipt (status = completed) but Lio hasn't sent the
// seller their money yet (payout_sent = false).
export async function GET(req: NextRequest) {
  const check = await requireAdmin(req);
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { data, error } = await check.admin
    .from("orders")
    .select(
      "id, total_amount_fcfa, buyer_phone, created_at, shop:shops(shop_name, whatsapp_number)"
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
    return NextResponse.json({ error: check.error }, { status: check.status });
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
    .select("id")
    .maybeSingle();

  if (error || !updated) {
    return NextResponse.json({ error: "Could not update this order." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
