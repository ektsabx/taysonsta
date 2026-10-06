import type { Metadata } from "next";
import Link from "next/link";
import { contactPage } from "@/lib/content/site";
import { getLocale } from "@/lib/i18n/server";
import { ContactForm } from "./ContactForm";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: `${contactPage[locale].title} — Yolias`, description: contactPage[locale].lead };
}

const topics = ["sales", "support", "partnerships", "press", "other"];

export default async function ContactPage({ searchParams }: PageProps<"/contact">) {
  const c = contactPage[await getLocale()];
  const { topic } = await searchParams;
  const defaultTopic = typeof topic === "string" && topics.includes(topic) ? topic : "sales";

  return (
    <>
      <section className="page-hero">
        <div className="site-width">
          <p className="eyebrow">{c.eyebrow}</p>
          <h1 className="display-font">{c.title}</h1>
          <p className="lead">{c.lead}</p>
        </div>
      </section>
      <section className="section">
        <div className="site-width contact-grid">
          <div className="contact-ways">
            {c.ways.map((w) => (
              <div className="contact-way" key={w.title}>
                <strong>{w.title}</strong>
                <span>{w.body}</span>
                {w.link && <span className="mt-2"><Link href={w.link.href}>{w.link.label}</Link></span>}
              </div>
            ))}
          </div>
          <ContactForm title={c.formTitle} defaultTopic={defaultTopic} />
        </div>
      </section>
    </>
  );
}
