import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isSolutionSlug, solutions, solutionSlugs, solutionsPage } from "@/lib/content/solutions";
import { home } from "@/lib/content/site";
import { solutionSeo } from "@/lib/content/solutions-seo";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Faq } from "@/components/marketing/Faq";
import { breadcrumbSchema, faqSchema, webPageSchema } from "@/lib/seo";
import { getLocale } from "@/lib/i18n/server";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return solutionSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isSolutionSlug(slug)) return { title: "Yolias" };
  const locale = await getLocale();
  const s = solutions[slug][locale];
  return pageMetadata({ title: `${solutionSeo[slug][locale].seoTitle} | Yolias`, description: s.metaDescription, path: `/solutions/${slug}` });
}

// One kind of team, one business problem, what Yolias does about it
// (lib/content/solutions.ts). Order (owner brief 2026-10-12, after the way
// warp.co/startups presents solutions): the problem-led promise with quick
// facts, three numbered outcomes, the problem, how Yolias helps, examples,
// steps, honest limits, objections (FAQ) and a closing call to action.
export default async function SolutionPage({ params }: Props) {
  const { slug } = await params;
  if (!isSolutionSlug(slug)) notFound();
  const locale = await getLocale();
  const s = solutions[slug][locale];
  const c = solutionsPage[locale];
  const seo = solutionSeo[slug][locale];
  const related = solutionSlugs.filter((x) => x !== slug).slice(0, 3);
  return (
    <>
      <JsonLd nodes={[
        webPageSchema({ title: seo.seoTitle, description: s.metaDescription, path: `/solutions/${slug}` }),
        breadcrumbSchema([{ name: "Yolias", path: "/" }, { name: c.eyebrow.charAt(0) + c.eyebrow.slice(1).toLowerCase(), path: "/solutions" }, { name: s.name, path: `/solutions/${slug}` }]),
        faqSchema(seo.faq),
      ]} />
      <section className="page-hero">
        <div className="site-width">
          <p className="eyebrow"><Link href="/solutions">{c.eyebrow}</Link> · {s.name}</p>
          <h1 className="display-font max-w-[900px]">{s.title}</h1>
          <p className="lead">{s.lead}</p>
          <div className="hero-actions">
            <Link className="btn-solid" href="/signup">{c.cta.primary}</Link>
            <Link className="btn-ghost" href="/product">{home[locale].secondary}</Link>
          </div>
          <ul className="solution-checks">{c.heroChecks.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      </section>

      <section className="section">
        <div className="site-width">
          <div className="section-head"><h2 className="display-font">{c.pillarsTitle}</h2></div>
          <ol className="tiles three solution-pillars">
            {s.pillars.map((p, i) => (
              <li className="tile" key={p.title}>
                <div className="step-num">0{i + 1}</div>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section alt">
        <div className="site-width split">
          <h2 className="solution-h2">{s.problemTitle}</h2>
          <div className="prose">{s.problem.map((p) => <p key={p.slice(0, 24)}>{p}</p>)}</div>
        </div>
      </section>

      <section className="section">
        <div className="site-width">
          <div className="section-head"><h2 className="display-font">{s.helpsTitle}</h2></div>
          <div className="tiles">
            {s.helps.map((h) => (
              <div className="tile" key={h.title}>
                <h3>{h.title}</h3>
                <p>{h.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="site-width split">
          <h2 className="solution-h2">{s.useCasesTitle}</h2>
          <ul className="solution-list">{s.useCases.map((u) => <li key={u.slice(0, 24)}>{u}</li>)}</ul>
        </div>
      </section>

      <section className="section alt">
        <div className="site-width split">
          <h2 className="solution-h2">{s.icpTitle}</h2>
          <div>
            <p className="solution-icp-intro">{s.icpIntro}</p>
            <blockquote className="solution-icp" dir="auto">{s.icp}</blockquote>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="site-width">
          <div className="section-head"><h2 className="display-font">{s.stepsTitle}</h2></div>
          <ol className="tiles solution-steps">
            {s.steps.map((step, i) => (
              <li className="tile" key={step.slice(0, 24)}>
                <div className="step-num">0{i + 1}</div>
                <p>{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section alt">
        <div className="site-width split">
          <h2 className="solution-h2">{s.valueTitle}</h2>
          <div className="prose">
            <p>{s.value}</p>
            <p className="solution-note">{c.note}</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="site-width split">
          <h2 className="solution-h2">{seo.limitsTitle}</h2>
          <ul className="solution-list">{seo.limits.map((l) => <li key={l.slice(0, 24)}>{l}</li>)}</ul>
        </div>
      </section>

      <Faq title={seo.faqTitle} items={seo.faq} />

      <section className="section alt">
        <div className="site-width">
          <div className="section-head"><h2 className="display-font">{c.related}</h2></div>
          <ul className="solutions-grid">
            {related.map((r) => {
              const x = solutions[r][locale];
              return (
                <li key={r}>
                  <Link className="solution-card" href={`/solutions/${r}`}>
                    <strong>{x.name}</strong>
                    <span>{x.tagline}</span>
                    <span className="solution-card-more">{c.learnMore}</span>
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
