import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { about } from "@/lib/content/site";
import { getDictionary, getLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).site.about} — Yolias` };
}

export default async function AboutPage() {
  const c = about[await getLocale()];
  return (
    <>
      <section className="page-hero">
        <div className="site-width">
          <p className="eyebrow">{c.eyebrow}</p>
          <h1 className="display-font max-w-[900px]">{c.title}</h1>
          <p className="lead">{c.lead}</p>
        </div>
      </section>

      <section className="section">
        <div className="site-width split">
          <h3>{c.storyTitle}</h3>
          <div className="prose">{c.story.map((p) => <p key={p.slice(0, 20)}>{p}</p>)}</div>
        </div>
      </section>

      <section className="section alt">
        <div className="site-width">
          <div className="section-head">
            <p className="eyebrow">{c.principlesEyebrow}</p>
            <h2 className="display-font">{c.principlesTitle}</h2>
          </div>
          <div className="tiles">
            {c.principles.map((p, i) => (
              <div className="tile" key={p.title}>
                <div className="step-num">0{i + 1}</div>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="site-width split">
          <h3>{c.makerTitle}</h3>
          <div>
            <p className="text-[1.02rem] leading-8 text-[var(--text-2)]">{c.maker}</p>
            <a className="btn-ghost mt-5" href="https://taysonsta.com" target="_blank" rel="noopener noreferrer">{c.makerLink}<ArrowUpRight /></a>
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="site-width">
          <h2 className="display-font">{c.cta.title}</h2>
          <p>{c.cta.body}</p>
          <div className="hero-actions"><Link className="btn-solid" href="/contact">{c.cta.primary}</Link></div>
        </div>
      </section>
    </>
  );
}
