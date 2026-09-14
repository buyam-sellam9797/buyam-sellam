import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Product photos and shop logos are uploaded by sellers into Supabase
    // Storage and served from the project's own supabase.co subdomain
    // (the exact subdomain comes from NEXT_PUBLIC_SUPABASE_URL, which
    // differs between local/staging/production, so this allows any
    // project on the shared supabase.co domain rather than hardcoding
    // one — still narrow enough to block arbitrary external URLs).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
