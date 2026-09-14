import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";

const VALID_REASONS = [
  "not_arrived",
  "wrong_product",
  "damaged",
  "different_than_described",
  "seller_not_responding",
  "other",
];

const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB — generous for a phone photo, small enough to not abuse storage

// Buyer's "Report a problem" submission. Runs as a trusted server
// route with the service-role client (most buyers are guests with no
// session), takes multipart form data so an optional evidence photo
// can ride along, and — same guardrail as order confirmation — only
// lets an order still in play (paid_held/shipped) be disputed, so a
// completed/refunded/already-disputed order can't be reopened this way.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const reason = String(form.get("reason") ?? "");
  const descriptionRaw = form.get("description");
  const description =
    typeof descriptionRaw === "string" ? descriptionRaw.trim().slice(0, 1000) || null : null;
  const photo = form.get("photo");

  if (!VALID_REASONS.includes(reason)) {
    return NextResponse.json({ error: "Please choose a reason." }, { status: 400 });
  }

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, shop_id, buyer_phone, status")
    .eq("id", id)
    .maybeSingle();
  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  if (!["paid_held", "shipped"].includes(order.status)) {
    return NextResponse.json(
      { error: "This order can no longer be reported — it's already been resolved." },
      { status: 409 }
    );
  }

  let photoUrl: string | null = null;
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: "That photo is too large (max 8MB)." }, { status: 400 });
    }
    const ext = photo.name.split(".").pop()?.toLowerCase().slice(0, 5) || "jpg";
    const path = `${order.id}-${Date.now()}.${ext}`;
    const bytes = new Uint8Array(await photo.arrayBuffer());
    const { error: uploadError } = await admin.storage
      .from("dispute-evidence")
      .upload(path, bytes, { contentType: photo.type || "image/jpeg" });
    if (!uploadError) {
      const { data: pub } = admin.storage.from("dispute-evidence").getPublicUrl(path);
      photoUrl = pub.publicUrl;
    }
    // If the upload fails, we still let the dispute go through without
    // a photo rather than blocking the buyer's report entirely.
  }

  const { error: insertError } = await admin.from("disputes").insert({
    order_id: order.id,
    shop_id: order.shop_id,
    buyer_phone: order.buyer_phone,
    reason,
    description,
    photo_url: photoUrl,
  });
  if (insertError) {
    return NextResponse.json({ error: "Could not submit your report. Please try again." }, { status: 500 });
  }

  await admin
    .from("orders")
    .update({ status: "disputed", updated_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
