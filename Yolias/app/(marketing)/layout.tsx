import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { getSession } from "@/lib/session";
import "./marketing.css";

// Public website: home, product, pricing, about, contact, resources, legal.
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <div className="mk" id="top">
      <SiteHeader signedIn={Boolean(session)} />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
