import { SeoIndex, seoIndexMetadata } from "@/lib/content/seo-route";

// Published template pages (Admin → SEO → Pages, D-257).
export const generateMetadata = () => seoIndexMetadata("template");

export default function Page() {
  return <SeoIndex kind="template" />;
}
