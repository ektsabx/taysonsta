import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Yolias lives inside the Taysonsta repo but is its own app: never resolve
  // modules from the parent (BOS) project.
  turbopack: { root: path.join(__dirname) },
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    // Search requests can carry an ICP file or screenshot (max 4 MB each, see lib/attachments.ts).
    serverActions: { bodySizeLimit: "9mb" },
  },
  // Searches used to live at /strategies/<id>; keep old links working.
  async redirects() {
    return [
      { source: "/strategies/:id", destination: "/search/:id", permanent: true },
      { source: "/docs/strategies", destination: "/docs/searches", permanent: true },
      { source: "/help-center/strategy-needs-attention", destination: "/help-center/search-needs-attention", permanent: true },
      { source: "/blog/writing-better-strategies", destination: "/blog/writing-better-searches", permanent: true },
    ];
  },
  images: {
    // Small logos only: served as-is (no Cloudflare Images binding needed).
    unoptimized: true,
    remotePatterns: [
      { protocol: "http", hostname: "127.0.0.1", pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
};

export default nextConfig;
