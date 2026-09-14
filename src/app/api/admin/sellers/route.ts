import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/admin-auth";

// Every shop on the platform with the numbers admin needs to judge
// it at a glance: order count and rating (same math as the public
// shop page), plus its current verification/active state.
export async function GET(req: NextRequest) {
  const check = await requireAdmin(req);
  if ("error" in check) return adminErrorResponse(check);
  const { admin } = check;

  const { data: shops, error } = await admin
    .from("shops")
    .select("id, shop_name, city, is_verified, is_active, verification_requested_at, view_count, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Could not load sellers." }, { status: 500 });
  }

  const enriched = await Promise.all(
    (shops ?? []).map(async (shop) => {
      const [{ count: orderCount }, { data: reviews }] = await Promise.all([
        admin.from("orders").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
        admin.from("reviews").select("rating").eq("shop_id", shop.id),
      ]);
      const reviewCount = reviews?.length ?? 0;
      const average = reviewCount > 0 ? reviews!.reduce((s, r) => s + r.rating, 0) / reviewCount : 0;
      return { ...shop, orderCount: orderCount ?? 0, rating: average, reviewCount };
    })
  );

  return NextResponse.json({ shops: enriched });
}

// Admin toggles a shop's verified badge or active (visible) state.
export async function POST(req: NextRequest) {
  const check = await requireAdmin(req);
  if ("error" in check) return adminErrorResponse(check);

  let body: { shopId?: string; isVerified?: boolean; isActive?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.shopId) {
    return NextResponse.json({ error: "Missing shopId." }, { status: 400 });
  }

  const update: Record<string, boolean> = {};
  if (typeof body.isVerified === "boolean") update.is_verified = body.isVerified;
  if (typeof body.isActive === "boolean") update.is_active = body.isActive;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { error } = await check.admin.from("shops").update(update).eq("id", body.shopId);
  if (error) {
    return NextResponse.json({ error: "Could not update this shop." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
