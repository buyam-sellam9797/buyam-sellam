import type { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";
import { getSiteUrl } from "@/lib/site";

// Regenerated at most once an hour rather than force-dynamic like the
// buyer-facing pages: search engines don't need this second-by-second,
// and it saves a DB round trip on every crawler hit.
export const revalidate = 3600;

const STATIC_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "", changeFrequency: "daily", priority: 1 },
  { path: "/browse", changeFrequency: "daily", priority: 0.9 },
  { path: "/shops", changeFrequency: "daily", priority: 0.7 },
  { path: "/sell", changeFrequency: "monthly", priority: 0.6 },
  { path: "/help", changeFrequency: "monthly", priority: 0.5 },
  { path: "/refund", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();

  const [{ data: products }, { data: shops }] = await Promise.all([
    supabase
      .from("products")
      .select("id, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("shops")
      .select("slug, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${siteUrl}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const productEntries: MetadataRoute.Sitemap = (products ?? []).map((p) => ({
    url: `${siteUrl}/product/${p.id}`,
    lastModified: new Date(p.created_at),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const shopEntries: MetadataRoute.Sitemap = (shops ?? []).map((s) => ({
    url: `${siteUrl}/shop/${s.slug}`,
    lastModified: new Date(s.created_at),
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticEntries, ...shopEntries, ...productEntries];
}
