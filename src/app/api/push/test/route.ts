import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { getRequestUser } from "@/lib/api-auth";
import { sendPushToUser } from "@/lib/web-push";

// "Send me a test notification" — lets someone check it works on their
// phone right after turning it on. Only ever notifies the caller.
export async function POST(req: NextRequest) {
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  const user = await getRequestUser(admin, req);
  if (!user) return NextResponse.json({ error: "Please log in.", code: "login" }, { status: 401 });
  const fr = req.nextUrl.searchParams.get("lang") !== "en";
  await sendPushToUser(admin, user.id, {
    title: fr ? "Notifications activées ✓" : "Notifications are on ✓",
    body: fr
      ? "Vous serez prévenu ici pour vos commandes, offres et paiements."
      : "You'll be told here about your orders, offers and payments.",
    url: "/",
    tag: "test",
    urgency: "high",
  });
  return NextResponse.json({ ok: true });
}
