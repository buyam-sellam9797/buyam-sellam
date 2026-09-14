import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/admin-auth";

// Lets an existing admin grant admin access to another account by email,
// instead of the only previous option (hand-editing the profiles table
// via raw SQL in the Supabase dashboard). profiles has no email column,
// so this looks the user up through Supabase Auth first.
export async function GET(req: NextRequest) {
  const check = await requireAdmin(req);
  if ("error" in check) return adminErrorResponse(check);
  const { admin } = check;

  const { data: admins, error } = await admin.from("profiles").select("id").eq("role", "admin");
  if (error) {
    return NextResponse.json({ error: "Could not load admins." }, { status: 500 });
  }

  const emails: { id: string; email: string }[] = [];
  for (const row of admins ?? []) {
    const { data } = await admin.auth.admin.getUserById(row.id);
    if (data?.user?.email) emails.push({ id: row.id, email: data.user.email });
  }

  return NextResponse.json({ admins: emails });
}

export async function POST(req: NextRequest) {
  const check = await requireAdmin(req);
  if ("error" in check) return adminErrorResponse(check);
  const { admin } = check;

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Enter an email address." }, { status: 400 });
  }

  // profiles has no email column, so find the auth user by paging through
  // listUsers — fine at this platform's scale (admin accounts are few).
  let targetId: string | null = null;
  for (let page = 1; page <= 20 && !targetId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) targetId = match.id;
    if (data.users.length < 200) break;
  }

  if (!targetId) {
    return NextResponse.json(
      { error: "No account with that email. They need to sign up (e.g. open a shop) first." },
      { status: 404 }
    );
  }

  const { error: upsertError } = await admin
    .from("profiles")
    .upsert({ id: targetId, role: "admin" }, { onConflict: "id" });

  if (upsertError) {
    return NextResponse.json({ error: "Could not grant admin access." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
