import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Handshake, Users } from "lucide-react";
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

const wayIcons = [Users, BookOpen, Handshake];

// Community (owner brief 2026-10-19), same sections as lovable.dev/community;
// joining = the Yolias Facebook group.
export default async function CommunityPage() {
  const locale = await getLocale();
  const c = communityPage[locale];
  const href = (h: string) => (h === "community" ? COMMUNITY_URL : h);
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
            <Link className="btn-ghost" href="/affiliates">{c.secondary}</Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="site-width">
          <p className="community-overview">{c.overview}</p>
          <div className="tiles three mt-10">
            {c.ways.map((w, i) => {
              const Icon = wayIcons[i % wayIcons.length];
              return (
                <div className="tile community-way" key={w.title}>
                  <div className="tile-icon"><Icon /></div>
                  <h3>{w.title}</h3>
                  <p>{w.body}</p>
                  {w.external
                    ? <a className="community-link" href={href(w.href)} target="_blank" rel="noopener noreferrer">{w.link} <ArrowUpRight width={15} height={15} aria-hidden="true" /></a>
                    : <Link className="community-link" href={w.href}>{w.link}</Link>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="site-width split">
          <h2 className="solution-h2">{c.events.title}</h2>
          <div>
            <p className="community-body">{c.events.body}</p>
            <div className="hero-actions"><Link className="btn-solid" href="/contact?topic=partnerships">{c.events.cta}</Link></div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="site-width split">
          <h2 className="solution-h2">{c.partner.title}</h2>
          <div>
            <p className="community-body">{c.partner.body}</p>
            <div className="hero-actions"><Link className="btn-ghost" href="/affiliates">{c.partner.cta}</Link></div>
          </div>
        </div>
      </section>

      <Faq title={c.faqTitle} items={c.faq} />

      <section className="cta-band">
        <div className="site-width">
          <h2 className="display-font">{c.final.title}</h2>
          <p>{c.final.body}</p>
          <div className="hero-actions">
            <a className="btn-solid" href={COMMUNITY_URL} target="_blank" rel="noopener noreferrer">{c.final.primary}</a>
            <Link className="btn-ghost" href="/pricing">{c.final.secondary}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
