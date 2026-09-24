import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { getVapidKeys } from "@/lib/web-push";

// The public half of our push key. Browsers need it to subscribe; it is
// public by design (the private half never leaves the server).
export async function GET() {
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  const keys = await getVapidKeys(admin);
  if (!keys) return NextResponse.json({ error: "Notifications are not set up yet." }, { status: 503 });
  return NextResponse.json({ publicKey: keys.publicKey }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
