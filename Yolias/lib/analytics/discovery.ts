// Discovery analytics (D-162, trimmed by the owner on 2026-10-20): totals
// against the previous period, the average ICP match, emails found, decision
// makers and user activity, computed from the workspace's own results. The
// trend, results pipeline, ICP bands, data quality, top markets and
// distribution panels were removed, and with them their data. Pure functions
// (no database) so they can be tested; services/analytics.ts loads the rows.

export interface LeadRow {
  kind: "person" | "company" | "local_business";
  companyId: string | null;
  title: string | null;
  match: number | null;
  emailFound: boolean;
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

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const change = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 100) : null);

export function computeDiscovery(rows: LeadRow[], companiesDiscovered: number, previous: PreviousTotals, activity: ActivityCounts) {
  const people = rows.filter((r) => r.kind === "person");
  const total = rows.length;
  const scored = rows.filter((r) => r.match != null);
  const average = avg(scored.map((r) => r.match as number));

  const roles = new Map<RoleBucket, number>();
  for (const p of people) roles.set(roleOf(p.title), (roles.get(roleOf(p.title)) ?? 0) + 1);
  const companiesWithPeople = new Set(people.map((p) => p.companyId).filter(Boolean)).size;

  return {
    totals: {
      leads: total,
      companies: companiesDiscovered,
      decisionMakers: people.length,
      vsPrevious: { leads: change(total, previous.leads), companies: change(companiesDiscovered, previous.companies), decisionMakers: change(people.length, previous.decisionMakers) },
      previous,
    },
    emailFound: rows.filter((r) => r.emailFound).length,
    icp: { scored: scored.length, avgMatch: average == null ? null : Math.round(average) },
    decisionMakers: {
      total: people.length,
      roles: [...roleBuckets, "other" as const].map((k) => ({ key: k, count: roles.get(k) ?? 0, pct: pct(roles.get(k) ?? 0, people.length) })),
      perCompany: companiesWithPeople ? Math.round((people.length / companiesWithPeople) * 10) / 10 : null,
    },
    activity: { ...activity, qualifications: scored.length },
  };
}

export type DiscoveryReport = ReturnType<typeof computeDiscovery>;
