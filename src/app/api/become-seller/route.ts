import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

type Body = { shopName: string; whatsappNumber: string; city: string; isPersonal?: boolean };

// Turns the signed-in account (usually a buyer) into a seller by adding
// a shop to it — same login, same orders and favourites. Unlike
// /api/signup-seller this is for someone who is already signed in, so
// the user is taken from their session token, never from the request.
export async function POST(req: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Please log in first." }, { status: 401 });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const shopName = body.shopName?.trim();
  const whatsappNumber = body.whatsappNumber?.trim();
  const city = body.city?.trim();
  if (!shopName || !whatsappNumber || !city) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const { data: existingShop } = await admin.from("shops").select("slug").eq("owner_id", user.id).maybeSingle();
  if (existingShop) return NextResponse.json({ slug: existingShop.slug });

  const { data: profile } = await admin.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();
  // Admins keep their admin role; everyone else becomes a seller.
  const role = profile?.role === "admin" ? "admin" : "seller";
  const { error: profileError } = await admin.from("profiles").upsert({
    id: user.id,
    role,
    full_name: profile?.full_name ?? null,
    phone_number: whatsappNumber,
    city,
  });
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  const baseSlug = slugify(shopName) || "shop";
  let slug = baseSlug;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error: shopError } = await admin.from("shops").insert({
      owner_id: user.id,
      shop_name: shopName,
      slug,
      whatsapp_number: whatsappNumber,
      city,
      is_personal: Boolean(body.isPersonal),
    });
    if (!shopError) return NextResponse.json({ slug });
    if (shopError.code === "23505") {
      slug = `${baseSlug}-${Math.floor(Math.random() * 1000)}`;
      continue;
    }
    return NextResponse.json({ error: shopError.message }, { status: 500 });
  }
  return NextResponse.json({ error: "Could not create your shop — please try again." }, { status: 500 });
}
