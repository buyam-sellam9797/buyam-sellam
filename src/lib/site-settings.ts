import { supabase } from "@/lib/supabase";

// Admin-editable platform settings (table public.site_settings, see
// supabase/migration_021_site_settings.sql). Readable by anyone; only
// changed through /api/admin/settings.

export const DEFAULT_IDLE_TIMEOUT_MINUTES = 30;
export const MAX_IDLE_TIMEOUT_MINUTES = 1440; // 24 hours

// Minutes of inactivity before a signed-in account is signed out.
// 0 means the automatic sign-out is turned off.
export async function getIdleTimeoutMinutes(): Promise<number> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "idle_timeout_minutes")
    .maybeSingle();
  if (error || !data) return DEFAULT_IDLE_TIMEOUT_MINUTES;
  const n = Number(data.value);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_IDLE_TIMEOUT_MINUTES;
  return Math.min(Math.floor(n), MAX_IDLE_TIMEOUT_MINUTES);
}
