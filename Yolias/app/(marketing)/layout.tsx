import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { getSession } from "@/lib/session";
import { getLocale } from "@/lib/i18n/server";
import { seoPages } from "@/lib/content/seo-store";
import "./marketing.css";

// Public website: home, product, pricing, about, contact, resources, legal.
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [session, locale, seo] = await Promise.all([getSession(), getLocale(), seoPages()]);
  // Comparisons and templates from Admin → SEO (D-257) join the footer once something is published.
  const has = (k: string) => seo.some((p) => p.kind === k);
  const seoLinks = [
    ...(has("compare") ? [{ href: "/compare", label: locale === "ar" ? "المقارنات" : "Comparisons" }] : []),
    ...(has("alternatives") ? [{ href: "/alternatives", label: locale === "ar" ? "البدائل" : "Alternatives" }] : []),
    ...(has("template") ? [{ href: "/templates", label: locale === "ar" ? "قوالب البحث" : "Prospecting templates" }] : []),
  ];
  return (
    <div className="mk" id="top">
      <SiteHeader signedIn={Boolean(session)} />
      <main>{children}</main>
      <SiteFooter signedIn={Boolean(session)} extraLinks={seoLinks} />
    </div>
  );
}
