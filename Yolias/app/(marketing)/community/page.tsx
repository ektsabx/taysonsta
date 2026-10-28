import type { Metadata } from "next";
import { ArrowUpRight, Lightbulb, MessageCircleQuestion, PenLine, TrendingUp } from "lucide-react";
import { COMMUNITY_URL } from "@/lib/community";
import { communityPage } from "@/lib/content/community-page";
import { getLocale } from "@/lib/i18n/server";
import { breadcrumbSchema, faqSchema, pageMetadata, webPageSchema } from "@/lib/seo";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Faq } from "@/components/marketing/Faq";

export async function generateMetadata(): Promise<Metadata> {
  const c = communityPage[await getLocale()];
  return pageMetadata({ title: c.seoTitle, absoluteTitle: true, description: c.metaDescription, path: "/community" });
}

const wayIcons = [MessageCircleQuestion, PenLine, TrendingUp, Lightbulb];

// Community: the Yolias Facebook group and nothing else (owner, 2026-10-28):
// what happens there, who it's for, how to start, its rules, FAQ.
export default async function CommunityPage() {
  const locale = await getLocale();
  const c = communityPage[locale];
  return (
    <>
      <JsonLd nodes={[webPageSchema({ title: c.seoTitle, description: c.metaDescription, path: "/community" }), breadcrumbSchema([{ name: "Yolias", path: "/" }, { name: c.title, path: "/community" }]), faqSchema(c.faq)]} />
      <section className="page-hero center">
        <div className="site-width">
          <p className="eyebrow">{c.eyebrow}</p>
          <h1 className="display-font">{c.title}</h1>
          <p className="lead">{c.lead}</p>
          <div className="hero-actions">
            <a className="btn-solid" href={COMMUNITY_URL} target="_blank" rel="noopener noreferrer">{c.join} <ArrowUpRight width={16} height={16} aria-hidden="true" /></a>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="site-width">
          <p className="community-overview">{c.overview}</p>
          <h2 className="solution-h2" style={{ marginTop: 48 }}>{c.waysTitle}</h2>
          <div className="tiles community-way-grid">
            {c.ways.map((w, i) => {
              const Icon = wayIcons[i % wayIcons.length];
              return (
                <div className="tile community-way" key={w.title}>
                  <div className="tile-icon"><Icon /></div>
                  <h3>{w.title}</h3>
                  <p>{w.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="site-width split">
          <h2 className="solution-h2">{c.forTitle}</h2>
          <ul className="community-list">{c.forList.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      </section>

      <section className="section">
        <div className="site-width">
          <h2 className="solution-h2">{c.startTitle}</h2>
          <ol className="tiles three community-steps">
            {c.steps.map((st, i) => (
              <li className="tile" key={st.title}><span className="community-step-n">{i + 1}</span><h3>{st.title}</h3><p>{st.body}</p></li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section alt">
        <div className="site-width split">
          <h2 className="solution-h2">{c.rulesTitle}</h2>
          <div>
            <p className="community-body">{c.rulesLead}</p>
            <ul className="community-list">{c.rules.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        </div>
      </section>

      <Faq title={c.faqTitle} items={c.faq} />

      <section className="cta-band">
        <div className="site-width">
          <h2 className="display-font">{c.final.title}</h2>
          <p>{c.final.body}</p>
          <div className="hero-actions">
            <a className="btn-solid" href={COMMUNITY_URL} target="_blank" rel="noopener noreferrer">{c.final.primary} <ArrowUpRight width={16} height={16} aria-hidden="true" /></a>
          </div>
        </div>
      </section>
    </>
  );
}
