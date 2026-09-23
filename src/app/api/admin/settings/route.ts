import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/admin-auth";
import { DEFAULT_IDLE_TIMEOUT_MINUTES, MAX_IDLE_TIMEOUT_MINUTES } from "@/lib/site-settings";

// Reads and updates admin-editable platform settings (public.site_settings).
// For now: idle_timeout_minutes — how long a signed-in account can sit
// inactive before it is signed out (0 = never).
export async function GET(req: NextRequest) {
  const check = await requireAdmin(req);
  if ("error" in check) return adminErrorResponse(check);
  const { admin } = check;

  const { data } = await admin
    .from("site_settings")
    .select("value")
    .eq("key", "idle_timeout_minutes")
    .maybeSingle();
  const n = Number(data?.value);
  return NextResponse.json({
    idleTimeoutMinutes: Number.isFinite(n) ? n : DEFAULT_IDLE_TIMEOUT_MINUTES,
  });
}

export async function POST(req: NextRequest) {
  const check = await requireAdmin(req);
  if ("error" in check) return adminErrorResponse(check);
  const { admin } = check;

  let body: { idleTimeoutMinutes?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const minutes = Number(body.idleTimeoutMinutes);
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > MAX_IDLE_TIMEOUT_MINUTES) {
    return NextResponse.json(
      { error: `Enter a whole number between 0 and ${MAX_IDLE_TIMEOUT_MINUTES}.` },
      { status: 400 }
    );
  }

  const { error } = await admin
    .from("site_settings")
    .upsert({ key: "idle_timeout_minutes", value: minutes, updated_at: new Date().toISOString() });
  if (error) {
    return NextResponse.json({ error: "Could not save the setting." }, { status: 500 });
  }
  return NextResponse.json({ idleTimeoutMinutes: minutes });
}
