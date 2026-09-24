import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { getRequestUser } from "@/lib/api-auth";
import { createSharedBag, type SharedBagDelivery } from "@/lib/shared-bags";
import type { BagLineInput } from "@/lib/order-pricing";

// Creates a "pay for me" link for a bag (see src/lib/shared-bags.ts).
// Needs a signed-in buyer: the order will live in their account.
export async function POST(req: NextRequest) {
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  const user = await getRequestUser(admin, req);
  if (!user) return NextResponse.json({ error: "Please log in first.", code: "login" }, { status: 401 });

  let body: { items?: BagLineInput[]; delivery?: Partial<SharedBagDelivery>; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const result = await createSharedBag(admin, {
    creatorId: user.id,
    items: Array.isArray(body.items) ? body.items : [],
    delivery: body.delivery ?? {},
    note: body.note ?? null,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ token: result.token, total: result.pricing.totalAmountFcfa });
}
