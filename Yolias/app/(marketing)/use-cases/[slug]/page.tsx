import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isUseCaseSlug, useCases, useCaseSlugs, useCasesPage } from "@/lib/content/use-cases";
import { isSolutionSlug, solutions } from "@/lib/content/solutions";
import { getLocale } from "@/lib/i18n/server";
import { breadcrumbSchema, faqSchema, pageMetadata, webPageSchema } from "@/lib/seo";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Faq } from "@/components/marketing/Faq";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return useCaseSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isUseCaseSlug(slug)) return { title: "Yolias" };
  const u = useCases[slug][await getLocale()];
  return pageMetadata({ title: `${u.title} | Yolias`, description: u.metaDescription, path: `/use-cases/${slug}` });
}

// One search intent, answered directly first, then how Yolias handles it,
// its limits and real questions (lib/content/use-cases.ts).
export default async function UseCasePage({ params }: Props) {
  const { slug } = await params;
  if (!isUseCaseSlug(slug)) notFound();
  const locale = await getLocale();
  const u = useCases[slug][locale];
  const c = useCasesPage[locale];
  const related = useCaseSlugs.filter((x) => x !== slug).slice(0, 3);
  const path = `/use-cases/${slug}`;
  return (
    <>
      <JsonLd nodes={[
        webPageSchema({ title: u.title, description: u.metaDescription, path }),
        breadcrumbSchema([{ name: "Yolias", path: "/" }, { name: c.title, path: "/use-cases" }, { name: u.name, path }]),
        faqSchema(u.faq),
      ]} />
      <section className="page-hero">
        <div className="site-width">
          <p className="eyebrow"><Link href="/use-cases">{c.eyebrow}</Link> · {u.name}</p>
          <h1 className="display-font max-w-[900px]">{u.h1}</h1>
          <p className="lead">{u.lead}</p>
          <div className="hero-actions">
            <Link className="btn-solid" href="/signup">{c.cta.primary}</Link>
            <Link className="btn-ghost" href="/product">{locale === "ar" ? "تعرّف على المنتج" : "See the product"}</Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="site-width split">
          <h2 className="solution-h2">{u.answerTitle}</h2>
          <div className="prose"><p className="usecase-answer">{u.answer}</p></div>
        </div>
      </section>

      <section className="section alt">
        <div className="site-width split">
          <h2 className="solution-h2">{u.forTitle}</h2>
          <ul className="solution-list">{u.forWho.map((x) => <li key={x.slice(0, 24)}>{x}</li>)}</ul>
        </div>
      </section>

      <section className="section">
        <div className="site-width split">
          <h2 className="solution-h2">{u.problemTitle}</h2>
          <div className="prose">{u.problem.map((p) => <p key={p.slice(0, 24)}>{p}</p>)}</div>
        </div>
      </section>

      <section className="section alt">
        <div className="site-width">
          <div className="section-head"><h2 className="display-font">{u.stepsTitle}</h2></div>
          <ol className="tiles solution-steps">
            {u.steps.map((s, i) => (
              <li className="tile" key={s.title}>
                <div className="step-num">0{i + 1}</div>
                <h3>{s.title.replace(/^\d+\.\s*/, "")}</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="site-width split">
          <h2 className="solution-h2">{u.exampleTitle}</h2>
          <div>
            <p className="solution-icp-intro">{u.exampleNote}</p>
            <blockquote className="solution-icp" dir="auto">{u.example}</blockquote>
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="site-width split">
          <h2 className="solution-h2">{u.getTitle}</h2>
          <ul className="solution-list">{u.get.map((x) => <li key={x.slice(0, 24)}>{x}</li>)}</ul>
        </div>
      </section>

      <section className="section">
        <div className="site-width split">
          <h2 className="solution-h2">{u.limitsTitle}</h2>
          <ul className="solution-list">{u.limits.map((x) => <li key={x.slice(0, 24)}>{x}</li>)}</ul>
        </div>
      </section>

      <Faq title={c.faqTitle} items={u.faq} />

      <section className="section alt">
        <div className="site-width">
          <div className="section-head"><h2 className="display-font">{c.solutionsTitle}</h2></div>
          <ul className="solutions-grid">
            {u.solutions.filter(isSolutionSlug).map((r) => {
              const x = solutions[r][locale];
              return (
                <li key={r}>
                  <Link className="solution-card" href={`/solutions/${r}`}>
                    <strong>{x.name}</strong>
                    <span>{x.tagline}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="section-head" style={{ marginTop: "3rem" }}><h2 className="display-font">{c.related}</h2></div>
          <ul className="solutions-grid">
            {related.map((r) => {
              const x = useCases[r][locale];
              return (
                <li key={r}>
                  <Link className="solution-card" href={`/use-cases/${r}`}>
                    <strong>{x.h1}</strong>
                    <span>{x.metaDescription}</span>
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
