import Link from "@/components/LocaleLink";
import { Check } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import { Faq } from "@/components/marketing/Faq";
import { solutionPageLabels, solutionPages } from "@/lib/content/solution-pages";

// The full page for one kind of business (owner, 2026-11-05).
export function SolutionFull({ slug, locale }: { slug: string; locale: Locale }) {
  const p = solutionPages[slug]?.[locale];
  if (!p) return null;
  const L = solutionPageLabels[locale];
  return (
    <>
      <section className="section">
        <div className="site-width split"><h2 className="solution-h2">{L.who}</h2><div className="prose"><p>{p.who}</p></div></div>
      </section>
      <section className="section alt">
        <div className="site-width">
          <div className="section-head"><h2 className="display-font">{L.pains}</h2></div>
          <div className="sd-cards">{p.pains.map((x) => <article key={x.t}><h3>{x.t}</h3><p>{x.b}</p></article>)}</div>
        </div>
      </section>
      <section className="section">
        <div className="site-width">
          <div className="section-head"><h2 className="display-font">{L.audiences}</h2><p>{L.audiencesLead}</p></div>
          <div className="sd-cards">{p.audiences.map((x) => <article key={x.name}><h3>{x.name}</h3><p>{x.target}</p></article>)}</div>
        </div>
      </section>
      <section className="section alt">
        <div className="site-width split">
          <div><h2 className="solution-h2">{L.email}</h2><p className="sd-note">{L.emailLead}</p></div>
          <div className="sd-mail" dir="auto"><strong>{p.email.subject}</strong><p>{p.email.body}</p></div>
        </div>
      </section>
      <section className="section">
        <div className="site-width">
          <div className="section-head"><h2 className="display-font">{L.plan}</h2></div>
          <ol className="sd-month">{p.plan.map(([k, v]) => <li key={k}><strong>{k}</strong><span>{v}</span></li>)}</ol>
          <h3 className="sd-h3">{L.watch}</h3>
          <ul className="sd-grid">{p.watch.map((x) => <li key={x}><Check />{x}</li>)}</ul>
        </div>
      </section>
      <section className="section alt">
        <div className="site-width">
          <div className="section-head"><h2 className="display-font">{L.cost}</h2><p>{L.costLead}</p></div>
          <div className="sd-table"><table><tbody>{L.costRows.map((r) => <tr key={r[0]}><th scope="row">{r[0]}</th><td>{r[1]}</td><td>{r[2]}</td></tr>)}</tbody></table></div>
          <p className="sd-note">{L.costNote}</p>
          <div className="hero-actions"><Link className="btn-solid" href="/signup">{L.start}</Link><Link className="btn-ghost" href="/use-cases">{L.cases}</Link></div>
        </div>
      </section>
      <Faq title={L.faq} items={p.faq.map(([q, a]) => ({ q, a }))} />
    </>
  );
}
