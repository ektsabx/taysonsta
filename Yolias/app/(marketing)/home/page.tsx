import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Gauge, Languages, Layers, MessageSquareText, Mic, Paperclip, Image as ImageIcon, ArrowUp } from "lucide-react";
import { home } from "@/lib/content/site";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { getSession } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return { title: `Yolias — ${home[locale].title}`, description: t.meta.description };
}

const tileIcons = [MessageSquareText, Layers, Gauge, Languages];

// Public home page (served at "/" for visitors via the proxy rewrite).
export default async function HomePage() {
  const [locale, session] = await Promise.all([getLocale(), getSession()]);
  const c = home[locale];
  const start = session ? "/" : "/signup";

  return (
    <>
      <section className="page-hero center">
        <div className="site-width">
          <p className="eyebrow">{c.eyebrow}</p>
          <h1 className="display-font">{c.title}</h1>
          <p className="lead">{c.lead}</p>
          <div className="hero-actions">
            <Link className="btn-solid" href={start}>{c.primary}</Link>
            <Link className="btn-ghost" href="/product">{c.secondary}<ArrowRight className="flip-rtl" /></Link>
          </div>

          <div className="preview mt-14 text-start" aria-hidden="true">
            <div className="preview-bar"><i /><i /><i /></div>
            <div className="preview-body">
              <div className="prompt-container">
                <p className="preview-prompt">{c.preview.prompt}</p>
                <div className="prompt-footer">
                  <div className="prompt-attachments">
                    <span className="btn-attach"><Mic /></span>
                    <span className="btn-attach"><ImageIcon /></span>
                    <span className="btn-attach"><Paperclip /></span>
                  </div>
                  <span className="btn-send"><ArrowUp /></span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--soft)] p-4">
                <div className="flex items-center gap-2 text-[.78rem] font-bold uppercase text-[#10b981]"><CheckCircle2 width={16} height={16} />{c.preview.status}</div>
                <span className="text-[.76rem] font-semibold text-[var(--muted)]">{c.preview.note}</span>
                <div className="w-full">{c.preview.chips.map((ch, i) => <span key={ch} className={`chip${i === c.preview.chips.length - 1 ? " red" : ""}`}>{ch}</span>)}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
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

      <section className="cta-band">
        <div className="site-width">
          <h2 className="display-font">{c.cta.title}</h2>
          <p>{c.cta.body}</p>
          <div className="hero-actions">
            <Link className="btn-solid" href={start}>{c.cta.primary}</Link>
            <Link className="btn-ghost" href="/pricing">{c.cta.secondary}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
