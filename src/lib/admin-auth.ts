import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import type { SupabaseClient } from "@supabase/supabase-js";

// Shared by every /api/admin/* route: every request must prove it's
// Lio (or another admin), checked on the server against the real
// database — never just by hiding admin pages in the UI, which anyone
// could bypass by calling these APIs directly.
export async function requireAdmin(
  req: NextRequest
): Promise<{ admin: SupabaseClient } | { error: string; status: number }> {
  const admin = getAdminClient();
  if (!admin) return { error: "Server is not configured.", status: 500 };

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return { error: "Not signed in.", status: 401 };

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) {
    return { error: "Not signed in.", status: 401 };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { error: "You're not authorized to view this page.", status: 403 };
  }

  return { admin };
}

export function adminErrorResponse(check: { error: string; status: number }) {
  return NextResponse.json({ error: check.error }, { status: check.status });
}
