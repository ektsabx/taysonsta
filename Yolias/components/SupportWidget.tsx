import Script from "next/script";
import { supportWidget } from "@/lib/support-widget";
import { getLocale } from "@/lib/i18n/server";

// The support chat widget made in Yolias Admin (D-134), loaded from this
// site's own domain; replies come from the Admin's inbox. No floating
// button (owner request, D-140): it opens from "Contact support" links
// (components/SupportLink.tsx) — on the website and in the app menu.
export async function SupportWidget() {
  const [w, locale] = await Promise.all([supportWidget(), getLocale()]);
  if (!w) return null;
  return (
    <Script
      src={`/support-widget/${w.key}/embed.js`}
      strategy="afterInteractive"
      data-icon="/brand/logo-mark.png"
      data-launcher="hidden"
      data-lang={locale}
    />
  );
}
