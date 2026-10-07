// Discovery analytics (owner request 2026-10-07, D-162): data quality, ICP
// performance, distribution, decision makers, sources, trend, funnel, top
// markets and user activity, computed from the workspace's own results. Pure
// functions (no database) so they can be tested; services/analytics.ts loads
// the rows.

export interface LeadRow {
  kind: "person" | "company" | "local_business";
  companyId: string | null;
  country: string | null;
  city: string | null;
  industry: string | null;
  employees: number | null;
  title: string | null;
  seniority: string | null;
  match: number | null;
  confidence: number | null;
  emailFound: boolean;
  emailVerified: boolean;
  phoneFound: boolean;
  missing: string[];
  source: string;
  createdAt: string;
  selected: boolean;
  contacted: boolean;
}

export interface ActivityCounts {
  searches: number;
  enrichments: number;
  exports: number;
  csvExports: number;
  emailsPrepared: number;
  messagesPrepared: number;
}

export interface PreviousTotals {
  leads: number;
  companies: number;
  decisionMakers: number;
}

export const roleBuckets = ["ceo", "founder", "cLevel", "vp", "director", "manager"] as const;
export type RoleBucket = (typeof roleBuckets)[number] | "other";

/** Which decision-maker group a job title belongs to (first match wins). */
export function roleOf(title: string | null): RoleBucket {
  const t = (title ?? "").toLowerCase();
  if (!t) return "other";
  if (/\bceo\b|chief executive|الرئيس التنفيذي|المدير التنفيذي/.test(t)) return "ceo";
  if (/founder|مؤسس/.test(t)) return "founder";
  if (/\bc[a-z]{1,2}o\b|chief\b|رئيس .*(المالي|التقني|التشغيل|التسويق)/.test(t)) return "cLevel";
  if (/\bvp\b|\bsvp\b|\bevp\b|vice president|نائب (الرئيس|رئيس)/.test(t)) return "vp";
  if (/director|head of|\bhead\b|مدير إدارة|رئيس قسم|مدير عام/.test(t)) return "director";
  if (/manager|\blead\b|مدير/.test(t)) return "manager";
  return "other";
}

export function sizeBucket(n: number | null): string | null {
  if (n == null) return null;
  const bands: [number, string][] = [[10, "1–10"], [50, "11–50"], [200, "51–200"], [500, "201–500"], [1000, "501–1,000"], [5000, "1,001–5,000"]];
  for (const [max, label] of bands) if (n <= max) return label;
  return "5,000+";
}
const sizeOrder = ["1–10", "11–50", "51–200", "201–500", "501–1,000", "1,001–5,000", "5,000+"];

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round = (v: number | null) => (v == null ? null : Math.round(v));

export interface Bar { key: string; count: number; pct: number }
export interface MatchGroup { key: string; count: number; avgMatch: number | null; strongPct: number }

function bars(rows: LeadRow[], keyOf: (r: LeadRow) => string | null, limit = 8, order?: string[]): Bar[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = keyOf(r);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  const total = [...m.values()].reduce((a, b) => a + b, 0);
  const list = [...m.entries()].map(([key, count]) => ({ key, count, pct: pct(count, total) }));
  if (order) return list.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  return list.sort((a, b) => b.count - a.count).slice(0, limit);
}

function matchGroups(rows: LeadRow[], keyOf: (r: LeadRow) => string | null, limit = 6, order?: string[]): MatchGroup[] {
  const m = new Map<string, number[]>();
  for (const r of rows) {
    const k = keyOf(r);
    if (!k || r.match == null) continue;
    m.set(k, [...(m.get(k) ?? []), r.match]);
  }
  const list = [...m.entries()].map(([key, xs]) => ({ key, count: xs.length, avgMatch: round(avg(xs)), strongPct: pct(xs.filter((x) => x >= 80).length, xs.length) }));
  if (order) return list.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  return list.sort((a, b) => b.count - a.count).slice(0, limit);
}

/** Days for ranges up to a month, weeks beyond. */
function trend(rows: LeadRow[], since: Date, days: number) {
  const step = days > 31 ? 7 : 1;
  const buckets: { start: string; leads: number; companies: number; decisionMakers: number }[] = [];
  for (let d = 0; d < days; d += step) {
    buckets.push({ start: new Date(since.getTime() + d * 86_400_000).toISOString().slice(0, 10), leads: 0, companies: 0, decisionMakers: 0 });
  }
  for (const r of rows) {
    const i = Math.floor((new Date(r.createdAt).getTime() - since.getTime()) / (step * 86_400_000));
    const b = buckets[Math.min(Math.max(i, 0), buckets.length - 1)];
    if (!b) continue;
    b.leads++;
    if (r.kind === "person") b.decisionMakers++;
    else b.companies++;
  }
  return { step: step === 7 ? "week" as const : "day" as const, buckets };
}

function confidencePct(list: LeadRow[]) {
  const a = avg(list.map((r) => r.confidence).filter((x): x is number => x != null));
  return a == null ? null : Math.round(a * 100);
}

const change = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 100) : null);

export function computeDiscovery(rows: LeadRow[], companiesDiscovered: number, previous: PreviousTotals, activity: ActivityCounts, since: Date, days: number) {
  const people = rows.filter((r) => r.kind === "person");
  const total = rows.length;
  const scored = rows.filter((r) => r.match != null);
  const strong = scored.filter((r) => (r.match ?? 0) >= 80).length;
  const good = scored.filter((r) => (r.match ?? 0) >= 60 && (r.match ?? 0) < 80).length;
  const weak = scored.length - strong - good;
  const confidences = rows.map((r) => r.confidence).filter((c): c is number => c != null);
  const verifiedContacts = rows.filter((r) => r.emailVerified).length;

  // Missing data: which expected fields Yolias couldn't find, most common first.
  const missing = new Map<string, number>();
  for (const r of rows) for (const f of r.missing) missing.set(f, (missing.get(f) ?? 0) + 1);

  // Decision makers per group and per company.
  const roles = new Map<RoleBucket, number>();
  for (const p of people) roles.set(roleOf(p.title), (roles.get(roleOf(p.title)) ?? 0) + 1);
  const companiesWithPeople = new Set(people.map((p) => p.companyId).filter(Boolean)).size;

  // Sources and their quality.
  const sources = new Map<string, LeadRow[]>();
  for (const r of rows) sources.set(r.source, [...(sources.get(r.source) ?? []), r]);

  // Top markets: volume, fit, verified contacts and one quality score.
  const markets = new Map<string, LeadRow[]>();
  for (const r of rows) if (r.country) markets.set(r.country, [...(markets.get(r.country) ?? []), r]);

  const quality = (list: LeadRow[]) => {
    const m = avg(list.map((r) => r.match).filter((x): x is number => x != null)) ?? 0;
    const v = pct(list.filter((r) => r.emailVerified).length, list.length);
    const c = (avg(list.map((r) => r.confidence).filter((x): x is number => x != null)) ?? 0) * 100;
    return Math.round(0.5 * m + 0.3 * v + 0.2 * c);
  };

  return {
    totals: {
      leads: total,
      companies: companiesDiscovered,
      decisionMakers: people.length,
      vsPrevious: { leads: change(total, previous.leads), companies: change(companiesDiscovered, previous.companies), decisionMakers: change(people.length, previous.decisionMakers) },
      previous,
    },
    dataQuality: {
      verifiedContacts, verifiedContactsPct: pct(verifiedContacts, total),
      emailVerified: rows.filter((r) => r.emailVerified).length, emailFound: rows.filter((r) => r.emailFound).length,
      phoneFound: rows.filter((r) => r.phoneFound).length,
      confidence: confidences.length ? Math.round((avg(confidences) ?? 0) * 100) : null,
      missing: [...missing.entries()].map(([field, count]) => ({ field, count, pct: pct(count, total) })).sort((a, b) => b.count - a.count).slice(0, 8),
    },
    icp: {
      scored: scored.length,
      avgMatch: round(avg(scored.map((r) => r.match as number))),
      strong, good, weak,
      byMarket: matchGroups(rows, (r) => r.country),
      byIndustry: matchGroups(rows, (r) => r.industry),
      bySize: matchGroups(rows, (r) => sizeBucket(r.employees), 10, sizeOrder),
    },
    distribution: {
      country: bars(rows, (r) => r.country),
      industry: bars(rows, (r) => r.industry),
      size: bars(rows, (r) => sizeBucket(r.employees), 10, sizeOrder),
      city: bars(rows, (r) => r.city),
      title: bars(people, (r) => r.title),
      seniority: bars(people, (r) => r.seniority),
    },
    decisionMakers: {
      total: people.length,
      roles: [...roleBuckets, "other" as const].map((k) => ({ key: k, count: roles.get(k) ?? 0, pct: pct(roles.get(k) ?? 0, people.length) })),
      perCompany: companiesWithPeople ? Math.round((people.length / companiesWithPeople) * 10) / 10 : null,
    },
    sources: [...sources.entries()].map(([source, list]) => ({
      source, count: list.length, pct: pct(list.length, total),
      avgMatch: round(avg(list.map((r) => r.match).filter((x): x is number => x != null))),
      verifiedPct: pct(list.filter((r) => r.emailVerified).length, list.length),
      confidence: confidencePct(list),
    })).sort((a, b) => b.count - a.count),
    trend: trend(rows, since, days),
    // Engaged and converted need reply / deal tracking (a later Outreach module or a CRM): not counted yet.
    funnel: {
      discovered: total,
      qualified: scored.filter((r) => (r.match ?? 0) >= 70).length,
      selected: rows.filter((r) => r.selected).length,
      contacted: rows.filter((r) => r.contacted).length,
      engaged: null as number | null,
      converted: null as number | null,
    },
    markets: [...markets.entries()].map(([country, list]) => ({
      country, leads: list.length,
      avgMatch: round(avg(list.map((r) => r.match).filter((x): x is number => x != null))),
      verified: list.filter((r) => r.emailVerified).length,
      quality: quality(list),
    })).sort((a, b) => b.leads - a.leads).slice(0, 8),
    activity: { ...activity, qualifications: scored.length },
  };
}

export type DiscoveryReport = ReturnType<typeof computeDiscovery>;
