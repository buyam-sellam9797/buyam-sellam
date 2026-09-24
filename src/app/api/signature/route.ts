import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { getRequestUser } from "@/lib/api-auth";
import { applyForSignature, type SignatureApplication } from "@/lib/signature";

// A verified shop applies for Signature (or, once approved, updates its
// story). Status changes themselves are only ever made by the team.
export async function POST(req: NextRequest) {
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  const user = await getRequestUser(admin, req);
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  let body: Partial<SignatureApplication>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const result = await applyForSignature(admin, user.id, body);
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json({ ok: true });
}
