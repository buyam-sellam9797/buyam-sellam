import type { SupabaseClient } from "@supabase/supabase-js";

// The sign-up routes finish creating an account (profile, and shop for
// sellers) with the service role, because right after sign-up there may
// be no session yet (email confirmation). The account id therefore
// comes from the request, so it is only accepted when:
//   - the request carries that user's own session token, or
//   - the account is less than an hour old, its email isn't confirmed
//     yet, and it hasn't been set up before (no name, no shop).
// That stops anyone from rewriting someone else's profile or adding a
// shop to their account by sending their id.
export async function canFinishSignup(
  admin: SupabaseClient,
  userId: string,
  authHeader: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = authHeader?.replace(/^Bearer\s+/i, "") || null;
  if (token) {
    const { data } = await admin.auth.getUser(token);
    if (data?.user?.id === userId) return { ok: true };
    return { ok: false, error: "Please log in again." };
  }

  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const user = authUser?.user;
  const createdAt = user?.created_at ? new Date(user.created_at).getTime() : 0;
  if (!user || Date.now() - createdAt > 60 * 60 * 1000 || user.email_confirmed_at) {
    return { ok: false, error: "This sign-up link has expired. Please log in instead." };
  }
  const [{ data: profile }, { data: shop }] = await Promise.all([
    admin.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    admin.from("shops").select("id").eq("owner_id", userId).maybeSingle(),
  ]);
  if (profile?.full_name || shop) {
    return { ok: false, error: "This account is already set up. Please log in." };
  }
  return { ok: true };
}

/** A plausible phone number (8–15 digits, optional +). Buyers abroad are allowed. */
export function looksLikePhone(value: string): boolean {
  const digits = String(value ?? "").replace(/[\s().-]/g, "");
  return /^\+?\d{8,15}$/.test(digits);
}
