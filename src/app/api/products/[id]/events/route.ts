import { NextRequest, NextResponse, after } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { processProductEvents } from "@/lib/shop-alerts";

// Called by the seller's browser right after a product is created,
// edited or switched back on. The server re-reads the product itself and
// only emails what is actually true (it's back in stock / it's new), and
// every send is recorded, so repeated calls never send twice.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid product." }, { status: 400 });
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  after(() => processProductEvents(admin, id));
  return NextResponse.json({ ok: true });
}
