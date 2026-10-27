import type { Block, Doc, Localized } from "./types";
import type { Locale } from "@/lib/i18n/config";

// SEO pages edited in Yolias Admin → SEO (D-257): comparisons, alternatives,
// audience solutions and prospecting templates. One content_entries row each
// (kind + slug), both languages; the shape of `meta` and `seo` is checked
// here so a malformed row never reaches a page. Mirrored by the Admin
// editor (lib/yolias/seo-pages.ts) — keep the two in sync.

export const seoKinds = ["compare", "alternatives", "solution", "template"] as const;
export type SeoKind = (typeof seoKinds)[number];

/** Where each kind lives on the site. */
export const seoBase: Record<SeoKind, string> = { compare: "/compare", alternatives: "/alternatives", solution: "/solutions", template: "/templates" };

/** The template a visitor opened with "Open this template in Yolias" (app/start). */
export const TEMPLATE_COOKIE = "yolias_template";

export function seoPath(kind: SeoKind, slug: string): string {
  return `${seoBase[kind]}/${slug}`;
}

export interface Faq { q: string; a: string }
export interface Step { title: string; body: string }
export interface CompareRow { label: string; yolias: string; them: string }
export interface SeoLink { path: string; label: string }

/** One language of an SEO page, ready to render. */
export interface SeoPageCopy {
  /** Page name (lists, breadcrumbs). */
  title: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  /** The opening paragraph under the H1. */
  lead: string;
  /** Two or three sentences that answer the search directly. */
  answer: string;
  audience: string[];
  criteria: string[];
  steps: Step[];
  /** "Yolias vs X": one row per compared point. */
  compare: CompareRow[];
  blocks: Block[];
  faq: Faq[];
  cta: { title: string; body: string; label: string };
  links: SeoLink[];
  /** Templates: the request Yolias AI opens with. */
  prompt: string;
}

export interface SeoPage {
  id: string;
  kind: SeoKind;
  slug: string;
  path: string;
  /** compare: one tool against Yolias ("versus") or a ranked list ("list"). */
  format: "versus" | "list";
  /** The competitor a "versus" or "alternatives" page is about. */
  competitor: string | null;
  /** The tools a list or alternatives page reviews, in order. */
  tools: string[];
  canonical: string | null;
  noindex: boolean;
  schema: boolean;
  updatedAt: string;
  publishedAt: string | null;
  copy: Localized<SeoPageCopy>;
}

type Obj = Record<string, unknown>;
const obj = (x: unknown): Obj => (x && typeof x === "object" && !Array.isArray(x) ? (x as Obj) : {});
const str = (x: unknown): string => (typeof x === "string" ? x.trim() : "");
const strs = (x: unknown): string[] => (Array.isArray(x) ? x.map(str).filter(Boolean) : []);
const loc = (x: unknown, l: Locale): unknown => obj(x)[l];

function list<T>(x: unknown, l: Locale, pick: (o: Obj) => T | null): T[] {
  const v = loc(x, l);
  if (!Array.isArray(v)) return [];
  return v.map((i) => pick(obj(i))).filter((i): i is T => i !== null);
}

/** Internal paths only, no protocol-relative or script URLs. */
export function safePath(p: string): string | null {
  return /^\/(?!\/)[A-Za-z0-9\-._~/%?=&#]*$/.test(p) ? p : null;
}

function copyFor(l: Locale, doc: Doc, meta: Obj, seo: Obj): SeoPageCopy {
  const h1 = str(loc(seo.h1, l)) || doc.title;
  return {
    title: doc.title,
    h1,
    metaTitle: str(loc(seo.meta_title, l)) || h1,
    metaDescription: str(loc(seo.meta_description, l)) || doc.summary,
    lead: doc.summary,
    answer: str(loc(meta.answer, l)),
    audience: strs(loc(meta.audience, l)),
    criteria: strs(loc(meta.criteria, l)),
    steps: list(meta.steps, l, (o) => (str(o.title) ? { title: str(o.title), body: str(o.body) } : null)),
    compare: list(meta.compare, l, (o) => (str(o.label) ? { label: str(o.label), yolias: str(o.yolias), them: str(o.them) } : null)),
    blocks: doc.blocks,
    faq: list(meta.faq, l, (o) => (str(o.q) && str(o.a) ? { q: str(o.q), a: str(o.a) } : null)),
    cta: { title: str(obj(loc(meta.cta, l)).title), body: str(obj(loc(meta.cta, l)).body), label: str(obj(loc(meta.cta, l)).label) },
    links: list(meta.links, l, (o) => { const p = safePath(str(o.path)); return p && str(o.label) ? { path: p, label: str(o.label) } : null; }),
    prompt: str(loc(meta.prompt, l)),
  };
}

function validDoc(x: unknown): x is Doc {
  const d = obj(x);
  return typeof d.title === "string" && d.title.trim().length > 0 && typeof d.summary === "string" && Array.isArray(d.blocks);
}

/** A content_entries row as an SEO page, or null when it isn't one or is malformed. */
export function toSeoPage(row: { id: string; kind: string; slug: string; meta: unknown; doc: unknown; seo: unknown; updated_at: string; published_at: string | null }): SeoPage | null {
  if (!(seoKinds as readonly string[]).includes(row.kind)) return null;
  const doc = obj(row.doc);
  if (!validDoc(doc.en) || !validDoc(doc.ar)) return null;
  const meta = obj(row.meta);
  const seo = obj(row.seo);
  const kind = row.kind as SeoKind;
  const canonical = safePath(str(seo.canonical));
  const path = seoPath(kind, row.slug);
  return {
    id: row.id,
    kind,
    slug: row.slug,
    path,
    format: meta.format === "list" ? "list" : "versus",
    competitor: str(meta.competitor) || null,
    tools: strs(meta.tools),
    canonical: canonical && canonical !== path ? canonical : null,
    noindex: seo.robots === "noindex",
    schema: seo.schema !== "none",
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    copy: { en: copyFor("en", doc.en as Doc, meta, seo), ar: copyFor("ar", doc.ar as Doc, meta, seo) },
  };
}

// ───────────────────────── Competitors ─────────────────────────

export interface CompetitorPrice { plan: string; price: string; period: string; note: string; sourceUrl: string; checkedAt: string }
export interface Competitor {
  slug: string;
  name: string;
  website: string;
  pricingUrl: string | null;
  summary: string;
  bestFor: string;
  strengths: string[];
  limits: string[];
  /** Only prices a person marked verified, each with its source and date. */
  prices: CompetitorPrice[];
  publishesPrices: boolean | null;
  lastReviewedAt: string | null;
}

export function toCompetitor(row: { slug: string; name: string; website: string; pricing_url: string | null; summary: unknown; best_for: unknown; strengths: unknown; limits: unknown; pricing: unknown; publishes_prices: boolean | null; last_reviewed_at: string | null }, l: Locale): Competitor {
  const prices = (Array.isArray(row.pricing) ? row.pricing : []).map(obj)
    .filter((p) => p.verified === true && str(p.price) && /^https:\/\//.test(str(p.source_url)) && str(p.checked_at))
    .map((p) => ({ plan: str(p.plan), price: str(p.price), period: str(p.period), note: str(loc(p.note, l)) || str(p.note), sourceUrl: str(p.source_url), checkedAt: str(p.checked_at) }));
  return {
    slug: row.slug,
    name: row.name,
    website: row.website,
    pricingUrl: row.pricing_url,
    summary: str(loc(row.summary, l)),
    bestFor: str(loc(row.best_for, l)),
    strengths: strs(loc(row.strengths, l)),
    limits: strs(loc(row.limits, l)),
    prices,
    publishesPrices: row.publishes_prices,
    lastReviewedAt: row.last_reviewed_at,
  };
}
