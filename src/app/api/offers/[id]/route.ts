import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { getRequestUser } from "@/lib/api-auth";
import { respondToOffer, buyerOfferAction } from "@/lib/offers";

// One endpoint for both sides of an offer. The server decides which
// side the caller is on: the shop owner may accept / counter / decline,
// the buyer may accept or turn down a counter-offer, or withdraw.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid offer." }, { status: 400 });
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  const user = await getRequestUser(admin, req);
  if (!user) return NextResponse.json({ error: "Please log in again.", code: "login" }, { status: 401 });

  let body: { action?: string; counter?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const sellerActions = ["accept", "decline", "counter"] as const;
  const buyerActions = ["accept_counter", "decline_counter", "withdraw"] as const;
  type SellerAction = (typeof sellerActions)[number];
  type BuyerAction = (typeof buyerActions)[number];

  const result = (sellerActions as readonly string[]).includes(body.action ?? "")
    ? await respondToOffer(admin, {
        userId: user.id,
        offerId: id,
        action: body.action as SellerAction,
        counterFcfa: Number(body.counter),
      })
    : (buyerActions as readonly string[]).includes(body.action ?? "")
      ? await buyerOfferAction(admin, { userId: user.id, offerId: id, action: body.action as BuyerAction })
      : null;

  if (!result) return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code, amount: result.amount, max: result.max },
      { status: result.status }
    );
  }
  return NextResponse.json({ offer: result.offer });
}
