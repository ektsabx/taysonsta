import { SeoIndex, seoIndexMetadata } from "@/lib/content/seo-route";

// Published compare pages (Admin → SEO → Pages, D-257).
export const generateMetadata = () => seoIndexMetadata("compare");

export default function Page() {
  return <SeoIndex kind="compare" />;
}
