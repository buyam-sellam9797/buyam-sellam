import type { SupabaseClient } from "@supabase/supabase-js";

// Buyam Sellam Signature: the shops of names people already know —
// established brands, fashion designers, public personalities selling
// their own wardrobe and picks, local makers and reference boutiques.
// A shop applies with its story and proof (a social account, press, a
// storefront); the team checks it by hand. Approved shops get a seal,
// their story on their page and a place on the homepage and /signature.
// The status columns can only be changed by the server (see the
// protect_shop_columns trigger in migration 029), never by the shop.

export const SIGNATURE_KINDS = ["brand", "designer", "creator", "maker", "boutique"] as const;
export type SignatureKind = (typeof SIGNATURE_KINDS)[number];

export function isSignatureKind(v: unknown): v is SignatureKind {
  return typeof v === "string" && (SIGNATURE_KINDS as readonly string[]).includes(v);
}

export type SignatureApplication = {
  kind: SignatureKind;
  story: string;
  founder?: string | null;
  foundedYear?: number | null;
  audience?: string | null;
  proofUrl: string;
  madeInCameroon?: boolean;
};

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function cleanUrl(v: unknown): string | null {
  const raw = text(v, 300);
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function applyForSignature(
  admin: SupabaseClient,
  userId: string,
  input: Partial<SignatureApplication>
): Promise<{ ok: true } | { ok: false; error: string; code: string; status: number }> {
  const { data: shop } = await admin
    .from("shops")
    .select("id, is_verified, signature_status")
    .eq("owner_id", userId)
    .maybeSingle();
  if (!shop) return { ok: false, code: "no_shop", error: "Open a shop first.", status: 404 };
  if (!shop.is_verified) {
    return { ok: false, code: "not_verified", error: "Verify your shop first — Signature is for verified shops.", status: 409 };
  }
  if (!isSignatureKind(input.kind)) return { ok: false, code: "kind", error: "Choose what describes you best.", status: 400 };
  const story = text(input.story, 1200);
  if (story.length < 80) return { ok: false, code: "story", error: "Tell your story in at least a few sentences (80 characters).", status: 400 };
  const proofUrl = cleanUrl(input.proofUrl);
  if (!proofUrl) return { ok: false, code: "proof", error: "Add a link that shows who you are (Instagram, TikTok, website, press).", status: 400 };
  const year = Number(input.foundedYear);
  const foundedYear = Number.isInteger(year) && year >= 1900 && year <= new Date().getFullYear() ? year : null;

  const patch = {
    signature_kind: input.kind,
    signature_story: story,
    signature_founder: text(input.founder, 80) || null,
    signature_founded_year: foundedYear,
    signature_audience: text(input.audience, 120) || null,
    signature_proof_url: proofUrl,
    made_in_cameroon: Boolean(input.madeInCameroon),
  };

  // An approved shop can refresh its story without losing the seal;
  // anyone else (new, rejected) goes (back) into review.
  const status = shop.signature_status === "approved" ? "approved" : "pending";
  const { error } = await admin
    .from("shops")
    .update({
      ...patch,
      signature_status: status,
      ...(status === "pending" ? { signature_applied_at: new Date().toISOString(), signature_note: null } : {}),
    })
    .eq("id", shop.id);
  if (error) return { ok: false, code: "failed", error: "Could not save. Please try again.", status: 500 };
  return { ok: true };
}
