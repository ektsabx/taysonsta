import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Yolias lives inside the Taysonsta repo but is its own app: never resolve
  // modules from the parent (BOS) project.
  turbopack: { root: path.join(__dirname) },
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    // Strategy requests can carry an ICP file or screenshot (max 4 MB each, see lib/attachments.ts).
    serverActions: { bodySizeLimit: "9mb" },
  },
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "127.0.0.1", pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
};

export default nextConfig;
