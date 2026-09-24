import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { isAllowedPushEndpoint } from "@/lib/web-push";

// Browsers occasionally rotate a device's push address. The service
// worker (which has no login) reports old + new here; knowing the old
// address — an unguessable secret — is what proves it's the same device.
export async function POST(req: NextRequest) {
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 500 });
  let body: { oldEndpoint?: string; endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const { oldEndpoint, endpoint } = body;
  const p256dh = body.keys?.p256dh ?? "";
  const auth = body.keys?.auth ?? "";
  if (!oldEndpoint || !endpoint || !isAllowedPushEndpoint(endpoint) || !/^[A-Za-z0-9_-]{20,200}$/.test(p256dh) || !/^[A-Za-z0-9_-]{8,100}$/.test(auth)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const { data: row } = await admin.from("push_subscriptions").select("id").eq("endpoint", oldEndpoint).maybeSingle();
  if (!row) return NextResponse.json({ ok: false }, { status: 404 });
  await admin.from("push_subscriptions").delete().eq("endpoint", endpoint).neq("id", row.id);
  await admin.from("push_subscriptions").update({ endpoint, p256dh, auth }).eq("id", row.id);
  return NextResponse.json({ ok: true });
}
