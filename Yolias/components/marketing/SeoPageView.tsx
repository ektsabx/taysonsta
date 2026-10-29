import Link from "@/components/LocaleLink";
import { ExternalLink } from "lucide-react";
import { Faq } from "@/components/marketing/Faq";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Prose, Rich } from "@/components/marketing/Prose";
import { breadcrumbSchema, faqSchema, webPageSchema } from "@/lib/seo";
import { seoBase, type SeoKind, type SeoPage, type Competitor } from "@/lib/content/seo-pages";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";

// One SEO page (D-257) from its Admin row: the search answered first, then
// the comparison, criteria and steps, the body, real questions, related pages
// and one call to action. Competitor facts come from Admin → SEO →
// Competitors; a price shows only once a person verified it, with its source
// and date. Nothing here is invented: an empty field renders nothing.

const copy = {
  en: {
    kinds: { compare: "Comparisons", alternatives: "Alternatives", solution: "Solutions", template: "Templates" } as Record<SeoKind, string>,
    point: "Compared", yolias: "Yolias", pricing: "Pricing", notPublished: "Not published; quoted by sales", seePricing: "See the pricing page",
    audience: "Who this is for", criteria: "What to look for", steps: "How to do it with Yolias", tools: "The tools compared",
    bestFor: "Best for", strengths: "Strengths", limits: "Limits", website: "Website", checked: "Checked {date}", source: "source",
    prompt: "The request this template starts with", promptNote: "It opens in Yolias AI for you to edit before anything runs.", open: "Open this template in Yolias",
    faq: "Questions", related: "Related pages", reviewed: "Facts about other products were checked against their own websites on {date}. Products change: check their pages before you decide.",
    preview: "Preview: this page isn't public yet.", trySignup: "Try Yolias", seePricingCta: "See pricing",
    yoliasPrice: (p: YoliasPrices) => [p.payg ? `Pay As You Go from $${p.payg}` : null, ...p.plans.map((x) => `${x.name} $${x.price}/month`)].filter(Boolean).join(" · "),
  },
  ar: {
    kinds: { compare: "المقارنات", alternatives: "البدائل", solution: "الحلول", template: "القوالب" } as Record<SeoKind, string>,
    point: "وجه المقارنة", yolias: "يولياس", pricing: "الأسعار", notPublished: "غير منشورة؛ يحددها فريق المبيعات", seePricing: "صفحة الأسعار",
    audience: "لمن هذه الصفحة", criteria: "ما الذي تبحث عنه", steps: "كيف تنفّذها مع يولياس", tools: "الأدوات في المقارنة",
    bestFor: "الأنسب لـ", strengths: "نقاط القوة", limits: "الحدود", website: "الموقع", checked: "تمت المراجعة {date}", source: "المصدر",
    prompt: "الطلب الذي يبدأ به القالب", promptNote: "يفتح في Yolias AI لتعدّله قبل أن يبدأ أي شيء.", open: "افتح القالب في يولياس",
    faq: "أسئلة شائعة", related: "صفحات ذات صلة", reviewed: "راجعنا المعلومات عن المنتجات الأخرى من مواقعها الرسمية بتاريخ {date}. المنتجات تتغير، فراجع صفحاتها قبل أن تقرر.",
    preview: "معاينة: هذه الصفحة غير منشورة بعد.", trySignup: "جرّب يولياس", seePricingCta: "عرض الأسعار",
    yoliasPrice: (p: YoliasPrices) => [p.payg ? `الدفع حسب الاستخدام من ${p.payg}$` : null, ...p.plans.map((x) => `${x.name} ${x.price}$ شهريًا`)].filter(Boolean).join(" · "),
  },
};

export interface YoliasPrices { payg: number | null; plans: { name: string; price: number }[] }

export function SeoPageView({ page, locale, tools, related, prices, preview = false }: {
  page: SeoPage;
  locale: Locale;
  /** Competitor records by slug (only the ones the page names are used). */
  tools: Map<string, Competitor>;
  /** Other live pages to link to. */
  related: SeoPage[];
  prices: YoliasPrices;
  preview?: boolean;
}) {
  const c = copy[locale];
  const p = page.copy[locale];
  const index = seoBase[page.kind];
  const ctaHref = page.kind === "template" && p.prompt ? `/start?template=${page.slug}` : "/signup";
  const versus = page.kind === "compare" && page.format === "versus" && page.competitor ? tools.get(page.competitor) ?? null : null;
  const listed = (page.format === "list" || page.kind === "alternatives" ? page.tools : []).map((s) => tools.get(s)).filter((x): x is Competitor => Boolean(x));
  const reviewedDates = [versus, ...listed].map((x) => x?.lastReviewedAt).filter((d): d is string => Boolean(d)).sort();
  const reviewed = reviewedDates.length ? reviewedDates[0] : null;
  const links = [
    ...p.links,
    ...related.filter((r) => r.id !== page.id && !p.links.some((l) => l.path === r.path)).slice(0, 3).map((r) => ({ path: r.path, label: r.copy[locale].title })),
  ];
  const date = (d: string) => formatDate(d, locale);

  return (
    <>
      {page.schema && !preview && (
        <JsonLd nodes={[
          webPageSchema({ title: p.metaTitle, description: p.metaDescription, path: page.path }),
          breadcrumbSchema([{ name: "Yolias", path: "/" }, { name: c.kinds[page.kind], path: index }, { name: p.title, path: page.path }]),
          ...(p.faq.length ? [faqSchema(p.faq)] : []),
        ]} />
      )}
      {preview && <div className="seo-preview-bar" role="status">{c.preview}</div>}
      <section className="page-hero">
        <div className="site-width">
          <p className="eyebrow"><Link href={index}>{c.kinds[page.kind]}</Link> · {p.title}</p>
          <h1 className="display-font max-w-[900px]">{p.h1}</h1>
          {p.lead && <p className="lead">{p.lead}</p>}
          <div className="hero-actions">
            <Link className="btn-solid" href={ctaHref}>{p.cta.label || c.trySignup}</Link>
            <Link className="btn-ghost" href="/pricing">{c.seePricingCta}</Link>
          </div>
        </div>
      </section>

      {p.answer && (
        <section className="section">
          <div className="site-width split">
            <h2 className="solution-h2">{p.title}</h2>
            <div className="prose"><p className="usecase-answer"><Rich text={p.answer} /></p></div>
          </div>
        </section>
      )}

      {versus && (
        <section className="section alt">
          <div className="site-width">
            <div className="section-head"><h2 className="display-font">{c.yolias} / {versus.name}</h2></div>
            <div className="prose-table seo-compare">
              <table>
                <thead><tr><th scope="col">{c.point}</th><th scope="col">{c.yolias}</th><th scope="col">{versus.name}</th></tr></thead>
                <tbody>
                  {p.compare.map((r) => (
                    <tr key={r.label}><th scope="row">{r.label}</th><td data-label={c.yolias}><Rich text={r.yolias} /></td><td data-label={versus.name}><Rich text={r.them} /></td></tr>
                  ))}
                  <tr>
                    <th scope="row">{c.pricing}</th>
                    <td data-label={c.yolias}>{c.yoliasPrice(prices)} (<Link href="/pricing">{c.seePricing}</Link>)</td>
                    <td data-label={versus.name}><CompetitorPrices tool={versus} c={c} date={date} /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {versus && (
        <section className="section">
          <div className="site-width">
            <ul className="seo-tools seo-tools-2">
              <ToolCard tool={versus} c={c} date={date} />
            </ul>
          </div>
        </section>
      )}

      {p.audience.length > 0 && (
        <section className="section alt">
          <div className="site-width split">
            <h2 className="solution-h2">{c.audience}</h2>
            <ul className="solution-list">{p.audience.map((x) => <li key={x}><Rich text={x} /></li>)}</ul>
          </div>
        </section>
      )}

      {p.criteria.length > 0 && (
        <section className="section">
          <div className="site-width split">
            <h2 className="solution-h2">{c.criteria}</h2>
            <ul className="solution-list">{p.criteria.map((x) => <li key={x}><Rich text={x} /></li>)}</ul>
          </div>
        </section>
      )}

      {listed.length > 0 && (
        <section className="section alt">
          <div className="site-width">
            <div className="section-head"><h2 className="display-font">{c.tools}</h2></div>
            <ul className="seo-tools">{listed.map((t) => <ToolCard key={t.slug} tool={t} c={c} date={date} />)}</ul>
          </div>
        </section>
      )}

      {p.steps.length > 0 && (
        <section className="section">
          <div className="site-width">
            <div className="section-head"><h2 className="display-font">{c.steps}</h2></div>
            <ol className="tiles solution-steps">
              {p.steps.map((s, i) => (
                <li className="tile" key={s.title}>
                  <div className="step-num">{String(i + 1).padStart(2, "0")}</div>
                  <h3>{s.title}</h3>
                  {s.body && <p><Rich text={s.body} /></p>}
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {p.prompt && page.kind === "template" && (
        <section className="section alt">
          <div className="site-width split">
            <h2 className="solution-h2">{c.prompt}</h2>
            <div>
              <p className="solution-icp-intro">{c.promptNote}</p>
              <blockquote className="solution-icp" dir="auto">{p.prompt}</blockquote>
              <div className="hero-actions"><Link className="btn-solid" href={ctaHref}>{c.open}</Link></div>
            </div>
          </div>
        </section>
      )}

      {p.blocks.length > 0 && (
        <section className="section">
          <div className="site-width seo-body"><Prose blocks={p.blocks} /></div>
        </section>
      )}

      {reviewed && (versus || listed.length > 0) && (
        <section className="section seo-reviewed"><div className="site-width"><p>{c.reviewed.replace("{date}", date(reviewed))}</p></div></section>
      )}

      {p.faq.length > 0 && <Faq title={c.faq} items={p.faq} />}

      {links.length > 0 && (
        <section className="section alt">
          <div className="site-width">
            <div className="section-head"><h2 className="display-font">{c.related}</h2></div>
            <ul className="solutions-grid">
              {links.map((l) => <li key={l.path}><Link className="solution-card" href={l.path}><strong>{l.label}</strong></Link></li>)}
            </ul>
          </div>
        </section>
      )}

      <section className="cta-band">
        <div className="site-width">
          {p.cta.title && <h2 className="display-font">{p.cta.title}</h2>}
          {p.cta.body && <p>{p.cta.body}</p>}
          <div className="hero-actions">
            <Link className="btn-solid" href={ctaHref}>{p.cta.label || c.trySignup}</Link>
            <Link className="btn-ghost" href="/pricing">{c.seePricingCta}</Link>
          </div>
        </div>
      </section>
    </>
  );
}

type Copy = (typeof copy)["en"] | (typeof copy)["ar"];

function CompetitorPrices({ tool, c, date }: { tool: Competitor; c: Copy; date: (d: string) => string }) {
  if (tool.prices.length) {
    return (
      <>
        {tool.prices.map((x) => `${x.plan} ${x.price}${x.period ? `/${x.period}` : ""}`).join(" · ")}{" "}
        <span className="seo-src">(<a href={tool.prices[0].sourceUrl} target="_blank" rel="noopener noreferrer nofollow">{c.source}</a>, {date(tool.prices[0].checkedAt)})</span>
      </>
    );
  }
  if (tool.publishesPrices === false) return <>{c.notPublished}</>;
  return tool.pricingUrl ? <a href={tool.pricingUrl} target="_blank" rel="noopener noreferrer nofollow">{c.seePricing}</a> : null;
}

function ToolCard({ tool, c, date }: { tool: Competitor; c: Copy; date: (d: string) => string }) {
  return (
    <li className="seo-tool">
      <div className="seo-tool-head">
        <h3>{tool.name}</h3>
        <a href={tool.website} target="_blank" rel="noopener noreferrer nofollow" aria-label={`${tool.name}: ${c.website}`}><ExternalLink size={16} /></a>
      </div>
      {tool.summary && <p>{tool.summary}</p>}
      {tool.bestFor && <p><strong>{c.bestFor}:</strong> {tool.bestFor}</p>}
      {tool.strengths.length > 0 && (<><h4>{c.strengths}</h4><ul>{tool.strengths.map((x) => <li key={x}>{x}</li>)}</ul></>)}
      {tool.limits.length > 0 && (<><h4>{c.limits}</h4><ul>{tool.limits.map((x) => <li key={x}>{x}</li>)}</ul></>)}
      <p className="seo-tool-price"><strong>{c.pricing}:</strong> <CompetitorPrices tool={tool} c={c} date={date} /></p>
      {tool.lastReviewedAt && <p className="seo-src">{c.checked.replace("{date}", date(tool.lastReviewedAt))}</p>}
    </li>
  );
}
