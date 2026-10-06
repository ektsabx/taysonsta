import Script from "next/script";
import { supportWidget } from "@/lib/support-widget";

// The support chat widget made in Yolias Admin (D-134), loaded from this
// site's own domain; replies come from the Admin's inbox.
export async function SupportWidget() {
  const w = await supportWidget();
  if (!w) return null;
  return <Script src={`/support-widget/${w.key}/embed.js`} strategy="lazyOnload" />;
}
