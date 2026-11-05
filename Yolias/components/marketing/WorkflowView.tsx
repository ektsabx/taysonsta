import Link from "@/components/LocaleLink";
import { Check } from "lucide-react";
import { WorkflowDemo } from "./WorkflowDemo";
import type { Locale } from "@/lib/i18n/config";
import { workflowLabels, type Workflow } from "@/lib/content/workflows";

// A use case as a working guide (owner, 2026-11-05): the problem, what it uses,
// then numbered steps beside real screenshots.
export function WorkflowView({ w, locale, all }: { w: Workflow; locale: Locale; all: Workflow[] }) {
  const x = w.text[locale], L = workflowLabels[locale];
  const related = w.related.map((s) => all.find((x) => x.slug === s)).filter((r): r is Workflow => Boolean(r));
  return (
    <div className="wf">
      <section className="page-hero">
        <div className="site-width">
          <p className="eyebrow"><Link href="/use-cases">{locale === "ar" ? "حالات الاستخدام" : "USE CASES"}</Link> · {x.name}</p>
          <h1 className="display-font max-w-[900px]">{x.title}</h1>
          <p className="lead">{x.lead}</p>
          <div className="hero-actions"><Link className="btn-solid" href="/signup">{L.start}</Link></div>
          <p className="wf-date">{L.updated}: <time dateTime={w.updated}>{w.updated}</time></p>
        </div>
      </section>
      <section className="section">
        <div className="site-width wf-cols">
          <div>
            <h2 className="solution-h2">{L.before}</h2>
            <div className="prose">{x.problem.map((p) => <p key={p}>{p}</p>)}</div>
            <h2 className="solution-h2 wf-gap">{L.how}</h2>
            <ol className="wf-how">{x.how.map((h) => <li key={h}>{h}</li>)}</ol>
          </div>
          <aside className="wf-side">
            <h2>{L.used}</h2>
            <ul>{x.used.map((u) => <li key={u.name}><strong>{u.name}</strong><span>{u.role}</span></li>)}</ul>
            {w.template && <><h2>{L.resources}</h2><Link className="wf-res" href={w.template}>{L.template}</Link></>}
          </aside>
        </div>
      </section>
      <section className="section alt">
        <div className="site-width">
          <WorkflowDemo steps={x.steps} locale={locale} />
          <h2 className="solution-h2 wf-gap">{L.steps}</h2>
          <ol className="wf-steps">
            {x.steps.map((s, i) => (
              <li key={s.title}>
                <div>
                  <p className="wf-n">{L.step} {i + 1}</p>
                  <h3>{s.title}</h3>
                  <p className="wf-where"><b>{L.where}:</b> {s.where}</p>
                  {s.body.map((b) => <p key={b}>{b}</p>)}
                  <p className="wf-result"><Check /><span><b>{L.result}:</b> {s.result}</span></p>
                </div>
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/use-cases/${s.shot}-${locale}.png`} alt={s.title} loading="lazy" />
                  <figcaption>{L.example}</figcaption>
                </figure>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="section">
        <div className="site-width wf-cols">
          <div><h2 className="solution-h2">{L.act}</h2><ul className="lp-checks wf-act">{x.act.map((a) => <li key={a}><Check />{a}</li>)}</ul></div>
          <aside className="wf-side">
            <h2>{L.related}</h2>
            <ul>
              {related.map((r) => <li key={r.slug}><Link href={`/use-cases/${r.slug}`}>{r.text[locale].name}</Link></li>)}
              {w.help.map((h) => <li key={h.href}><Link href={h.href}>{h.label[locale]}</Link></li>)}
            </ul>
          </aside>
        </div>
      </section>
      <section className="cta-band"><div className="site-width"><h2 className="display-font">{L.ready}</h2><p>{L.readyLead}</p><Link className="btn-solid" href="/signup">{L.start}</Link></div></section>
    </div>
  );
}
