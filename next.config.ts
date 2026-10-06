import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local dev serves the admin at http://admin.localhost:3200 through
  // scripts/dev-proxy.mjs (docs/12-decisions.md D-011).
  allowedDevOrigins: ["admin.localhost"],
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "127.0.0.1", port: "54421", pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
  },
  // Yolias Admin on yol.yolias.com stays out of search engines (D-135).
  async headers() {
    return process.env.ADMIN_NOINDEX === "true" ? [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }] : [];
  },
  async redirects() {
    return [
      { source: "/booking-call", destination: "/booking-mvp", permanent: true },
      { source: "/booking-call/:path*", destination: "/booking-mvp/:path*", permanent: true },
      { source: "/en/booking-call", destination: "/en/booking-mvp", permanent: true },
      { source: "/en/booking-call/:path*", destination: "/en/booking-mvp/:path*", permanent: true },
      { source: "/booking-saas", destination: "/booking-mvp", permanent: true },
      { source: "/booking-saas/:path*", destination: "/booking-mvp/:path*", permanent: true },
      { source: "/en/booking-saas", destination: "/en/booking-mvp", permanent: true },
      { source: "/en/booking-saas/:path*", destination: "/en/booking-mvp/:path*", permanent: true },
      { source: "/booking-company", destination: "/booking", permanent: true },
      { source: "/booking-company/:path*", destination: "/booking", permanent: true },
      { source: "/en/booking-company", destination: "/en/booking", permanent: true },
      { source: "/en/booking-company/:path*", destination: "/en/booking", permanent: true },
      { source: "/company-formation", destination: "/", permanent: true },
      { source: "/en/company-formation", destination: "/en", permanent: true },
    ];
  },
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
