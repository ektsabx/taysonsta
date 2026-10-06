import type { Metadata } from "next";
import Link from "next/link";
import { blogHero } from "@/lib/content/blog";
import { blogPosts } from "@/lib/content/store";
import { readingMinutes } from "@/lib/content/types";
import { formatDate } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: `${blogHero[locale].title} — Yolias`, description: blogHero[locale].lead };
}

export default async function BlogPage() {
  const posts = await blogPosts();
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const hero = blogHero[locale];
  return (
    <>
      <section className="page-hero">
        <div className="site-width">
          <p className="eyebrow">{hero.eyebrow}</p>
          <h1 className="display-font">{hero.title}</h1>
          <p className="lead">{hero.lead}</p>
        </div>
      </section>
      <section className="section">
        <div className="site-width post-grid">
          {posts.map((p, i) => {
            const doc = p.doc[locale];
            return (
              <Link key={p.slug} href={`/blog/${p.slug}`} className={`post-card${i === 0 ? " featured" : ""}`}>
                <div className="post-meta">
                  <b>{p.category[locale]}</b>
                  <span>{formatDate(p.date, locale, "UTC")}</span>
                  <span>{fmt(t.site.minRead, { count: readingMinutes(doc.blocks) })}</span>
                </div>
                <h2>{doc.title}</h2>
                <p>{doc.summary}</p>
                <span className="read">{t.site.readMore} {locale === "ar" ? "←" : "→"}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
