import type { Metadata } from "next";
import { cookies } from "next/headers";
import { resolveTheme, THEME_COOKIE } from "@/lib/theme";
import { ThemeCookieSync } from "@/components/ThemeCookieSync";
import { DM_Sans, Noto_Kufi_Arabic, Source_Serif_4 } from "next/font/google";
import { getSession } from "@/lib/session";
import { dirOf } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
import { Analytics } from "@/components/analytics/Analytics";
import { SupportWidget } from "@/components/SupportWidget";
import { siteVerification } from "@/lib/seo-server";
import { OG_IMAGE, SITE_NAME, siteUrl } from "@/lib/seo";
import "./globals.css";

// Self-hosted by next/font (same domain, cached). If a font file fails to
// load (YOLIAS-6, flaky networks) the text stays readable in the system
// fallback below and the page keeps working.
// (next/font needs literal values here, not constants.)
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap", fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"] });
const sourceSerif = Source_Serif_4({ subsets: ["latin"], variable: "--font-source-serif", display: "swap", fallback: ["Georgia", "Times New Roman", "serif"] });
const kufi = Noto_Kufi_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600", "700"], variable: "--font-kufi", display: "swap", fallback: ["Tahoma", "Geeza Pro", "Arial", "sans-serif"] });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  // Absolute canonical and Open Graph URLs on every page (lib/seo.ts).
  // Pages set their own title, description and canonical; these are defaults.
  const { google, bing } = await siteVerification();
  return {
    metadataBase: new URL(siteUrl()),
    title: t.meta.title,
    description: t.meta.description,
    applicationName: SITE_NAME,
    openGraph: { siteName: SITE_NAME, type: "website", images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", images: [OG_IMAGE.url] },
    // Search Console / Bing Webmaster ownership tokens (Yolias Admin → Integrations).
    ...(google || bing ? { verification: { ...(google ? { google } : {}), ...(bing ? { other: { "msvalidate.01": bing } } : {}) } } : {}),
  };
}


export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [session, locale] = await Promise.all([getSession(), getLocale()]);
  const cookieTheme = (await cookies()).get(THEME_COOKIE)?.value;
  // One theme for every page: the account's choice → this browser's last choice → dark.
  const theme = resolveTheme(session?.profile.theme, cookieTheme);
  const textSize = session?.profile.text_size ?? "normal";

  return (
    <html
      lang={locale}
      dir={dirOf(locale)}
      data-theme={theme}
      data-text-size={textSize}
      className={`${dmSans.variable} ${sourceSerif.variable} ${kufi.variable}`}
      suppressHydrationWarning
    >
      {/* Browser extensions (e.g. ColorZilla's cz-shortcut-listen) add attributes to <body> before React loads. */}
      <body suppressHydrationWarning>
        <I18nProvider locale={locale}>{children}</I18nProvider>
        {session && <ThemeCookieSync theme={theme} />}
        <I18nProvider locale={locale}>
          <Analytics locale={locale} user={session ? { userId: session.userId, workspaceId: session.workspace.id, plan: session.workspace.plan, role: session.role } : null} />
        </I18nProvider>
        <SupportWidget />
      </body>
    </html>
  );
}
