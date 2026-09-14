// Base URL used to build absolute links (e.g. for the product share
// button) from server components, which don't have access to
// window.location. Falls back through Vercel's own preview-URL env
// var before finally hard-coding the production domain, so this
// works in local dev, preview deploys, and production without any
// extra environment variable having to be set.
export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://www.buyamsellam.shop";
}
