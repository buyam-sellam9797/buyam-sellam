import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { verifyDiditWebhook, mapDiditStatus } from "@/lib/didit";

// Didit calls this the moment a verification session's status
// changes. This is the only result Buyam Sellam actually trusts — the
// query params on the browser redirect back to /dashboard are just a
// UI hint (easy to fake by editing the URL), so they never grant the
// verified badge by themselves. Only a signed webhook does that.
export async function POST(req: NextRequest) {
  const admin = getAdminClient();
  const secret = process.env.DIDIT_WEBHOOK_SECRET;
  if (!admin || !secret) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  // Signature verification needs the exact raw bytes Didit sent, so
  // this reads text — never req.json() — before anything else touches
  // the body.
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature");
  const timestamp = req.headers.get("x-timestamp");
  if (!verifyDiditWebhook(rawBody, signature, timestamp, secret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: { session_id?: string; status?: string; vendor_data?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  // vendor_data was set to the shop's id when the session was created
  // (see /api/verification/didit/start) — that's the normal path.
  // Falling back to matching on session_id covers the unlikely case
  // where vendor_data didn't come back for some reason.
  // Didit's "Test Webhook" button (and anything else unexpected) sends
  // a vendor_data that isn't one of our shop ids, e.g.
  // "test-vendor-data-123". Passing that to a uuid column makes Postgres
  // error out and this route answer 500, so anything that isn't a uuid
  // is ignored here. A session that matches no shop is simply a no-op
  // and still gets a 200, so Didit doesn't log it as a failed delivery.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const shopId = payload.vendor_data && UUID_RE.test(payload.vendor_data) ? payload.vendor_data : undefined;
  const sessionId = payload.session_id;
  if (!shopId && !sessionId) {
    return NextResponse.json({ ok: true });
  }

  const mappedStatus = mapDiditStatus(payload.status);
  const patch: Record<string, unknown> = { identity_verification_status: mappedStatus };
  if (mappedStatus === "approved") {
    // A confirmed face match is at least as strong a signal as a human
    // eyeballing an uploaded photo, so this grants the verified badge
    // directly rather than waiting on a second manual admin approval.
    patch.identity_verified_at = new Date().toISOString();
    patch.is_verified = true;
  }

  const query = admin.from("shops").update(patch);
  const { error } = shopId
    ? await query.eq("id", shopId)
    : await query.eq("identity_verification_session_id", sessionId as string);

  if (error) {
    return NextResponse.json({ error: "Could not record verification result." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
