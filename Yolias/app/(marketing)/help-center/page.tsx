import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Rocket, Sparkles, Users } from "lucide-react";
import { articles, collections, helpHero } from "@/lib/content/help";
import { fmt } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { HelpSearch } from "./HelpSearch";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).site.helpCenter} — Yolias` };
}

const icons = { rocket: Rocket, sparkles: Sparkles, users: Users };

export default async function HelpCenterPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const hero = helpHero[locale];

  return (
    <>
      <section className="help-hero">
        <div className="site-width">
          <h1>{hero.title}</h1>
          <HelpSearch items={articles.map((a) => ({ slug: a.slug, title: a.doc[locale].title, summary: a.doc[locale].summary }))} />
        </div>
      </section>

      <section className="section">
        <div className="site-width">
          <h2 className="mb-5 text-lg font-bold">{hero.collectionsTitle}</h2>
          <div className="collections">
            {collections.map((c) => {
              const Icon = icons[c.icon];
              const count = articles.filter((a) => a.collection === c.id).length;
              return (
                <a key={c.id} href={`#${c.id}`} className="collection">
                  <div className="tile-icon"><Icon /></div>
                  <h3>{c.text[locale].title}</h3>
                  <p>{c.text[locale].description}</p>
                  <small>{fmt(t.help.articles, { count })}</small>
                </a>
              );
            })}
          </div>

          {collections.map((c) => (
            <div key={c.id} id={c.id} className="mt-14 scroll-mt-24">
              <h2 className="mb-3 text-lg font-bold">{c.text[locale].title}</h2>
              <div className="article-list">
                {articles.filter((a) => a.collection === c.id).map((a) => (
                  <Link key={a.slug} href={`/help-center/${a.slug}`} className="article-link">
                    <div>
                      <strong>{a.doc[locale].title}</strong>
                      <span>{a.doc[locale].summary}</span>
                    </div>
                    <ChevronRight className="flip-rtl" />
                  </Link>
                ))}
              </div>
            </div>
          ))}

          <div className="help-cta">
            <strong>{t.help.stillNeed}</strong>
            <Link className="btn-ghost" href="/contact?topic=support">{t.help.contactUs}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
