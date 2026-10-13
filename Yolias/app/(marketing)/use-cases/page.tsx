import type { Metadata } from "next";
import Link from "next/link";
import { useCases, useCaseSlugs, useCasesPage } from "@/lib/content/use-cases";
import { getLocale } from "@/lib/i18n/server";
import { breadcrumbSchema, pageMetadata, webPageSchema } from "@/lib/seo";
import { JsonLd } from "@/components/marketing/JsonLd";

export async function generateMetadata(): Promise<Metadata> {
  const c = useCasesPage[await getLocale()];
  return pageMetadata({ title: `${c.title} | Yolias`, description: c.metaDescription, path: "/use-cases" });
}

// Search intent guides (D-179): one per question people ask when they look for clients.
export default async function UseCasesPage() {
  const locale = await getLocale();
  const c = useCasesPage[locale];
  return (
    <>
      <JsonLd nodes={[webPageSchema({ title: c.title, description: c.metaDescription, path: "/use-cases", type: "CollectionPage" }), breadcrumbSchema([{ name: "Yolias", path: "/" }, { name: c.title, path: "/use-cases" }])]} />
      <section className="page-hero">
        <div className="site-width">
          <p className="eyebrow">{c.eyebrow}</p>
          <h1 className="display-font max-w-[900px]">{c.title}</h1>
          <p className="lead">{c.lead}</p>
        </div>
      </section>
      <section className="section">
        <div className="site-width">
          <ul className="solutions-grid">
            {useCaseSlugs.map((slug) => {
              const u = useCases[slug][locale];
              return (
                <li key={slug}>
                  <Link className="solution-card" href={`/use-cases/${slug}`}>
                    <strong>{u.h1}</strong>
                    <span>{u.metaDescription}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
      <section className="cta-band">
        <div className="site-width">
          <h2 className="display-font">{c.cta.title}</h2>
          <p>{c.cta.body}</p>
          <div className="hero-actions">
            <Link className="btn-solid" href="/signup">{c.cta.primary}</Link>
            <Link className="btn-ghost" href="/pricing">{c.cta.secondary}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
