import type { Metadata } from "next";
import { cookies } from "next/headers";
import { isThemePref, THEME_COOKIE, themeScript } from "@/lib/theme";
import { DM_Sans, Noto_Kufi_Arabic, Source_Serif_4 } from "next/font/google";
import { getSession } from "@/lib/session";
import { dirOf } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const sourceSerif = Source_Serif_4({ subsets: ["latin"], variable: "--font-source-serif", display: "swap" });
const kufi = Noto_Kufi_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600", "700"], variable: "--font-kufi", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.meta.title, description: t.meta.description };
}


export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [session, locale] = await Promise.all([getSession(), getLocale()]);
  const cookieTheme = (await cookies()).get(THEME_COOKIE)?.value;
  // One theme for every page: profile → last choice on this browser → system.
  const theme = session?.profile.theme ?? (isThemePref(cookieTheme) ? cookieTheme : "system");
  const textSize = session?.profile.text_size ?? "normal";

  return (
    <html
      lang={locale}
      dir={dirOf(locale)}
      data-theme-pref={theme}
      data-theme={theme === "dark" ? "dark" : "light"}
      data-text-size={textSize}
      className={`${dmSans.variable} ${sourceSerif.variable} ${kufi.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
