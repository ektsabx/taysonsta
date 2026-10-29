import "server-only";
import { ydb } from "@/lib/yolias/db";
import { seoBase, seoKinds, type SeoKind } from "@/lib/yolias/seo-pages";

// SEO numbers for Admin → SEO (D-257), from the tables the daily sync fills
// (Search Console, GA4) and from Yolias itself (sign-ups with their first
// page, checkouts, payments). Every figure says where it comes from; a
// source that isn't connected gives null, never zero.
//
// Attribution limits: a sign-up is "organic" when the first public page of
// the visit came from a search engine and the visitor accepted measurement
// cookies (otherwise it is "unknown"). One visit, first touch; a magic link
// opened on another device loses it. Trials and payments follow the account.

/** "/ar/compare/apollo" and "/compare/apollo" are one page in two languages (D-258): numbers add up. */
export const basePath = (p: string) => (p === "/ar" ? "/" : p.startsWith("/ar/") ? p.slice(3) : p);

export interface Period { days: number; from: string; to: string; prevFrom: string; prevTo: string }

export function period(days: number, now = Date.now()): Period {
  const d = [7, 28, 90].includes(days) ? days : 28;
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
  // Search Console lags about two days: periods end the day before yesterday.
  const end = now - 2 * 86_400_000;
  return { days: d, to: iso(end), from: iso(end - (d - 1) * 86_400_000), prevTo: iso(end - d * 86_400_000), prevFrom: iso(end - (2 * d - 1) * 86_400_000) };
}

/** Every row of a query, 1,000 at a time (PostgREST's page size). */
async function all<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, max = 50_000): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < max; i += 1000) {
    const { data, error } = await build(i, i + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}

type PageDay = { day: string; page: string; clicks: number; impressions: number; position: number | null };

async function gscRows(from: string, to: string): Promise<PageDay[]> {
  return all((a, b) => ydb().from("seo_page_daily").select("day, page, clicks, impressions, position").gte("day", from).lte("day", to).order("day").range(a, b));
}

export interface PageStat { page: string; clicks: number; impressions: number; ctr: number | null; position: number | null }

function byPage(rows: PageDay[]): Map<string, PageStat> {
  const m = new Map<string, { clicks: number; impressions: number; pos: number }>();
  for (const r of rows) {
    const page = basePath(r.page);
    const a = m.get(page) ?? { clicks: 0, impressions: 0, pos: 0 };
    a.clicks += r.clicks; a.impressions += r.impressions; a.pos += (r.position ?? 0) * r.impressions;
    m.set(page, a);
  }
  return new Map([...m].map(([page, a]) => [page, { page, clicks: a.clicks, impressions: a.impressions, ctr: a.impressions ? a.clicks / a.impressions : null, position: a.impressions ? a.pos / a.impressions : null }]));
}

function totals(rows: PageDay[]) {
  let clicks = 0, impressions = 0, pos = 0;
  for (const r of rows) { clicks += r.clicks; impressions += r.impressions; pos += (r.position ?? 0) * r.impressions; }
  return { clicks, impressions, ctr: impressions ? clicks / impressions : null, position: impressions ? pos / impressions : null };
}

type Signup = { user_id: string; landing_path: string | null; channel: string; created_at: string };

async function signups(from: string, to: string): Promise<Signup[]> {
  const rows = await all<Signup>((a, b) => ydb().from("signup_attribution").select("user_id, landing_path, channel, created_at").gte("created_at", `${from}T00:00:00Z`).lte("created_at", `${to}T23:59:59Z`).range(a, b));
  return rows.map((r) => ({ ...r, landing_path: r.landing_path ? basePath(r.landing_path) : null }));
}

/** Trials, paid accounts and revenue (live USD payments) of the given users. */
async function outcomes(userIds: string[]) {
  const trial = new Set<string>();
  const paid = new Set<string>();
  const revenueByUser = new Map<string, number>();
  for (let i = 0; i < userIds.length; i += 200) {
    const ids = userIds.slice(i, i + 200);
    const [{ data: cs }, { data: profiles }] = await Promise.all([
      ydb().from("checkout_sessions").select("user_id, outcome").in("user_id", ids).not("outcome", "is", null),
      ydb().from("profiles").select("id, workspace_id").in("id", ids),
    ]);
    for (const c of cs ?? []) if (c.user_id) (c.outcome === "trial" ? trial : paid).add(c.user_id);
    const wsUser = new Map((profiles ?? []).filter((p) => p.workspace_id).map((p) => [p.workspace_id as string, p.id]));
    if (wsUser.size) {
      const { data: pays } = await ydb().from("payments").select("workspace_id, amount, currency, mode").in("workspace_id", [...wsUser.keys()]).eq("status", "succeeded").eq("mode", "live");
      for (const p of pays ?? []) {
        const u = wsUser.get(p.workspace_id);
        if (!u) continue;
        paid.add(u);
        if (p.currency === "USD") revenueByUser.set(u, (revenueByUser.get(u) ?? 0) + Number(p.amount));
      }
    }
  }
  return { trial, paid, revenueByUser };
}

async function gaRows(from: string, to: string) {
  return all((a, b) => ydb().from("seo_ga_daily").select("day, landing_page, sessions, engaged_sessions, key_events").gte("day", from).lte("day", to).range(a, b));
}

export async function sourcesState() {
  const [{ count: gsc }, { count: ga }, { count: attr }] = await Promise.all([
    ydb().from("seo_page_daily").select("day", { count: "exact", head: true }),
    ydb().from("seo_ga_daily").select("day", { count: "exact", head: true }),
    ydb().from("signup_attribution").select("user_id", { count: "exact", head: true }),
  ]);
  return { gsc: (gsc ?? 0) > 0, ga4: (ga ?? 0) > 0, attribution: (attr ?? 0) > 0 };
}

/** SEO pages made in Admin, by path (to label rows and join keywords). */
export async function seoPageIndex() {
  const { data } = await ydb().from("content_entries").select("id, kind, slug, status, primary_keyword, doc, created_at, published_at").in("kind", [...seoKinds]);
  return new Map((data ?? []).map((p) => [`${seoBase[p.kind as SeoKind]}/${p.slug}`, { id: p.id, kind: p.kind as SeoKind, status: p.status, keyword: p.primary_keyword, title: ((p.doc as { ar?: { title?: string } })?.ar?.title) ?? p.slug, createdAt: p.created_at, publishedAt: p.published_at }]));
}

export async function overview(days: number) {
  const p = period(days);
  const [src, cur, prev, sNow, sPrev, gaNow, gaPrev] = await Promise.all([
    sourcesState(), gscRows(p.from, p.to), gscRows(p.prevFrom, p.prevTo), signups(p.from, p.to), signups(p.prevFrom, p.prevTo), gaRows(p.from, p.to), gaRows(p.prevFrom, p.prevTo),
  ]);
  const organic = sNow.filter((s) => s.channel === "organic_search");
  const organicPrev = sPrev.filter((s) => s.channel === "organic_search");
  const out = await outcomes(organic.map((s) => s.user_id));
  const outPrev = await outcomes(organicPrev.map((s) => s.user_id));
  const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
  const sessions = gaNow.reduce((a, r) => a + r.sessions, 0);
  const sessionsPrev = gaPrev.reduce((a, r) => a + r.sessions, 0);
  const t = totals(cur);
  const tp = totals(prev);

  // Daily trend (clicks, impressions) over the period.
  const labels: string[] = [];
  for (let i = 0; i < p.days; i++) labels.push(new Date(Date.parse(p.from) + i * 86_400_000).toISOString().slice(0, 10));
  const dayAgg = new Map<string, { c: number; i: number }>();
  for (const r of cur) { const a = dayAgg.get(r.day) ?? { c: 0, i: 0 }; a.c += r.clicks; a.i += r.impressions; dayAgg.set(r.day, a); }
  const signupsByDay = new Map<string, number>();
  for (const s of organic) signupsByDay.set(s.created_at.slice(0, 10), (signupsByDay.get(s.created_at.slice(0, 10)) ?? 0) + 1);

  // Pages: movers, impressions without clicks, clicks without sign-ups.
  const now = byPage(cur);
  const before = byPage(prev);
  const signupsByPage = new Map<string, number>();
  for (const s of organic) if (s.landing_path) signupsByPage.set(s.landing_path, (signupsByPage.get(s.landing_path) ?? 0) + 1);
  const movers = [...new Set([...now.keys(), ...before.keys()])].map((page) => ({ page, clicks: now.get(page)?.clicks ?? 0, prev: before.get(page)?.clicks ?? 0 })).map((m) => ({ ...m, delta: m.clicks - m.prev }));
  const lowCtr = [...now.values()].filter((s) => s.impressions >= 100 && (s.ctr ?? 0) < 0.01).sort((a, b) => b.impressions - a.impressions).slice(0, 10);
  const noConversions = [...now.values()].filter((s) => s.clicks >= 20 && !signupsByPage.get(s.page)).sort((a, b) => b.clicks - a.clicks).slice(0, 10);

  return {
    period: p,
    sources: src,
    gsc: src.gsc ? { ...t, prev: tp } : null,
    ga4: src.ga4 ? { sessions, prev: sessionsPrev, landingPages: new Set(gaNow.map((r) => basePath(r.landing_page))).size } : null,
    signups: { organic: organic.length, organicPrev: organicPrev.length, all: sNow.length, unknown: sNow.filter((s) => s.channel === "unknown").length },
    trials: out.trial.size, trialsPrev: outPrev.trial.size,
    paid: out.paid.size, paidPrev: outPrev.paid.size,
    revenue: sum(out.revenueByUser), revenuePrev: sum(outPrev.revenueByUser),
    // Sign-ups per organic session (GA4) when available, else per Search Console click.
    conversion: sessions ? { rate: organic.length / sessions, base: "ga4" as const } : t.clicks ? { rate: organic.length / t.clicks, base: "gsc" as const } : null,
    trend: { labels, clicks: labels.map((d) => dayAgg.get(d)?.c ?? 0), impressions: labels.map((d) => dayAgg.get(d)?.i ?? 0), signups: labels.map((d) => signupsByDay.get(d) ?? 0) },
    up: movers.filter((m) => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 8),
    down: movers.filter((m) => m.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 8),
    lowCtr, noConversions,
  };
}

/** Per page: search numbers, sign-ups and what they became (Pages table, reports). */
export async function pageStats(days: number) {
  const p = period(days);
  const [rows, ss] = await Promise.all([gscRows(p.from, p.to), signups(p.from, p.to)]);
  const organic = ss.filter((s) => s.channel === "organic_search");
  const out = await outcomes(organic.map((s) => s.user_id));
  const stats = byPage(rows);
  const per = new Map<string, { signups: number; trials: number; paid: number; revenue: number }>();
  for (const s of organic) {
    if (!s.landing_path) continue;
    const a = per.get(s.landing_path) ?? { signups: 0, trials: 0, paid: 0, revenue: 0 };
    a.signups++;
    if (out.trial.has(s.user_id)) a.trials++;
    if (out.paid.has(s.user_id)) a.paid++;
    a.revenue += out.revenueByUser.get(s.user_id) ?? 0;
    per.set(s.landing_path, a);
  }
  return { period: p, stats, conversions: per };
}

/** A search for the brand: Yolias / يولياس and the common misspellings. */
export const BRAND_QUERY = /yol+i+a+s|yolyas|youlias|يول[ـ]?ي?اس|يوليا س/i;

export async function reports(days: number) {
  const p = period(days);
  const [{ stats, conversions }, pages, kw, queries, comps, revs] = await Promise.all([
    pageStats(days),
    seoPageIndex(),
    ydb().from("seo_keywords").select("keyword, cluster, target_path, stage"),
    all((a, b) => ydb().from("seo_query_daily").select("page, query, clicks, impressions, position").gte("day", p.from).lte("day", p.to).range(a, b)),
    ydb().from("seo_competitors").select("slug, name, last_reviewed_at"),
    ydb().from("content_revisions").select("entry_id"),
  ]);
  const keywords = kw.data ?? [];
  const clusterOf = new Map<string, string>();
  for (const k of keywords) if (k.target_path && k.cluster) clusterOf.set(k.target_path, k.cluster);
  for (const [path, pg] of pages) if (!clusterOf.has(path) && pg.keyword) { const k = keywords.find((x) => x.keyword.toLowerCase() === pg.keyword!.toLowerCase()); if (k?.cluster) clusterOf.set(path, k.cluster); }

  const rows = [...new Set([...stats.keys(), ...conversions.keys()])].map((page) => {
    const s = stats.get(page);
    const c = conversions.get(page) ?? { signups: 0, trials: 0, paid: 0, revenue: 0 };
    return { page, title: pages.get(page)?.title ?? null, clicks: s?.clicks ?? 0, impressions: s?.impressions ?? 0, ctr: s?.ctr ?? null, position: s?.position ?? null, ...c, rate: s?.clicks ? c.signups / s.clicks : null };
  });

  // 3. Keyword clusters that brought paying customers.
  const clusters = new Map<string, { cluster: string; clicks: number; signups: number; paid: number; revenue: number }>();
  for (const r of rows) {
    const cl = clusterOf.get(r.page);
    if (!cl) continue;
    const a = clusters.get(cl) ?? { cluster: cl, clicks: 0, signups: 0, paid: 0, revenue: 0 };
    a.clicks += r.clicks; a.signups += r.signups; a.paid += r.paid; a.revenue += r.revenue;
    clusters.set(cl, a);
  }

  // 4. Effort against result: saves (revisions) and days since the page was made.
  const saves = new Map<string, number>();
  for (const r of revs.data ?? []) saves.set(r.entry_id, (saves.get(r.entry_id) ?? 0) + 1);
  const effort = [...pages].map(([path, pg]) => {
    const r = rows.find((x) => x.page === path);
    return { page: path, title: pg.title, status: pg.status, saves: saves.get(pg.id) ?? 0, ageDays: Math.floor((Date.now() - Date.parse(pg.createdAt)) / 86_400_000), clicks: r?.clicks ?? 0, signups: r?.signups ?? 0, paid: r?.paid ?? 0 };
  }).sort((a, b) => b.signups - a.signups || b.clicks - a.clicks);

  // 7. Topics worth a page: queries seen in search that no keyword in the plan covers yet.
  const planned = new Set(keywords.map((k) => k.keyword.toLowerCase()));
  const q = new Map<string, { query: string; impressions: number; clicks: number; pos: number; pages: Set<string> }>();
  for (const r of queries) {
    const a = q.get(r.query) ?? { query: r.query, impressions: 0, clicks: 0, pos: 0, pages: new Set<string>() };
    a.impressions += r.impressions; a.clicks += r.clicks; a.pos += (r.position ?? 0) * r.impressions;
    if (r.impressions > 0) a.pages.add(basePath(r.page));
    q.set(r.query, a);
  }
  const qs = [...q.values()].map((a) => ({ query: a.query, impressions: a.impressions, clicks: a.clicks, position: a.impressions ? a.pos / a.impressions : null, pages: [...a.pages] }));
  const opportunities = qs.filter((x) => !planned.has(x.query.toLowerCase()) && x.impressions >= 30).sort((a, b) => b.impressions - a.impressions).slice(0, 25);
  // 8. Pages to update, merge or redirect.
  const cannibal = qs.filter((x) => x.pages.length > 1 && x.impressions >= 20).sort((a, b) => b.impressions - a.impressions).slice(0, 15);
  const stale = (comps.data ?? []).filter((c) => !c.last_reviewed_at || Date.now() - Date.parse(c.last_reviewed_at) > 90 * 86_400_000);
  const invisible = [...pages].filter(([path, pg]) => pg.status === "published" && pg.publishedAt && Date.now() - Date.parse(pg.publishedAt) > 30 * 86_400_000 && !(stats.get(path)?.impressions)).map(([path, pg]) => ({ page: path, title: pg.title }));

  // 9. Brand searches (D-266): every query naming Yolias, in Latin or Arabic letters
  // (with or without the old tatweel), and where Yolias ranks for it.
  const brand = qs.filter((x) => BRAND_QUERY.test(x.query)).sort((a, b) => b.impressions - a.impressions);
  const brandTotals = (arabic: boolean) => {
    const xs = brand.filter((x) => /[\u0600-\u06FF]/.test(x.query) === arabic);
    const imp = xs.reduce((s, x) => s + x.impressions, 0);
    return { queries: xs.length, impressions: imp, clicks: xs.reduce((s, x) => s + x.clicks, 0), position: imp ? xs.reduce((s, x) => s + (x.position ?? 0) * x.impressions, 0) / imp : null };
  };

  return {
    period: p,
    brand: { queries: brand.slice(0, 30), en: brandTotals(false), ar: brandTotals(true) },
    topSignups: [...rows].filter((r) => r.signups > 0).sort((a, b) => b.signups - a.signups).slice(0, 15),
    topRate: [...rows].filter((r) => r.clicks >= 10 && r.rate !== null).sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0)).slice(0, 15),
    clusters: [...clusters.values()].sort((a, b) => b.paid - a.paid || b.signups - a.signups),
    effort,
    lowCtr: [...rows].filter((r) => r.impressions >= 100 && (r.ctr ?? 0) < 0.01).sort((a, b) => b.impressions - a.impressions).slice(0, 15),
    noConversions: [...rows].filter((r) => r.clicks >= 20 && r.signups === 0).sort((a, b) => b.clicks - a.clicks).slice(0, 15),
    opportunities, cannibal, stale, invisible,
  };
}
