import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { getRequestUser } from "@/lib/api-auth";
import { getSharedBagByToken } from "@/lib/shared-bags";

// The person who created a payment link can cancel it while it's unpaid.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  const user = await getRequestUser(admin, req);
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const bag = await getSharedBagByToken(admin, token);
  if (!bag || bag.creator_id !== user.id) return NextResponse.json({ error: "Link not found." }, { status: 404 });
  await admin.from("shared_bags").update({ status: "cancelled" }).eq("id", bag.id).eq("status", "open");
  return NextResponse.json({ ok: true });
}
