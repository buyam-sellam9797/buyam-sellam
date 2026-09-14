import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/admin-auth";

// Every product on the platform, newest first — lets admin spot
// something that needs a closer look (mispriced, wrong category,
// inactive) without having to check each seller's dashboard.
export async function GET(req: NextRequest) {
  const check = await requireAdmin(req);
  if ("error" in check) return adminErrorResponse(check);

  const { data, error } = await check.admin
    .from("products")
    .select(
      "id, title, price_fcfa, stock_quantity, is_active, created_at, shop:shops(shop_name), category:categories(name)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: "Could not load products." }, { status: 500 });
  }
  return NextResponse.json({ products: data ?? [] });
}
