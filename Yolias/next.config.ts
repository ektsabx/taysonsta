import { execSync } from "node:child_process";
import path from "node:path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// Release = the git commit this build came from, so Sentry and PostHog can
// tell versions apart (lib/monitoring/env.ts).
const release = process.env.NEXT_PUBLIC_RELEASE || (() => {
  try {
    return `yolias@${execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim()}`;
  } catch {
    return "";
  }
})();

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_RELEASE: release },
  // Yolias lives inside the Taysonsta repo but is its own app: never resolve
  // modules from the parent (BOS) project.
  turbopack: { root: path.join(__dirname) },
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    // Search requests can carry an ICP file or screenshot (max 4 MB each, see lib/attachments.ts).
    serverActions: { bodySizeLimit: "9mb" },
  },
  poweredByHeader: false,
  // Baseline security headers on every response. Framing is limited to
  // Yolias itself (the support widget is served from /support-widget).
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
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

// Sentry (sentry.server.config.ts, instrumentation-client.ts). Source maps
// are uploaded only when SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT are
// set at build time (never committed), then removed from the deployed files.
const uploadSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT);

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  release: { name: release || undefined, create: uploadSourceMaps },
  sourcemaps: { disable: !uploadSourceMaps, deleteSourcemapsAfterUpload: true },
  widenClientFileUpload: uploadSourceMaps,
  telemetry: false,
  silent: !process.env.CI,
});
