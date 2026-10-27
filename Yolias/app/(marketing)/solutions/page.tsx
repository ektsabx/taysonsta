import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "@/components/LocaleLink";
import { solutions, solutionSlugs, solutionsPage } from "@/lib/content/solutions";
import { getLocale } from "@/lib/i18n/server";
import { seoPages } from "@/lib/content/seo-store";

export async function generateMetadata(): Promise<Metadata> {
  const c = solutionsPage[await getLocale()];
  return pageMetadata({ title: `${c.eyebrow.charAt(0)}${c.eyebrow.slice(1).toLowerCase()} | Yolias`, description: c.lead, path: "/solutions" });
}

export default async function SolutionsPage() {
  const locale = await getLocale();
  const c = solutionsPage[locale];
  // Audiences added in Admin → SEO (D-257), after the ones in code.
  const more = (await seoPages("solution")).filter((p) => !(solutionSlugs as readonly string[]).includes(p.slug));
  return (
    <>
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
            {solutionSlugs.map((slug) => {
              const s = solutions[slug][locale];
              return (
                <li key={slug}>
                  <Link className="solution-card" href={`/solutions/${slug}`}>
                    <strong>{s.name}</strong>
                    <span>{s.tagline}</span>
                    <span className="solution-card-more">{c.learnMore}</span>
                  </Link>
                </li>
              );
            })}
            {more.map((p) => (
              <li key={p.id}>
                <Link className="solution-card" href={p.path}>
                  <strong>{p.copy[locale].title}</strong>
                  <span>{p.copy[locale].metaDescription}</span>
                  <span className="solution-card-more">{c.learnMore}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
