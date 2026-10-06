import type { MetadataRoute } from "next";

// The marketing site is crawlable; the app, auth flows and APIs are not.
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200").replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/", "/search/", "/prospects", "/campaigns", "/analytics", "/chat", "/outreach", "/checkout", "/onboarding", "/invoices/", "/billing/", "/two-factor", "/dev/"],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
