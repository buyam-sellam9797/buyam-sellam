import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// Per-visitor limits on endpoints that can be abused: creating accounts,
// looking up orders by phone, starting payments (each one sends a
// mobile money prompt to a phone), reporting problems. Counted in the
// database, so it holds across all server instances. If the counter
// can't be reached, the request is allowed: a limiter outage must never
// block real customers from paying.

function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "unknown";
}

export const LIMITS = {
  signup: { max: 5, windowSeconds: 600 },
  lookup: { max: 10, windowSeconds: 600 },
  payment: { max: 10, windowSeconds: 600 },
  report: { max: 5, windowSeconds: 3600 },
  orderAction: { max: 20, windowSeconds: 600 },
  offer: { max: 20, windowSeconds: 600 },
  push: { max: 20, windowSeconds: 600 },
  event: { max: 120, windowSeconds: 60 },
  suggest: { max: 30, windowSeconds: 600 },
} as const;

/**
 * Returns a 429 response when this visitor has hit the limit for `name`,
 * otherwise null. `extraKey` narrows it further (e.g. a phone number).
 */
export async function rateLimited(
  admin: SupabaseClient,
  req: Request,
  name: keyof typeof LIMITS,
  extraKey?: string
): Promise<NextResponse | null> {
  const { max, windowSeconds } = LIMITS[name];
  const keys = [`${name}:ip:${clientIp(req)}`];
  if (extraKey) keys.push(`${name}:k:${extraKey.toLowerCase().replace(/\s+/g, "").slice(0, 80)}`);
  try {
    for (const key of keys) {
      const { data, error } = await admin.rpc("hit_rate_limit", { p_key: key, p_max: max, p_window_seconds: windowSeconds });
      if (error) return null;
      if (data === false) {
        return NextResponse.json(
          { error: "Too many attempts. Please wait a few minutes and try again.", code: "rate_limited" },
          { status: 429, headers: { "Retry-After": String(windowSeconds) } }
        );
      }
    }
  } catch {
    return null;
  }
  return null;
}
