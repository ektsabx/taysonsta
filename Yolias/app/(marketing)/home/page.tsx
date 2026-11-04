import type { Metadata } from "next";
import Link from "@/components/LocaleLink";
import { BarChart3, Bot, CalendarCheck, Check, Copy, DollarSign, Inbox, Megaphone, Pause, Pencil, Plus, Radio, Sparkles, Split, Users, UserSearch } from "lucide-react";
import { landing } from "@/lib/content/landing";
import { getLocale } from "@/lib/i18n/server";
import { HOME_DESCRIPTION, HOME_TITLE, HOME_TITLE_AR, faqSchema, organizationSchema, pageMetadata, websiteSchema } from "@/lib/seo";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Faq } from "@/components/marketing/Faq";
import { ProductShot } from "@/components/marketing/ProductShot";
import { getSession } from "@/lib/session";

// The home title (owner, 2026-11-02, D-275): "Yolias - AI Advertising Platform
// for Customer Acquisition"; /ar carries it fully in Arabic, brand first.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return pageMetadata({ title: locale === "ar" ? HOME_TITLE_AR : HOME_TITLE, absoluteTitle: true, description: HOME_DESCRIPTION[locale], path: "/" });
}

const capIcons = [Megaphone, Users, DollarSign, Radio, UserSearch, Inbox, BarChart3];
const actionIcons = [Plus, Pause, Pencil, Copy, BarChart3, Split];
const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: n % 1 ? 2 : 0 })}`;
const num = (n: number) => n.toLocaleString("en-US");

function Head({ eyebrow, title, body, center }: { eyebrow: string; title: string; body?: string; center?: boolean }) {
  return (
    <div className={`section-head${center ? " lp-center" : ""}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="display-font">{title}</h2>
      {body && <p>{body}</p>}
    </div>
  );
}

/** A product visual drawn with sample data, marked as an example. */
function Mock({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`lp-mock ${className}`}>
      <span className="lp-example">{label}</span>
      {children}
    </div>
  );
}

// Public home page (owner brief 2026-11-03): Yolias as an advertising platform
// for customer acquisition campaigns, in 18 sections from the hero to the
// footer. Real product screens where they exist; sample-data visuals are
// marked "Example".
export default async function HomePage() {
  const [locale, session] = await Promise.all([getLocale(), getSession()]);
  const c = landing[locale];
  const start = session ? "/" : "/signup";
  const m = c.manager;
  const faq = c.faq.items.map(([q, a]) => ({ q, a }));
  const cpm = (r: (typeof m.rows)[number]) => (r.meetings ? usd(Math.round((r.spend / r.meetings) * 100) / 100) : "–");

  return (
    <div className="lp-home">
      <JsonLd nodes={[organizationSchema(), websiteSchema(), faqSchema(faq)]} />

      {/* 2. Hero */}
      <section className="page-hero center lp-hero">
        <div className="site-width">
          <div className="lp-hero-copy">
            <p className="eyebrow">{c.hero.eyebrow}</p>
            <h1 className="display-font">{c.hero.title}</h1>
            <p className="lead">{c.hero.lead}</p>
            <p className="lead lp-lead2">{c.hero.lead2}</p>
            <div className="hero-actions">
              <Link className="btn-solid" href={start}>{c.hero.primary}</Link>
              <a className="btn-ghost" href="#platform">{c.hero.secondary}</a>
            </div>
            <p className="hero-reassure">{c.hero.under}</p>
          </div>
          <div className="lp-hero-shot"><ProductShot name="campaigns" locale={locale} alt={c.hero.shotAlt} priority /></div>
        </div>
      </section>

      {/* 3. What is Yolias */}
      <section className="section" id="platform">
        <div className="site-width lp-split">
          <div>
            <Head eyebrow={c.intro.eyebrow} title={c.intro.title} />
            {c.intro.body.map((p) => <p className="lp-p" key={p}>{p}</p>)}
          </div>
          <ProductShot name="dashboard" locale={locale} alt={c.intro.shotAlt} />
        </div>
      </section>

      {/* 4. Capabilities */}
      <section className="section alt">
        <div className="site-width">
          <Head eyebrow={c.capabilities.eyebrow} title={c.capabilities.title} />
          <div className="lp-caps">
            {c.capabilities.cards.map((card, i) => {
              const Icon = capIcons[i];
              return (
                <div className="tile" key={card.title}>
                  <div className="tile-icon"><Icon /></div>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Campaign Manager */}
      <section className="section">
        <div className="site-width">
          <Head eyebrow={m.eyebrow} title={m.title} body={m.body.join(" ")} />
          <Mock label={c.example}>
            <div className="lp-table-wrap">
              <table className="lp-table">
                <thead><tr><th aria-label="on/off" />{m.columns.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {m.rows.map((r) => (
                    <tr key={r.name}>
                      <td><span className={`lp-sw${r.status === "on" ? " on" : ""}`}><i /></span></td>
                      <th scope="row">{r.name}</th>
                      <td>{r.channel}</td>
                      <td>{r.audience}</td>
                      <td>{num(r.contacted)}</td>
                      <td>{num(r.replies)}</td>
                      <td>{num(r.interested)}</td>
                      <td><strong>{num(r.meetings)}</strong></td>
                      <td>{usd(r.spend)}</td>
                      <td>{cpm(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Mock>
          <div className="lp-chips">
            {m.actions.map((a, i) => { const Icon = actionIcons[i]; return <span className="lp-chip" key={a}><Icon />{a}</span>; })}
          </div>
          <p className="lp-message">{m.message}</p>
        </div>
      </section>

      {/* 6. Audiences */}
      <section className="section alt">
        <div className="site-width lp-split">
          <div>
            <Head eyebrow={c.audience.eyebrow} title={c.audience.title} body={c.audience.body} />
            <ul className="lp-checks">{c.audience.points.map((p) => <li key={p}><Check />{p}</li>)}</ul>
          </div>
          <Mock label={c.example} className="lp-card">
            <h3 className="lp-card-title"><Users />{c.audience.example.name}</h3>
            <dl className="lp-kv">{c.audience.example.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            <p className="lp-foot">{c.audience.example.size}</p>
          </Mock>
        </div>
      </section>

      {/* 7. Budget */}
      <section className="section">
        <div className="site-width lp-split">
          <Mock label={c.example} className="lp-card">
            <div className="lp-stats">{c.budget.stats.map(([k, v]) => <div key={k}><span>{k}</span><strong>{v}</strong></div>)}</div>
            <p className="lp-sub">{c.budget.split.title}</p>
            {c.budget.split.rows.map(([k, v]) => (
              <div className="lp-bar" key={k}><span>{k}</span><i style={{ width: `${v}%` }} /><b>{v}%</b></div>
            ))}
          </Mock>
          <div>
            <Head eyebrow={c.budget.eyebrow} title={c.budget.title} body={c.budget.body} />
            <p className="lp-message">{c.budget.message}</p>
          </div>
        </div>
      </section>

      {/* 8. Channels */}
      <section className="section alt">
        <div className="site-width lp-split">
          <div><Head eyebrow={c.channels.eyebrow} title={c.channels.title} body={c.channels.body} /></div>
          <div className="lp-mock lp-card">
            <p className="lp-sub">{c.channels.setting}</p>
            {c.channels.list.map((name) => (
              <div className="lp-channel live" key={name}><span className="lp-radio" />{name}</div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Research and personalization */}
      <section className="section">
        <div className="site-width lp-split">
          <div>
            <Head eyebrow={c.research.eyebrow} title={c.research.title} body={c.research.body} />
            <ul className="lp-checks">{c.research.points.map((p) => <li key={p}><Check />{p}</li>)}</ul>
          </div>
          <Mock label={c.example} className="lp-card">
            <div className="lp-person"><span className="lp-avatar">{c.research.lead.name.split(" ").map((w) => w.replace(/^ال/, "")[0]).join("").slice(0, 2)}</span><div><strong>{c.research.lead.name}</strong><span>{c.research.lead.title} · {c.research.lead.company}</span></div></div>
            <ul className="lp-facts">{c.research.lead.facts.map((f) => <li key={f}><Sparkles />{f}</li>)}</ul>
            <div className="lp-email"><strong>{c.research.lead.subject}</strong><p>{c.research.lead.message}</p></div>
          </Mock>
        </div>
      </section>

      {/* 10. Yolias AI */}
      <section className="section alt">
        <div className="site-width lp-split">
          <div>
            <Head eyebrow={c.ai.eyebrow} title={c.ai.title} body={c.ai.body} />
            <div className="lp-chips">{c.ai.uses.map((u) => <span className="lp-chip" key={u}><Bot />{u}</span>)}</div>
          </div>
          <Mock label={c.example} className="lp-card lp-chat">
            <p className="lp-q">{c.ai.chat.q}</p>
            <p className="lp-a"><Sparkles />{c.ai.chat.a}</p>
          </Mock>
        </div>
      </section>

      {/* 11. Leads */}
      <section className="section">
        <div className="site-width">
          <Head eyebrow={c.leads.eyebrow} title={c.leads.title} body={c.leads.body} />
          <Mock label={c.example}>
            <div className="lp-table-wrap">
              <table className="lp-table">
                <thead><tr>{c.leads.columns.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{c.leads.rows.map((r) => <tr key={r[0]}>{r.map((v, i) => (i === 0 ? <th scope="row" key={i}>{v}</th> : i === 5 ? <td key={i}><span className="lp-pill">{v}</span></td> : <td key={i}>{v}</td>))}</tr>)}</tbody>
              </table>
            </div>
          </Mock>
          <p className="lp-message">{c.leads.message}</p>
        </div>
      </section>

      {/* 12. Conversations */}
      <section className="section alt">
        <div className="site-width lp-split">
          <div><Head eyebrow={c.conversations.eyebrow} title={c.conversations.title} body={c.conversations.body} /></div>
          <Mock label={c.example} className="lp-card">
            <div className="lp-thread-head"><strong>{c.conversations.thread.who}</strong><span>{c.conversations.thread.campaign}</span><span className="lp-pill">{c.conversations.thread.state}</span></div>
            {c.conversations.thread.messages.map((msg, i) => <p key={i} className={`lp-msg ${msg.from}`}>{msg.text}</p>)}
          </Mock>
        </div>
      </section>

      {/* 13. Meetings and results */}
      <section className="section">
        <div className="site-width lp-split">
          <div>
            <Head eyebrow={c.meetings.eyebrow} title={c.meetings.title} body={c.meetings.body} />
            <ul className="lp-checks">{c.meetings.points.map((p) => <li key={p}><Check />{p}</li>)}</ul>
          </div>
          <Mock label={c.example} className="lp-card">
            {c.meetings.rows.map((r) => <div className="lp-meeting" key={r.who}><CalendarCheck /><div><strong>{r.who}</strong><span>{r.campaign}</span></div><b>{r.when}</b></div>)}
            <div className="lp-stats one"><div><span>{c.meetings.costLabel}</span><strong>$31.00</strong></div></div>
          </Mock>
        </div>
      </section>

      {/* 14. Performance */}
      <section className="section alt">
        <div className="site-width">
          <Head eyebrow={c.analytics.eyebrow} title={c.analytics.title} body={c.analytics.body} />
          <Mock label={c.example}>
            <div className="lp-kpis">{c.analytics.kpis.map(([k, v]) => <div key={k}><span>{k}</span><strong>{v}</strong></div>)}</div>
            <svg className="lp-chart" viewBox="0 0 600 120" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 100 L60 92 L120 95 L180 80 L240 72 L300 76 L360 58 L420 50 L480 41 L540 34 L600 22 L600 120 L0 120 Z" className="lp-area" />
              <path d="M0 100 L60 92 L120 95 L180 80 L240 72 L300 76 L360 58 L420 50 L480 41 L540 34 L600 22" className="lp-line" />
            </svg>
          </Mock>
        </div>
      </section>

      {/* 15. Integrations */}
      <section className="section">
        <div className="site-width">
          <Head eyebrow={c.integrations.eyebrow} title={c.integrations.title} body={c.integrations.body} />
          <div className="lp-integrations">
            {c.integrations.items.map((it) => <div className="tile" key={it.name}><h3>{it.name}</h3><p>{it.body}</p></div>)}
          </div>
        </div>
      </section>

      {/* 16. Who it is for (examples, not customer results) */}
      <section className="section alt">
        <div className="site-width">
          <Head eyebrow={c.results.eyebrow} title={c.results.title} body={c.results.body} />
          <div className="tiles three">
            {c.results.scenarios.map((s) => (
              <Link className="tile lp-scenario" href={s.href} key={s.who}>
                <h3>{s.who}</h3>
                <p><strong>{s.goal}</strong></p>
                <p>{s.setup}</p>
              </Link>
            ))}
          </div>
          <p className="lp-note">{c.results.note}</p>
        </div>
      </section>

      {/* 17. Pricing and FAQ */}
      <section className="section">
        <div className="site-width lp-split">
          <div>
            <Head eyebrow={c.pricing.eyebrow} title={c.pricing.title} body={c.pricing.body} />
            <Link className="btn-solid" href="/pricing">{c.pricing.cta}</Link>
          </div>
          <ul className="lp-checks lp-card lp-mock">{c.pricing.points.map((p) => <li key={p}><Check />{p}</li>)}</ul>
        </div>
      </section>
      <Faq eyebrow={c.faq.eyebrow} title={c.faq.title} items={faq} />

      {/* 18. Final CTA (the footer follows from the layout) */}
      <section className="cta-band">
        <div className="site-width">
          <h2 className="display-font">{c.cta.title}</h2>
          <p>{c.cta.body}</p>
          <p><strong>{c.cta.strong}</strong></p>
          <div className="hero-actions">
            <Link className="btn-solid" href={start}>{c.cta.primary}</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
