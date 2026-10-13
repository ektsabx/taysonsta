import type { Metadata } from "next";
import Link from "next/link";
import { affiliatesPage } from "@/lib/content/affiliates-page";
import { currentProgram } from "@/lib/affiliates";
import { commissionExamples, commissionLabel, formatCents } from "@/lib/affiliates/program";
import { getPlanCatalog } from "@/lib/plan-catalog";
import { getDictionary } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { getSession } from "@/lib/session";
import { breadcrumbSchema, faqSchema, pageMetadata, webPageSchema } from "@/lib/seo";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Faq } from "@/components/marketing/Faq";

export async function generateMetadata(): Promise<Metadata> {
  const c = affiliatesPage[await getLocale()];
  return pageMetadata({ title: c.seoTitle, absoluteTitle: true, description: c.metaDescription, path: "/affiliates" });
}

// Public affiliate program page (D-178), a landing page since the owner brief
// of 2026-10-12: who it's for, why Yolias is easy to recommend, how the
// commission is calculated (worked examples from the live rate and the live
// plan prices), how to join, the rules and the terms. Every number shown is
// the live program setting (Yolias Admin → Affiliates → Program settings).
export default async function AffiliatesPublicPage() {
  const [locale, program, session, plans, t] = await Promise.all([getLocale(), currentProgram(), getSession(), getPlanCatalog(), getDictionary()]);
  const c = affiliatesPage[locale];
  const s = program?.settings;
  const n = (v: number) => new Intl.NumberFormat("en-US").format(v);
  const facts = s?.enabled ? [
    [c.facts.rate, commissionLabel(s, formatCents)],
    [c.facts.recurring, !s.recurring.enabled ? c.facts.firstOnly : s.recurring.maxPayments ? fmt(c.facts.recurringFor, { count: n(s.recurring.maxPayments) }) : c.facts.recurringAlways],
    [c.facts.hold, locale === "ar" ? `${n(s.holdDays)} يومًا` : `${n(s.holdDays)} days`],
    [c.facts.minPayout, formatCents(s.minPayoutCents)],
    [c.facts.window, locale === "ar" ? `${n(s.attribution.days)} يومًا` : `${n(s.attribution.days)} days`],
  ] : [];
  const rate = s ? commissionLabel(s, formatCents) : null;
  const examples = s?.enabled ? commissionExamples(s, { pro: plans.pro.priceUsd, growth: plans.growth.priceUsd, scale: plans.scale.priceUsd }) : [];
  const cta = s?.enabled ? <Link className="btn-solid" href={session ? "/partners" : "/partners/join"}>{session ? c.cta.signedIn : c.cta.signedOut}</Link> : null;
  return (
    <>
      <JsonLd nodes={[webPageSchema({ title: c.seoTitle, description: c.metaDescription, path: "/affiliates" }), breadcrumbSchema([{ name: "Yolias", path: "/" }, { name: c.seoTitle, path: "/affiliates" }]), faqSchema(c.faq)]} />
      <section className="page-hero">
        <div className="site-width">
          <p className="eyebrow">{c.eyebrow}</p>
          <h1 className="display-font max-w-[900px]">{c.title}</h1>
          <p className="lead">{c.lead}</p>
          {s?.enabled && rate && (
            <p className="affiliate-rate"><strong dir="ltr">{fmt(c.heroRate, { rate })}</strong> <span>{c.heroRateNote}</span></p>
          )}
          {cta ? <div className="hero-actions">{cta}</div> : <p className="solution-note">{c.closed}</p>}
        </div>
      </section>

      <section className="section">
        <div className="site-width">
          <div className="section-head"><h2 className="display-font">{c.audienceTitle}</h2><p>{c.audienceLead}</p></div>
          <div className="tiles three">
            {c.audiences.map((a) => (
              <div className="tile" key={a.title}><h3>{a.title}</h3><p>{a.body}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="site-width">
          <div className="section-head"><h2 className="display-font">{c.whyTitle}</h2></div>
          <div className="tiles">
            {c.why.map((w) => (
              <div className="tile" key={w.title}><h3>{w.title}</h3><p>{w.body}</p></div>
            ))}
          </div>
        </div>
      </section>

      {examples.length > 0 && s ? (
        <section className="section">
          <div className="site-width">
            <div className="section-head"><h2 className="display-font">{c.calcTitle}</h2><p>{c.calcLead}</p></div>
            <div className="comparison-wrap">
              <table className="comparison-table affiliate-calc">
                <thead>
                  <tr><th>{c.calcCols.plan}</th><th>{c.calcCols.payment}</th><th>{c.calcCols.perPayment}</th><th>{c.calcCols.perCustomer}</th></tr>
                </thead>
                <tbody>
                  {examples.map((e) => (
                    <tr key={`${e.plan}_${e.period}`}>
                      <td>{t.plans[e.plan]}</td>
                      <td dir="ltr" className="text-start">{formatCents(e.paymentCents)} <span className="affiliate-calc-period">{e.period === "annual" ? c.annual : c.monthly}</span></td>
                      <td dir="ltr" className="text-start"><strong>{formatCents(e.perPaymentCents)}</strong></td>
                      <td dir="ltr" className="text-start">{e.maxCents == null ? c.noLimit : formatCents(e.maxCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="solution-note">{c.calcNote}</p>
          </div>
        </section>
      ) : null}

      {facts.length ? (
        <section className="section" id="terms">
          <div className="site-width split">
            <h2 className="solution-h2">{c.termsTitle}</h2>
            <dl className="affiliate-facts">
              {facts.map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd dir="auto">{v}</dd></div>
              ))}
            </dl>
          </div>
        </section>
      ) : null}

      <section className="section alt">
        <div className="site-width">
          <div className="section-head"><h2 className="display-font">{c.stepsTitle}</h2></div>
          <ol className="tiles solution-steps">
            {c.steps.map((st, i) => (
              <li className="tile" key={st.title}>
                <div className="step-num">0{i + 1}</div>
                <h3>{st.title}</h3>
                <p>{st.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="site-width split">
          <h2 className="solution-h2">{c.rulesTitle}</h2>
          <ul className="solution-list">{c.rules.map((r) => <li key={r.slice(0, 24)}>{r}</li>)}</ul>
        </div>
      </section>

      <Faq title={c.faqTitle} items={c.faq} />

      {s?.enabled ? (
        <section className="cta-band">
          <div className="site-width">
            <h2 className="display-font">{c.cta.title}</h2>
            <p>{c.cta.body}</p>
            <div className="hero-actions">{cta}</div>
          </div>
        </section>
      ) : null}
    </>
  );
}
