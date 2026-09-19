import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";

// Public order-status endpoint used by the buyer-facing /order/[id]
// page. An order id (UUID) is hard to guess, but this route still
// only ever returns the handful of fields a buyer needs to see, and
// only allows the one write it exists for (confirming receipt) — it
// never lets a caller set arbitrary columns the way a public RLS
// write policy on the whole table would.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  const { data: order, error } = await admin
    .from("orders")
    .select(
      "id, status, total_amount_fcfa, delivery_fee_fcfa, delivery_distance_km, created_at, updated_at, accepted_at, delivery_name, delivery_city, delivery_neighborhood, delivery_address, shop:shops(shop_name, whatsapp_number, city)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const { data: items } = await admin
    .from("order_items")
    .select("quantity, product:products(title)")
    .eq("order_id", id);

  const { data: existingReview } = await admin
    .from("reviews")
    .select("id")
    .eq("order_id", id)
    .maybeSingle();

  return NextResponse.json({ order, items: items ?? [], reviewed: Boolean(existingReview) });
}

// The buyer taps "I received my order" on that page, which calls this
// with { action: "confirm" }. Only a shipped -> completed transition
// is allowed, so this can never be used to fabricate a payment or
// skip straight from "held" to "completed".
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  let body: {
    action?: string;
    productRating?: number;
    sellerRating?: number;
    deliveryRating?: number;
    comment?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (body.action === "review") {
    const productRating = Number(body.productRating);
    const sellerRating = Number(body.sellerRating);
    const deliveryRating = Number(body.deliveryRating);
    const subRatings = [productRating, sellerRating, deliveryRating];
    if (subRatings.some((r) => !Number.isInteger(r) || r < 1 || r > 5)) {
      return NextResponse.json(
        { error: "Please rate the product, seller, and delivery from 1 to 5." },
        { status: 400 }
      );
    }
    // Overall rating (what every existing aggregate — shop rating
    // summaries, admin stats, the homepage average — reads) is the
    // rounded average of the three aspects, so none of that code needs
    // to know the review got more detailed.
    const rating = Math.round((productRating + sellerRating + deliveryRating) / 3);

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, status, shop_id, buyer_id, buyer_phone")
      .eq("id", id)
      .maybeSingle();
    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    if (order.status !== "completed") {
      return NextResponse.json(
        { error: "You can only review an order once it's completed." },
        { status: 409 }
      );
    }

    const { error: insertError } = await admin.from("reviews").insert({
      order_id: order.id,
      shop_id: order.shop_id,
      buyer_id: order.buyer_id,
      buyer_phone: order.buyer_phone,
      rating,
      product_rating: productRating,
      seller_rating: sellerRating,
      delivery_rating: deliveryRating,
      comment: typeof body.comment === "string" ? body.comment.trim().slice(0, 500) || null : null,
    });
    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json({ error: "You've already reviewed this order." }, { status: 409 });
      }
      return NextResponse.json({ error: "Could not save your review." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  if (body.action !== "confirm") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  const { data: updated, error } = await admin
    .from("orders")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "shipped")
    .select(
      "id, status, total_amount_fcfa, delivery_fee_fcfa, delivery_distance_km, created_at, updated_at, accepted_at, delivery_name, delivery_city, delivery_neighborhood, delivery_address, shop:shops(shop_name, whatsapp_number, city)"
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Could not confirm this order." }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json(
      { error: "This order can't be confirmed right now — it may not be marked shipped yet, or was already confirmed." },
      { status: 409 }
    );
  }

  return NextResponse.json({ order: updated });
}
