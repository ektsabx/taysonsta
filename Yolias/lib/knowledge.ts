import "server-only";
import { pricingFaq } from "@/lib/pricing-copy";
import { trialAvailable } from "@/lib/payments";
import { blogPosts, docPages, helpArticles, legalDocs } from "@/lib/content/store";
import { legalSlugs } from "@/lib/content/legal";
import { home, about } from "@/lib/content/site";
import { affiliatesPage } from "@/lib/content/affiliates-page";
import { partnerTerms } from "@/lib/content/partner-terms";
import { communityPage } from "@/lib/content/community-page";
import { solutions, solutionSlugs } from "@/lib/content/solutions";
import { useCases, useCaseSlugs } from "@/lib/content/use-cases";
import { indexableSeoPages } from "@/lib/content/seo-store";
import type { Block, Doc } from "@/lib/content/types";
import { currentProgram } from "@/lib/affiliates";
import { fillBlocks, termsValues } from "@/lib/affiliates/terms-values";
import { getPlanCatalog } from "@/lib/plan-catalog";
import { offeredPlans } from "@/lib/plans";
import { topUps } from "@/lib/credits";
import { COMMUNITY_URL } from "@/lib/community";
import { DEFINITION, siteUrl } from "@/lib/seo";
import { en } from "@/lib/i18n/dictionaries/en";
import { ar } from "@/lib/i18n/dictionaries/ar";
import type { Locale } from "@/lib/i18n/config";

// Everything Yolias says publicly, as plain text, in both languages (owner
// brief 2026-10-19): the support AI agent in Yolias Admin answers from it
// (Admin → Support → Knowledge → "Sync Yolias content"), and /llms-full.txt
// gives AI assistants the same text. Live values (plan prices, trial, the
// affiliate program) are read when the feed is built, never copied by hand.

export interface KnowledgeItem {
  /** Stable id: kind + slug + language. */
  key: string;
  kind: "platform" | "pricing" | "help" | "docs" | "blog" | "legal" | "affiliates" | "community" | "solutions" | "use-cases" | "seo";
  language: Locale;
  title: string;
  url: string;
  content: string;
}

const locales: Locale[] = ["en", "ar"];

/** Blocks → readable text; links keep their address so answers can point to them. */
export function blocksToText(blocks: Block[], base: string): string {
  const rich = (s: string) => s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, href: string) => `${label} (${href.startsWith("/") ? base + href : href})`);
  return blocks.map((b) => {
    if ("h2" in b) return `\n## ${b.h2}`;
    if ("h3" in b) return `### ${b.h3}`;
    if ("p" in b) return rich(b.p);
    if ("ul" in b) return b.ul.map((x) => `- ${rich(x)}`).join("\n");
    if ("ol" in b) return b.ol.map((x, i) => `${i + 1}. ${rich(x)}`).join("\n");
    if ("note" in b) return `Note: ${rich(b.note)}`;
    if ("table" in b) return [b.table.head.join(" | "), ...b.table.rows.map((r) => r.map(rich).join(" | "))].join("\n");
    return b.figure.caption ? rich(b.figure.caption) : "";
  }).filter(Boolean).join("\n").trim();
}

const docText = (d: Doc, base: string) => `${d.summary}\n\n${blocksToText(d.blocks, base)}`;
const qa = (items: { q: string; a: string }[]) => items.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n");

export async function knowledgeFeed(): Promise<KnowledgeItem[]> {
  const base = siteUrl();
  const [help, docs, posts, legal, plans, packs, program, trialDays, seo] = await Promise.all([helpArticles(), docPages(), blogPosts(), legalDocs(), getPlanCatalog(), topUps().catch(() => []), currentProgram().catch(() => null), trialAvailable().catch(() => null), indexableSeoPages().catch(() => [])]);
  const out: KnowledgeItem[] = [];
  const push = (kind: KnowledgeItem["kind"], slug: string, language: Locale, title: string, path: string, content: string) =>
    out.push({ key: `${kind}:${slug}:${language}`, kind, language, title, url: base + path, content: content.trim() });

  for (const l of locales) {
    const d = l === "ar" ? ar : en;
    const h = home[l];
    const ab = about[l];
    // What Yolias is, how it works, the home FAQ.
    push("platform", "overview", l, l === "ar" ? "ما هو يولـياس وكيف يعمل" : "What Yolias is and how it works", "/", [
      l === "en" ? DEFINITION : h.lead,
      d.composer.subtitle,
      `${h.how.title}\n${h.how.steps.map((s, i) => `${i + 1}. ${s.title}: ${s.body}`).join("\n")}`,
      `${h.features.title}\n${h.features.tiles.map((x) => `- ${x.title}: ${x.body}`).join("\n")}`,
      `${ab.title}\n${ab.lead}\n${ab.story.join("\n")}`,
      `${h.faq.title}\n${qa(h.faq.items)}`,
    ].join("\n\n"));

    // How campaign emails go out (owner, 2026-10-28): facts the code enforces.
    push("platform", "sending", l, l === "ar" ? "كيف تُرسل رسائل الحملات" : "How campaign emails are sent", "/", l === "ar" ? [
      "تُرسل رسائل الحملات من بريدك المتصل (Gmail أو Outlook أو أي بريد عبر IMAP/SMTP)، في أيام وساعات الإرسال التي تحددها (افتراضيًا من الاثنين إلى الجمعة، 9 صباحًا إلى 6 مساءً بتوقيت صاحب البريد).",
      "كل رسالة حملة تنتهي بسطر لإلغاء الاشتراك، وتحمل ترويسة List-Unsubscribe بنقرة واحدة (RFC 8058) فيظهر زر إلغاء الاشتراك في Gmail وغيره. من يلغي اشتراكه يُعلَّم «عدم التواصل» وتتوقف كل الحملات له.",
      "طلبات التوقف في الردود تُحترم دائمًا. الرد التلقائي «خارج المكتب» لا يُحسب ردًا في التحليلات، وتنتظر المتابعة التالية 7 أيام.",
      "أسماء المدن بالعربية والإنجليزية تتطابق في البحث والتصفية: «القاهرة» تجد Cairo، و«الرياض» تجد Riyadh.",
    ].join("\n") : [
      "Campaign emails go out from your connected mailbox (Gmail, Outlook or any mailbox over IMAP/SMTP), on the sending days and hours you set (by default Monday to Friday, 9 am to 6 pm in the mailbox owner's time zone).",
      "Every campaign email ends with an unsubscribe line and carries a one-click List-Unsubscribe header (RFC 8058), so Gmail and other mail apps show their Unsubscribe button. Whoever unsubscribes is marked do not contact and every campaign to them stops.",
      "Stop requests in replies are always honoured. An out-of-office auto-reply isn't counted as a reply in analytics, and the next follow-up waits 7 days.",
      "City names in Arabic and English match in searches and filters: «القاهرة» finds Cairo and «الرياض» finds Riyadh.",
    ].join("\n"));

    // Pay As You Go, the two monthly plans (live), pricing FAQ (D-247).
    const money = (v: number) => `$${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
    const planLines = offeredPlans.map((p) => {
      const t = plans[p];
      return `- ${d.plans[p]}: ${money(t.priceUsd)} / month, billed monthly (no annual billing).${t.priceEgp ? ` In Egypt: EGP ${t.priceEgp.toLocaleString("en-US")} / month.` : ""} ${t.prospects.toLocaleString("en-US")} prospects per month, unlimited users, Team Workspace.`;
    });
    const payg = packs.length
      ? `- Pay As You Go: prepaid credit, no subscription and no renewal, no free credit. Top-ups: ${packs.map((x) => `${money(x.priceUsd)} = ${x.prospects.toLocaleString("en-US")} prospects`).join(", ")}. The amount is chosen in Checkout, the credit is added after the payment is confirmed and doesn't expire.`
      : "- Pay As You Go: not available right now.";
    push("pricing", "plans", l, l === "ar" ? "الخطط والأسعار" : "Plans and prices", "/pricing", [
      d.pricing.heroSupport,
      `${payg}\n${planLines.join("\n")}`,
      `The prospect is the only unit: writing and sending emails is never charged or limited, uploaded contacts are unlimited, and the same prospect is never counted twice. No free trial. Card payments go through Paymob (Visa, Mastercard, Meeza).`,
      `Prices are in USD (EGP in Egypt) and don’t include tax.`,
      `${d.pricing.faqTitle}\n${pricingFaq(d.pricing, trialDays).map(([q, a]) => `Q: ${q}\nA: ${a}`).join("\n\n")}`,
    ].join("\n\n"));

    for (const a of help) push("help", a.slug, l, a.doc[l].title, `/help-center/${a.slug}`, docText(a.doc[l], base));
    for (const p of docs) push("docs", p.slug, l, p.doc[l].title, `/docs/${p.slug}`, docText(p.doc[l], base));
    for (const p of posts) push("blog", p.slug, l, p.doc[l].title, `/blog/${p.slug}`, docText(p.doc[l], base));
    for (const s of legalSlugs) push("legal", s, l, legal[s][l].title, `/legal/${s}`, docText(legal[s][l], base));

    // Affiliate program: page, live terms, partner terms.
    const ap = affiliatesPage[l];
    const pt = partnerTerms[l];
    push("affiliates", "program", l, ap.seoTitle, "/affiliates", [
      ap.lead,
      `${ap.audienceTitle}\n${ap.audiences.map((x) => `- ${x.title}: ${x.body}`).join("\n")}`,
      `${ap.stepsTitle}\n${ap.steps.map((x, i) => `${i + 1}. ${x.title}: ${x.body}`).join("\n")}`,
      `${ap.rulesTitle}\n${ap.rules.map((x) => `- ${x}`).join("\n")}`,
      `${ap.network.title}: ${ap.network.lead} ${ap.network.tiersNote}`,
      `Join: ${base}/partners/join · Sign in: ${base}/partners/login`,
      `${ap.faqTitle}\n${qa(ap.faq)}`,
    ].join("\n\n"));
    push("affiliates", "terms", l, pt.title, "/partners/terms", `${pt.summary}\n\n${blocksToText(fillBlocks(pt.blocks, termsValues(program?.settings, l)), base)}`);

    const cp = communityPage[l];
    push("community", "community", l, cp.title, "/community", [cp.lead, cp.overview, `Facebook group: ${COMMUNITY_URL}`, cp.ways.map((w) => `- ${w.title}: ${w.body}`).join("\n"), `${cp.faqTitle}\n${qa(cp.faq)}`].join("\n\n"));

    for (const s of solutionSlugs) {
      const x = solutions[s][l];
      push("solutions", s, l, x.title, `/solutions/${s}`, [x.lead, x.pillars.map((p) => `- ${p.title}: ${p.body}`).join("\n"), `${x.helpsTitle}\n${x.helps.map((p) => `- ${p.title}: ${p.body}`).join("\n")}`, `${x.stepsTitle}\n${x.steps.map((p, i) => `${i + 1}. ${p}`).join("\n")}`, x.value].join("\n\n"));
    }
    for (const s of useCaseSlugs) {
      const x = useCases[s][l];
      push("use-cases", s, l, x.title, `/use-cases/${s}`, [x.answer, x.lead, `${x.stepsTitle}\n${x.steps.map((p, i) => `${i + 1}. ${p.title}: ${p.body}`).join("\n")}`, `${x.limitsTitle}\n${x.limits.map((p) => `- ${p}`).join("\n")}`, qa(x.faq)].join("\n\n"));
    }
    // Comparisons, alternatives, audiences and templates published from Admin → SEO (D-257).
    for (const p of seo) {
      const x = p.copy[l];
      push("seo", `${p.kind}-${p.slug}`, l, x.title, p.path, [x.answer, x.lead, x.compare.map((r) => `- ${r.label}: Yolias: ${r.yolias} | Other: ${r.them}`).join("\n"), x.criteria.map((c) => `- ${c}`).join("\n"), x.steps.map((st, i) => `${i + 1}. ${st.title}: ${st.body}`).join("\n"), blocksToText(x.blocks, base), qa(x.faq)].filter(Boolean).join("\n\n"));
    }
  }
  return out;
}
