import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { getRequestUser } from "@/lib/api-auth";
import { createOffer } from "@/lib/offers";

// A signed-in buyer makes an offer on an item (see src/lib/offers.ts).
export async function POST(req: NextRequest) {
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  const user = await getRequestUser(admin, req);
  if (!user) return NextResponse.json({ error: "Please log in to make an offer.", code: "login" }, { status: 401 });

  let body: { productId?: string; amount?: number; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.productId || !/^[0-9a-f-]{36}$/i.test(body.productId)) {
    return NextResponse.json({ error: "Invalid item." }, { status: 400 });
  }

  const result = await createOffer(admin, {
    buyerId: user.id,
    productId: body.productId,
    amountFcfa: Number(body.amount),
    message: typeof body.message === "string" ? body.message : null,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: result.code, amount: result.amount }, { status: result.status });
  }
  return NextResponse.json({ offer: result.offer });
}

// The shop owner's offers (newest first), with each buyer's first name
// — buyers' profiles aren't readable from the browser, so the name is
// added here on the server.
export async function GET(req: NextRequest) {
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  const user = await getRequestUser(admin, req);
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const { data: shop } = await admin.from("shops").select("id").eq("owner_id", user.id).maybeSingle();
  if (!shop) return NextResponse.json({ offers: [] });

  const { data: offers } = await admin
    .from("offers")
    .select(
      "id, product_id, buyer_id, amount_fcfa, counter_fcfa, agreed_fcfa, message, status, auto_decided, expires_at, pay_by, responded_at, order_id, created_at, product:products(title, image_urls, price_fcfa, sale_price_fcfa)"
    )
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const buyerIds = [...new Set((offers ?? []).map((o) => o.buyer_id as string))];
  const { data: profiles } = buyerIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", buyerIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const names = new Map((profiles ?? []).map((p) => [p.id as string, ((p.full_name as string | null) ?? "").trim().split(/\s+/)[0] || null]));

  return NextResponse.json({
    offers: (offers ?? []).map(({ buyer_id, ...o }) => ({ ...o, buyer_name: names.get(buyer_id as string) ?? null })),
  });
}
