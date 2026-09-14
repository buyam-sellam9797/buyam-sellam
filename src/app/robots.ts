import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

// Tells crawlers which pages are worth indexing. Storefronts, product
// pages, and the browse/help/legal pages are the SEO surface; everything
// that requires a login or is a private per-order/per-session view is
// disallowed since indexing it does nothing but waste crawl budget.
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/dashboard",
        "/account",
        "/checkout/",
        "/order/",
        "/login",
        "/buyer-signup",
        "/forgot-password",
        "/reset-password",
        "/track-order",
        "/api/",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
