import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function getAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

type Body = { userId: string; fullName: string; phone: string; city: string };

// Same reasoning as /api/signup-seller: runs with the service role so
// the new buyer's profile row exists immediately after sign-up, whether
// or not their email is confirmed yet (a fresh browser session isn't
// always available at that exact moment).
export async function POST(req: NextRequest) {
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server is not configured (missing Supabase service role key)." },
      { status: 500 }
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { userId, fullName, phone, city } = body;
  if (!userId || !fullName || !phone) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const { error } = await admin.from("profiles").upsert({
    id: userId,
    role: "buyer",
    full_name: fullName,
    phone_number: phone,
    city: city || null,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
