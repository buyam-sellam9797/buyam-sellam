import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function getAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

type Body = {
  userId: string;
  fullName: string;
  whatsappNumber: string;
  city: string;
  shopName: string;
  description?: string;
};

// Runs with the service role key so a brand-new seller's profile and
// shop rows can be created immediately after sign-up, whether or not
// their email is confirmed yet (a fresh auth session isn't always
// available at that exact moment, which regular RLS-protected writes
// from the browser need).
export async function POST(req: NextRequest) {
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server is not configured (missing Supabase service role key)." },
      { status: 500 }
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { userId, fullName, whatsappNumber, city, shopName, description } = body;
  if (!userId || !fullName || !whatsappNumber || !city || !shopName) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    role: "seller",
    full_name: fullName,
    phone_number: whatsappNumber,
    city,
  });
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const baseSlug = slugify(shopName) || "shop";
  let slug = baseSlug;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error: shopError } = await admin.from("shops").insert({
      owner_id: userId,
      shop_name: shopName,
      slug,
      description: description || null,
      whatsapp_number: whatsappNumber,
      city,
    });
    if (!shopError) {
      return NextResponse.json({ slug });
    }
    if (shopError.code === "23505") {
      slug = `${baseSlug}-${Math.floor(Math.random() * 1000)}`;
      continue;
    }
    return NextResponse.json({ error: shopError.message }, { status: 500 });
  }

  return NextResponse.json({ error: "Could not create your shop — please try again." }, { status: 500 });
}
