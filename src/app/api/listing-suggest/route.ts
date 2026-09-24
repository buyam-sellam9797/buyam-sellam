import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { suggestForTitle } from "@/lib/listing-suggest";

// GET /api/listing-suggest?title=... → suggested category and a price
// range from similar items on the site (see lib/listing-suggest.ts).
export async function GET(req: NextRequest) {
  const title = (req.nextUrl.searchParams.get("title") ?? "").slice(0, 120);
  if (title.trim().length < 3) return NextResponse.json({ category: null, price: null });
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ category: null, price: null });
  return NextResponse.json(await suggestForTitle(admin, title));
}
