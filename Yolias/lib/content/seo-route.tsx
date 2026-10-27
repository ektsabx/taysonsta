import "server-only";
import type { Metadata } from "next";
import Link from "@/components/LocaleLink";
import { SeoPageView, type YoliasPrices } from "@/components/marketing/SeoPageView";
import { JsonLd } from "@/components/marketing/JsonLd";
import { getPlanCatalog } from "@/lib/plan-catalog";
import { offeredPlans } from "@/lib/plans";
import { topUps } from "@/lib/credits";
import { switches } from "@/lib/switches";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { breadcrumbSchema, pageMetadata, webPageSchema } from "@/lib/seo";
import type { Locale } from "@/lib/i18n/config";
import { competitors, seoPage, seoPages } from "./seo-store";
import { seoBase, type SeoKind, type SeoPage } from "./seo-pages";

// The routes of the SEO pages (D-257): /compare, /alternatives, /templates
// and the Admin-made pages under /solutions share this.

export async function seoMetadata(page: SeoPage | null): Promise<Metadata> {
  if (!page) return {};
  const p = page.copy[await getLocale()];
  const meta = await pageMetadata({ title: p.metaTitle.includes("Yolias") ? p.metaTitle : `${p.metaTitle} | Yolias`, absoluteTitle: true, description: p.metaDescription, path: page.canonical ?? page.path });
  return page.noindex ? { ...meta, robots: { index: false, follow: true } } : meta;
}

export async function yoliasPrices(): Promise<YoliasPrices> {
  const [plans, t, on] = await Promise.all([getPlanCatalog(), getDictionary(), switches()]);
  const packs = on.buy_more ? await topUps() : [];
  return {
    payg: packs.length ? Math.min(...packs.map((x) => x.priceUsd)) : null,
    plans: offeredPlans.filter((k) => plans[k]?.priceUsd > 0).map((k) => ({ name: t.plans[k].replace(/^Yolias\s+/, ""), price: plans[k].priceUsd })),
  };
}

export async function renderSeoPage(page: SeoPage, opts: { preview?: boolean } = {}) {
  const locale = await getLocale();
  const [tools, siblings, prices] = await Promise.all([competitors(locale), seoPages(page.kind), yoliasPrices()]);
  return <SeoPageView page={page} locale={locale} tools={tools} related={siblings} prices={prices} preview={opts.preview} />;
}

export async function loadSeoPage(kind: SeoKind, slug: string) {
  return seoPage(kind, slug);
}

const indexCopy: Record<Exclude<SeoKind, "solution">, Record<Locale, { title: string; lead: string; description: string }>> = {
  compare: {
    en: { title: "Yolias compared", lead: "How Yolias compares with other prospecting, data and outreach tools: who each one is for, what it does and what it doesn't, from each product's own pages.", description: "Side-by-side comparisons of Yolias with other lead generation, B2B data and cold email tools, with sources and review dates." },
    ar: { title: "مقارنات يولـياس", lead: "كيف يقارن يولـياس بأدوات البحث عن العملاء والبيانات والتواصل الأخرى: لمن تناسب كل أداة، وما الذي تفعله وما لا تفعله، من صفحات كل منتج الرسمية.", description: "مقارنات جنبًا إلى جنب بين يولـياس وأدوات جذب العملاء وبيانات الشركات والبريد البارد، مع المصادر وتواريخ المراجعة." },
  },
  alternatives: {
    en: { title: "Alternatives", lead: "Looking for another tool? What to weigh when you switch, and the options worth a look for each one.", description: "Alternatives to popular prospecting and outreach tools, with selection criteria and when Yolias is a good fit." },
    ar: { title: "البدائل", lead: "تبحث عن أداة أخرى؟ ما الذي تزنه عند التبديل، والخيارات التي تستحق النظر لكل أداة.", description: "بدائل لأدوات البحث عن العملاء والتواصل الشائعة، مع معايير الاختيار ومتى يكون يولـياس مناسبًا." },
  },
  template: {
    en: { title: "Prospecting templates", lead: "Ready-made ways to find the right companies and people: the criteria, the steps and a request you can open in Yolias AI and edit.", description: "B2B prospecting templates: find companies by industry, location and size, and the decision makers in them, then open the template in Yolias." },
    ar: { title: "قوالب البحث عن العملاء", lead: "طرق جاهزة لإيجاد الشركات والأشخاص المناسبين: المعايير والخطوات وطلب تفتحه في Yolias AI وتعدّله.", description: "قوالب للبحث عن عملاء B2B: اعثر على الشركات حسب القطاع والموقع والحجم وعلى صنّاع القرار فيها، ثم افتح القالب في يولـياس." },
  },
};

export async function seoIndexMetadata(kind: Exclude<SeoKind, "solution">): Promise<Metadata> {
  const c = indexCopy[kind][await getLocale()];
  const pages = await seoPages(kind);
  const meta = await pageMetadata({ title: `${c.title} | Yolias`, absoluteTitle: true, description: c.description, path: seoBase[kind] });
  return pages.length ? meta : { ...meta, robots: { index: false, follow: true } };
}

/** The list of one kind's live pages (an empty list says so and isn't indexed). */
export async function SeoIndex({ kind }: { kind: Exclude<SeoKind, "solution"> }) {
  const locale = await getLocale();
  const c = indexCopy[kind][locale];
  const pages = await seoPages(kind);
  const others = kind === "compare" ? await seoPages("alternatives") : kind === "alternatives" ? await seoPages("compare") : [];
  return (
    <>
      <JsonLd nodes={[webPageSchema({ title: c.title, description: c.description, path: seoBase[kind], type: "CollectionPage" }), breadcrumbSchema([{ name: "Yolias", path: "/" }, { name: c.title, path: seoBase[kind] }])]} />
      <section className="page-hero">
        <div className="site-width">
          <h1 className="display-font max-w-[900px]">{c.title}</h1>
          <p className="lead">{c.lead}</p>
        </div>
      </section>
      <section className="section">
        <div className="site-width">
          {pages.length ? (
            <ul className="solutions-grid">
              {pages.map((p) => (
                <li key={p.id}>
                  <Link className="solution-card" href={p.path}><strong>{p.copy[locale].title}</strong><span>{p.copy[locale].metaDescription}</span></Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="lead">{locale === "ar" ? "لا توجد صفحات منشورة هنا بعد." : "Nothing is published here yet."}</p>
          )}
          {others.length > 0 && (
            <ul className="solutions-grid" style={{ marginTop: "2rem" }}>
              {others.map((p) => (
                <li key={p.id}><Link className="solution-card" href={p.path}><strong>{p.copy[locale].title}</strong><span>{p.copy[locale].metaDescription}</span></Link></li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
