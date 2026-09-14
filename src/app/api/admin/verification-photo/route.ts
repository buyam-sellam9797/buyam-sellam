import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/admin-auth";

// Returns a short-lived signed URL for a shop's submitted verification
// document. The verification-documents bucket is private, so this is the
// only way to view a photo — never expose a public URL for it.
export async function POST(req: NextRequest) {
  const check = await requireAdmin(req);
  if ("error" in check) return adminErrorResponse(check);
  const { admin } = check;

  let body: { shopId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.shopId) {
    return NextResponse.json({ error: "Missing shopId." }, { status: 400 });
  }

  const { data: shop, error: shopError } = await admin
    .from("shops")
    .select("verification_id_photo_path")
    .eq("id", body.shopId)
    .single();

  if (shopError || !shop?.verification_id_photo_path) {
    return NextResponse.json({ error: "No document on file for this shop." }, { status: 404 });
  }

  const { data, error } = await admin.storage
    .from("verification-documents")
    .createSignedUrl(shop.verification_id_photo_path, 300);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Could not generate a link for this document." }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
