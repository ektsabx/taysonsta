import { SeoIndex, seoIndexMetadata } from "@/lib/content/seo-route";

// Published alternatives pages (Admin → SEO → Pages, D-257).
export const generateMetadata = () => seoIndexMetadata("alternatives");

export default function Page() {
  return <SeoIndex kind="alternatives" />;
}
