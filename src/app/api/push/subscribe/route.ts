import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { getRequestUser } from "@/lib/api-auth";
import { isAllowedPushEndpoint } from "@/lib/web-push";

type Body = { endpoint?: string; keys?: { p256dh?: string; auth?: string }; locale?: string };

const B64URL = /^[A-Za-z0-9_-]+$/;

// A signed-in user turns notifications on for this device.
export async function POST(req: NextRequest) {
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  const user = await getRequestUser(admin, req);
  if (!user) return NextResponse.json({ error: "Please log in.", code: "login" }, { status: 401 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const endpoint = body.endpoint ?? "";
  const p256dh = body.keys?.p256dh ?? "";
  const auth = body.keys?.auth ?? "";
  if (!isAllowedPushEndpoint(endpoint) || endpoint.length > 1000) {
    return NextResponse.json({ error: "This browser's notification service isn't supported." }, { status: 400 });
  }
  if (!B64URL.test(p256dh) || !B64URL.test(auth) || p256dh.length > 200 || auth.length > 100) {
    return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });
  }

  // One device = one endpoint. If it was registered to another account
  // before (shared phone, new login), it now belongs to this user only.
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      locale: body.locale === "en" ? "en" : body.locale === "fr" ? "fr" : null,
      user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
    },
    { onConflict: "endpoint" }
  );
  if (error) return NextResponse.json({ error: "Could not save." }, { status: 500 });

  // Keep the list tidy: at most 10 devices per person (newest win).
  const { data: rows } = await admin
    .from("push_subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const extra = (rows ?? []).slice(10).map((r) => r.id);
  if (extra.length) await admin.from("push_subscriptions").delete().in("id", extra);

  return NextResponse.json({ ok: true });
}

// Turn notifications off for this device.
export async function DELETE(req: NextRequest) {
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  const user = await getRequestUser(admin, req);
  if (!user) return NextResponse.json({ error: "Please log in.", code: "login" }, { status: 401 });
  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    /* empty body: nothing to remove */
  }
  if (body.endpoint) {
    await admin.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", body.endpoint);
  }
  return NextResponse.json({ ok: true });
}
