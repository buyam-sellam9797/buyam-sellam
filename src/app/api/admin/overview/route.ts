import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/admin-auth";
import { calculateCommission } from "@/lib/commission";

// The admin dashboard's top-line numbers: how many people/shops/
// products/orders exist, how much money has moved through the
// platform (GMV), how much is currently sitting in escrow, how much
// has actually been paid out to sellers, and how many disputes are
// open right now. All computed live from the real tables — nothing
// here is cached or estimated.
export async function GET(req: NextRequest) {
  const check = await requireAdmin(req);
  if ("error" in check) return adminErrorResponse(check);
  const { admin } = check;

  const [
    { count: totalUsers },
    { count: totalSellers },
    { count: totalProducts },
    { count: totalOrders },
    { count: openDisputes },
    { data: moneyOrders },
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("shops").select("id", { count: "exact", head: true }),
    admin.from("products").select("id", { count: "exact", head: true }),
    admin.from("orders").select("id", { count: "exact", head: true }),
    admin.from("disputes").select("id", { count: "exact", head: true }).eq("status", "open"),
    admin.from("orders").select("total_amount_fcfa, status, payout_sent"),
  ]);

  let gmvFcfa = 0;
  let heldFcfa = 0;
  let paidToSellersFcfa = 0;
  for (const o of moneyOrders ?? []) {
    if (["paid_held", "shipped", "completed"].includes(o.status)) {
      gmvFcfa += o.total_amount_fcfa;
    }
    if (o.status === "paid_held" || o.status === "shipped") {
      heldFcfa += calculateCommission(o.total_amount_fcfa).sellerPayoutFcfa;
    }
    if (o.status === "completed" && o.payout_sent) {
      paidToSellersFcfa += calculateCommission(o.total_amount_fcfa).sellerPayoutFcfa;
    }
  }

  return NextResponse.json({
    totalUsers: totalUsers ?? 0,
    totalSellers: totalSellers ?? 0,
    totalProducts: totalProducts ?? 0,
    totalOrders: totalOrders ?? 0,
    openDisputes: openDisputes ?? 0,
    gmvFcfa,
    heldFcfa,
    paidToSellersFcfa,
  });
}
