import type { Metadata } from "next";
import { Prose } from "@/components/marketing/Prose";
import { Toc } from "@/components/marketing/Toc";
import { JsonLd } from "@/components/marketing/JsonLd";
import { currentProgram } from "@/lib/affiliates";
import { fillBlocks, termsValues } from "@/lib/affiliates/terms-values";
import { partnerTerms, PARTNER_TERMS_UPDATED } from "@/lib/content/partner-terms";
import { formatDate } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { breadcrumbSchema, pageMetadata, webPageSchema } from "@/lib/seo";

// Served at /partners/terms (proxy rewrite; owner brief 2026-10-19). The
// public website layout, the full program terms, live numbers.
const PATH = "/partners/terms";

export async function generateMetadata(): Promise<Metadata> {
  const c = partnerTerms[await getLocale()];
  return pageMetadata({ title: c.seoTitle, absoluteTitle: true, description: c.summary, path: PATH });
}

export default async function PartnerTermsPage() {
  const [locale, t, program] = await Promise.all([getLocale(), getDictionary(), currentProgram()]);
  const c = partnerTerms[locale];
  const blocks = fillBlocks(c.blocks, termsValues(program?.settings, locale));

  return (
    <>
      <JsonLd nodes={[webPageSchema({ title: c.seoTitle, description: c.summary, path: PATH }), breadcrumbSchema([{ name: "Yolias", path: "/" }, { name: t.site.affiliates, path: "/affiliates" }, { name: c.title, path: PATH }])]} />
      <div className="site-width doc-layout">
        <article className="doc-main">
          <h1 className="doc-title">{c.title}</h1>
          <p className="doc-summary">{c.summary}</p>
          <p className="doc-meta">
            {fmt(t.site.lastUpdated, { date: formatDate(PARTNER_TERMS_UPDATED, locale, "UTC") })}
            {program ? <> · <span dir="ltr">{fmt(c.version, { version: program.termsVersion })}</span></> : null}
          </p>
          <div className="doc-divider" />
          <Prose blocks={blocks} />
        </article>
        <Toc blocks={blocks} title={t.site.onThisPage} />
      </div>
    </>
  );
}
