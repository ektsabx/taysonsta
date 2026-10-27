import type { Metadata } from "next";
import { JsonLd } from "@/components/marketing/JsonLd";
import { pageMetadata, webPageSchema } from "@/lib/seo";
import Link from "@/components/LocaleLink";
import { contactPage } from "@/lib/content/site";
import { getLocale } from "@/lib/i18n/server";
import { ContactForm } from "./ContactForm";
import { captchaConfig } from "@/lib/auth/captcha";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return pageMetadata({ title: `${contactPage[locale].title.replace(/[.。]$/, "")} | Yolias`, description: contactPage[locale].lead, path: "/contact" });
}

const topics = ["sales", "support", "partnerships", "press", "other"];

export default async function ContactPage({ searchParams }: PageProps<"/contact">) {
  const c = contactPage[await getLocale()];
  const { topic } = await searchParams;
  const defaultTopic = typeof topic === "string" && topics.includes(topic) ? topic : "sales";

  return (
    <>
      <JsonLd nodes={[webPageSchema({ title: c.title, description: c.lead, path: "/contact", type: "ContactPage" })]} />
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
          <ContactForm title={c.formTitle} defaultTopic={defaultTopic} captchaSiteKey={(await captchaConfig())?.siteKey ?? null} />
        </div>
      </section>
    </>
  );
}
