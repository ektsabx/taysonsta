import type { Metadata } from "next";
import Link from "next/link";
import { Check, Languages, ListChecks, MessageSquareText, Send, X } from "lucide-react";
import { home } from "@/lib/content/site";
import { getLocale } from "@/lib/i18n/server";
import { HOME_TITLE, faqSchema, organizationSchema, pageMetadata, websiteSchema } from "@/lib/seo";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Faq } from "@/components/marketing/Faq";
import { CustomerCount, FounderNote } from "@/components/marketing/SocialProof";
import { getSession } from "@/lib/session";
import { trialAvailable } from "@/lib/payments";
import { fmt } from "@/lib/i18n/config";

// The home title is fixed by the owner (2026-10-19), word for word, in both languages.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return pageMetadata({ title: HOME_TITLE, absoluteTitle: true, description: home[locale].lead, path: "/" });
}

const tileIcons = [MessageSquareText, ListChecks, Send, Languages];

// Public home page (served at "/" for visitors via the proxy rewrite).
// Conversion pass (owner brief 2026-10-20): outcome headline, one primary
// action, the manual way vs Yolias, how it works,
// what you get, answers to the questions that stop a signup, one closing CTA.
export default async function HomePage() {
  const [locale, session, trialDays] = await Promise.all([getLocale(), getSession(), trialAvailable()]);
  const c = home[locale];
  const start = session ? "/" : "/signup";
  const primary = trialDays ? c.primaryTrial : c.primary;

  return (
    <>
      <JsonLd nodes={[organizationSchema(), websiteSchema(), faqSchema(c.faq.items)]} />
      <section className="page-hero center">
        <div className="site-width">
          <p className="eyebrow">{c.eyebrow}</p>
          <h1 className="display-font">{c.title}</h1>
          <p className="lead">{c.lead}</p>
          <div className="hero-actions">
            <Link className="btn-solid" href={start}>{primary}</Link>
            <a className="btn-ghost" href="#how">{c.secondary}</a>
          </div>
          <p className="hero-reassure">{trialDays ? fmt(c.reassureTrial, { days: trialDays }) : c.reassure}</p>
        </div>
      </section>

      <CustomerCount locale={locale} />

      <section className="section alt">
        <div className="site-width">
          <div className="section-head">
            <p className="eyebrow">{c.compare.eyebrow}</p>
            <h2 className="display-font">{c.compare.title}</h2>
          </div>
          <div className="compare-table" role="table" aria-label={c.compare.title}>
            <div className="compare-row compare-head" role="row">
              <span role="columnheader">{c.compare.without}</span>
              <span role="columnheader">{c.compare.with}</span>
            </div>
            {c.compare.rows.map((r) => (
              <div className="compare-row" role="row" key={r.after}>
                <span role="cell" className="compare-before"><X aria-hidden="true" />{r.before}</span>
                <span role="cell" className="compare-after"><Check aria-hidden="true" />{r.after}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="site-width">
          <div className="section-head">
            <p className="eyebrow">{c.how.eyebrow}</p>
            <h2 className="display-font">{c.how.title}</h2>
          </div>
          <div className="steps">
            {c.how.steps.map((s, i) => (
              <div className="step" key={s.title}>
                <div className="step-num">0{i + 1}</div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="site-width">
          <div className="section-head">
            <p className="eyebrow">{c.features.eyebrow}</p>
            <h2 className="display-font">{c.features.title}</h2>
          </div>
          <div className="tiles">
            {c.features.tiles.map((tile, i) => {
              const Icon = tileIcons[i];
              return (
                <div className="tile" key={tile.title}>
                  <div className="tile-icon"><Icon /></div>
                  <h3>{tile.title}</h3>
                  <p>{tile.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="site-width statement">
          <p>{c.statement.text}</p>
          <small>{c.statement.small}</small>
        </div>
      </section>

      <FounderNote locale={locale} />

      <Faq eyebrow={c.faq.eyebrow} title={c.faq.title} items={c.faq.items} />

      <section className="cta-band">
        <div className="site-width">
          <h2 className="display-font">{c.cta.title}</h2>
          <p>{c.cta.body}</p>
          <div className="hero-actions">
            <Link className="btn-solid" href={start}>{trialDays ? c.cta.primaryTrial : c.cta.primary}</Link>
            <Link className="btn-ghost" href="/pricing">{c.cta.secondary}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
