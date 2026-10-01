import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUp, BarChart3, Check, Download, History, Image as ImageIcon, Mic, Paperclip, Users } from "lucide-react";
import { product } from "@/lib/content/site";
import { getLocale } from "@/lib/i18n/server";
import { getSession } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: `${locale === "ar" ? "يولـياس AI" : "Yolias AI"} — ${product[locale].title}` };
}

const moreIcons = [BarChart3, Download, Users, History];

export default async function ProductPage() {
  const [locale, session] = await Promise.all([getLocale(), getSession()]);
  const c = product[locale];
  const [write, icp, campaign, prospects] = c.sections;

  return (
    <>
      <section className="page-hero">
        <div className="site-width">
          <p className="eyebrow">{c.eyebrow}</p>
          <h1 className="display-font max-w-[880px]">{c.title}</h1>
          <p className="lead">{c.lead}</p>
          <div className="hero-actions">
            <Link className="btn-solid" href={session ? "/" : "/signup"}>{c.primary}</Link>
            <Link className="btn-ghost" href="/docs">{c.secondary}<ArrowRight className="flip-rtl" /></Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="site-width">
          <div className="split">
            <div>
              <h3>{write.title}</h3>
              <p>{write.body}</p>
              <ul className="checklist">{write.points?.map((p) => <li key={p}><Check />{p}</li>)}</ul>
            </div>
            <div className="preview" aria-hidden="true">
              <div className="preview-bar"><i /><i /><i /></div>
              <div className="preview-body">
                <div className="prompt-container">
                  <p className="preview-prompt">{c.icp[1].value} · {c.icp[0].value} · {c.icp[2].value}</p>
                  <div className="prompt-footer">
                    <div className="prompt-attachments">
                      <span className="btn-attach recording-active"><Mic /></span>
                      <span className="btn-attach"><ImageIcon /></span>
                      <span className="btn-attach"><Paperclip /></span>
                    </div>
                    <span className="btn-send"><ArrowUp /></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="split">
            <div className="preview" aria-hidden="true">
              <div className="preview-bar"><i /><i /><i /></div>
              <div className="preview-body">
                <dl className="kv">
                  {c.icp.map((row) => (
                    <div key={row.label} className="contents">
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
            <div>
              <h3>{icp.title}</h3>
              <p>{icp.body}</p>
            </div>
          </div>

          <div className="split">
            <div>
              <h3>{campaign.title}</h3>
              <p>{campaign.body}</p>
            </div>
            <div className="preview" aria-hidden="true">
              <div className="preview-bar"><i /><i /><i /></div>
              <div className="preview-body">
                {c.stages.map((s, i) => (
                  <div key={s} className={`stage${i < 2 ? " done" : i === 2 ? " now" : ""}`}>
                    <span className="stage-dot">{i < 2 ? <Check width={12} height={12} /> : i + 1}</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="split">
            <div className="preview" aria-hidden="true">
              <div className="preview-bar"><i /><i /><i /></div>
              <div className="preview-body wide">
                {c.prospects.map((p) => (
                  <div className="preview-row" key={p.name}>
                    <div>
                      <strong>{p.name}</strong>
                      <div className="muted">{p.role} · {p.company}</div>
                    </div>
                    <span className="font-bold text-[#10b981]" dir="ltr">{p.match}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3>{prospects.title}</h3>
              <p>{prospects.body}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="site-width">
          <div className="section-head">
            <p className="eyebrow">{c.more.eyebrow}</p>
            <h2 className="display-font">{c.more.title}</h2>
          </div>
          <div className="tiles">
            {c.more.tiles.map((tile, i) => {
              const Icon = moreIcons[i];
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

      <section className="cta-band">
        <div className="site-width">
          <h2 className="display-font">{c.cta.title}</h2>
          <p>{c.cta.body}</p>
          <div className="hero-actions">
            <Link className="btn-solid" href={session ? "/" : "/signup"}>{c.cta.primary}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
