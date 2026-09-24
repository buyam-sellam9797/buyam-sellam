import type { NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

// The signed-in user behind an API request (Authorization: Bearer
// <access token>), checked with Supabase on the server. null when the
// header is missing or the token is no longer valid.
export async function getRequestUser(admin: SupabaseClient, req: NextRequest): Promise<User | null> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  return data?.user ?? null;
}
