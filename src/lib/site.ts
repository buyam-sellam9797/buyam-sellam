// Base URL used to build absolute links (e.g. for the product share
// button, and for robots.txt/sitemap.xml) from server components,
// which don't have access to window.location. Falls back through
// Vercel's own preview-URL env var before finally hard-coding the
// production domain, so this works in local dev, preview deploys, and
// production without any extra environment variable having to be set.
//
// Important: VERCEL_URL is that *specific deployment's* own unique
// URL (it changes on every single deploy) — fine for a preview build,
// but using it in production would mean robots.txt/sitemap.xml point
// search engines at a throwaway URL instead of the real domain. So in
// production we skip straight to the hard-coded domain unless
// NEXT_PUBLIC_SITE_URL has been set explicitly.
export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL && process.env.VERCEL_ENV !== "production") {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "https://www.buyamsellam.shop";
}

// Platform-level support contact (not a seller's shop number) — used on the
// order status page's "Report a problem" link, the Privacy Policy contact
// section, and the Help Centre. Set these as real env vars in Vercel once
// there's a real support line/inbox; until then this falls back to a
// clearly-a-placeholder value rather than silently pointing nowhere.
export function getSupportWhatsapp(): string {
  return process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "+237600000000";
}

export function getSupportEmail(): string {
  return process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@buyamsellam.shop";
}

export function buildSupportWhatsAppLink(message: string): string {
  const digits = getSupportWhatsapp().replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
