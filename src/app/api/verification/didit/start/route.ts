import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { createDiditSession } from "@/lib/didit";

// Seller taps "Verify with ID + live selfie" in the dashboard. This
// checks who's actually asking (via their login session, same pattern
// as /api/admin/* routes), finds their shop, and starts a Didit
// verification session for it. The actual ID scan + selfie happens
// entirely on Didit's own page next — this route only hands back the
// link to send the browser to.
export async function POST(req: NextRequest) {
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: shop, error: shopError } = await admin
    .from("shops")
    .select("id")
    .eq("owner_id", userData.user.id)
    .maybeSingle();
  if (shopError || !shop) {
    return NextResponse.json({ error: "No shop found for this account." }, { status: 404 });
  }

  try {
    const session = await createDiditSession({
      shopId: shop.id,
      callbackUrl: `${req.nextUrl.origin}/dashboard?identityVerification=1`,
    });
    await admin
      .from("shops")
      .update({
        identity_verification_status: "pending",
        identity_verification_session_id: session.session_id,
      })
      .eq("id", shop.id);
    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not start identity verification." },
      { status: 500 }
    );
  }
}
