import Script from "next/script";
import { supportWidget } from "@/lib/support-widget";
import { getLocale } from "@/lib/i18n/server";

// The support messenger made in Yolias Admin (D-134, D-180), loaded from
// this site's own domain; replies come from the Admin's inbox. Its round
// button is always visible and opens the messenger directly (owner request,
// 2026-10-12, replacing D-140's hidden button); "Contact support" links
// (components/SupportLink.tsx) open it too. The AI answers as "Yolias Agent".
export async function SupportWidget() {
  const [w, locale] = await Promise.all([supportWidget(), getLocale()]);
  if (!w) return null;
  return (
    <Script
      src={`/support-widget/${w.key}/embed.js`}
      strategy="afterInteractive"
      data-icon="/brand/logo-mark.png"
      data-agent-name="Yolias Agent"
      // Same fonts as the site (Noto Kufi Arabic in Arabic, DM Sans in English).
      data-font="inherit"
      data-lang={locale}
      // Arabic pages put the app sidebar (and its account row) on the right:
      // the launcher sits on the left so it never covers them.
      data-position={locale === "ar" ? "left" : "right"}
    />
  );
}
