import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { defaultLocale, directionForLocale, isLocale, type Locale } from "@/lib/i18n";
import { storageUrl } from "@/lib/storage";
import { siteUrl } from "@/lib/seo";
import { getSiteSetting } from "@/services/settings";
import { DirectionSync } from "@/components/layout/DirectionSync";
import "./globals.css";

export const metadata: Metadata = {
  title: "Taysonsta",
  metadataBase: new URL(siteUrl),
  icons: {
    icon: storageUrl("img/logo.png"),
    shortcut: storageUrl("img/logo.png"),
    apple: storageUrl("img/logo.png"),
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "/ar";
  const segment = pathname.split("/").filter(Boolean)[0] ?? "";
  // Admin pages follow the user's BOS language (cookie kept in sync by the
  // preference action; I18nProvider corrects it client-side if missing).
  const adminLocale = segment === "admin" ? (await cookies()).get("bos_locale")?.value : undefined;
  const locale: Locale = isLocale(segment) ? segment : adminLocale && isLocale(adminLocale) ? adminLocale : defaultLocale;
  const topbar = await getSiteSetting<{ ar: string; en: string }>("topbar_text");

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Taysonsta",
    url: siteUrl,
    logo: storageUrl("img/logo.png"),
  };

  return (
    <html lang={locale} dir={directionForLocale(locale)}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700;900&family=Inter:wght@600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body className={topbar ? "has-topbar" : undefined} suppressHydrationWarning>
        <DirectionSync />
        {children}
      </body>
    </html>
  );
}
