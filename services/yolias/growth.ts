import "server-only";
import { ydb } from "@/lib/yolias/db";
import {
  DAY, bucketOf, buckets, change, channelGroup, concentration, ltv, monthlyChurn, monthlyPrice, nrr, paybackMonths, ratio,
} from "@/lib/yolias/growth-math";

// Yolias Admin's dashboard numbers (owner, 2026-11-03, D-276): growth,
// churn, subscribers, revenue, profit, unit economics, channels, countries
// and devices, for a period with filters, against the period before. Only
// real rows: page views (site_visits), accounts (profiles, workspaces),
// invoices, subscription events, platform costs (intel calls) and the
// costs the owner enters each month (yolias_finance_entries). Test-mode
// money is never mixed with real money: the mode filter picks one.

export type Mode = "live" | "test";
export interface GrowthFilters {
  since: string; until: string;
  mode: Mode;
  country?: string | null; channel?: string | null; device?: string | null; plan?: string | null;
}

type Invoice = { workspace_id: string; plan: string | null; billing_period: string | null; amount: number; currency: string | null; mode: string; kind: string | null; created_at: string; status: string };
type SubEvent = { workspace_id: string; plan: string | null; status: string; mode: string; billing_period: string | null; created_at: string };

async function all<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, cap = 50_000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < cap; from += 1000) {
    const { data, error } = await q(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export interface Metric { value: number | null; prev: number | null; change: number | null }
const metric = (value: number | null, prev: number | null): Metric => ({ value, prev, change: value == null || prev == null ? null : change(value, prev) });

export interface GrowthData {
  filters: GrowthFilters;
  unit: "day" | "week" | "month";
  labels: string[];
  series: { visitors: number[]; visits: number[]; signups: number[]; newPaying: number[]; revenue: number[]; cost: number[]; churned: number[] };
  kpis: Record<
    | "views" | "visits" | "visitors" | "signups" | "signupRate" | "activationRate" | "paidConversion" | "newPaying" | "activePaying" | "churnRate"
    | "revenue" | "arppu" | "mrr" | "arr" | "runRate" | "repeatRate" | "cac" | "ltv" | "ltvCac" | "payback" | "grossMargin" | "profit" | "profitMargin"
    | "avgRecurring" | "activeAdvertisers" | "campaigns" | "appSessions" | "nrr" | "costToServe" | "marketing" | "fixed",
    Metric
  >;
  growth: { signups: { day: Metric; month: Metric; year: Metric }; revenue: { day: Metric; month: Metric; year: Metric }; paying: { day: Metric; month: Metric; year: Metric } };
  churn: { day: number | null; month: number | null; year: number | null };
  subscribers: { monthly: number; annual: number; payg: number };
  funnel: { key: string; n: number }[];
  channels: { key: string; visitors: number; signups: number; paying: number; revenue: number }[];
  countries: { key: string; visitors: number; signups: number; paying: number; revenue: number }[];
  devices: { key: string; visitors: number }[];
  browsers: { key: string; visitors: number }[];
  plans: { plan: string; period: string; subscribers: number; mrr: number }[];
  topCustomers: { workspaceId: string; name: string | null; revenue: number }[];
  concentration: { topShare: number | null; top1: number | null };
  cohorts: { month: string; size: number; retained: (number | null)[] }[];
}

export async function growthDashboard(f: GrowthFilters): Promise<GrowthData> {
  const db = ydb();
  const since = Date.parse(f.since), until = Date.parse(f.until);
  const span = until - since;
  const prevSince = since - span;
  const iso = (t: number) => new Date(t).toISOString();
  const yearAgo = until - 366 * DAY;

  const [profiles, attribution, workspaces, invoices, events, plans, firstVisits, campaigns, sessions, finance, costsNow, costsPrev, trafficNow, trafficPrev] = await Promise.all([
    all<{ id: string; workspace_id: string | null; created_at: string; onboarded_at: string | null }>((a, b) => db.from("profiles").select("id, workspace_id, created_at, onboarded_at").range(a, b)),
    all<{ user_id: string; channel: string | null }>((a, b) => db.from("signup_attribution").select("user_id, channel").range(a, b)),
    all<{ id: string; name: string | null; plan: string; subscription_status: string; billing_period: string | null; created_by: string | null; created_at: string }>((a, b) => db.from("workspaces").select("id, name, plan, subscription_status, billing_period, created_by, created_at").range(a, b)),
    all<Invoice>((a, b) => db.from("invoices").select("workspace_id, plan, billing_period, amount, currency, mode, kind, created_at, status").eq("status", "paid").eq("mode", f.mode).range(a, b)),
    all<SubEvent>((a, b) => db.from("subscription_events").select("workspace_id, plan, status, mode, billing_period, created_at").eq("mode", f.mode).order("created_at").range(a, b)),
    db.from("plan_quotas").select("plan, price_usd"),
    // Where each account came from: the country and device of its first page view.
    all<{ user_id: string; country: string | null; device: string | null; created_at: string }>((a, b) => db.from("site_visits").select("user_id, country, device, created_at").not("user_id", "is", null).eq("landing", true).order("created_at").range(a, b)),
    all<{ workspace_id: string; created_at: string; approved_at: string | null; status: string }>((a, b) => db.from("outreach_campaigns").select("workspace_id, created_at, approved_at, status").range(a, b)),
    all<{ user_id: string; started_at: string }>((a, b) => db.from("app_sessions").select("user_id, started_at").gte("started_at", iso(prevSince)).range(a, b)),
    all<{ month: string; kind: string; category: string; amount_usd: number; cogs: boolean }>((a, b) => db.from("yolias_finance_entries").select("month, kind, category, amount_usd, cogs").range(a, b)),
    db.rpc("admin_costs_daily", { p_since: iso(since), p_until: iso(until) }),
    db.rpc("admin_costs_daily", { p_since: iso(prevSince), p_until: iso(since) }),
    db.rpc("admin_traffic_daily", { p_since: iso(since), p_until: iso(until), p_area: "site" }),
    db.rpc("admin_traffic_daily", { p_since: iso(prevSince), p_until: iso(since), p_area: "site" }),
  ]);
  // Page views are counted from the day tracking started (D-276): rates that
  // compare visitors with sign-ups only use the days both were counted.
  const { data: firstView } = await db.from("site_visits").select("created_at").order("created_at").limit(1).maybeSingle();
  const tracked = firstView ? Date.parse(firstView.created_at) : Infinity;
  const price = new Map<string, number>((plans.data ?? []).map((p) => [p.plan as string, Number(p.price_usd)]));

  // ── who each account is (for the filters) ──
  const channelOf = new Map(attribution.map((a) => [a.user_id, channelGroup(a.channel)]));
  const firstVisit = new Map<string, { country: string | null; device: string | null }>();
  for (const v of firstVisits) if (!firstVisit.has(v.user_id)) firstVisit.set(v.user_id, { country: v.country, device: v.device });
  const ownerOf = new Map(workspaces.map((w) => [w.id, w.created_by]));
  const wsById = new Map(workspaces.map((w) => [w.id, w]));
  const userPasses = (userId: string | null | undefined) => {
    if (!userId) return !f.country && !f.channel && !f.device;
    if (f.channel && (channelOf.get(userId) ?? "unknown") !== f.channel) return false;
    const fv = firstVisit.get(userId);
    if (f.country && (fv?.country ?? "unknown") !== f.country) return false;
    if (f.device && (fv?.device ?? "unknown") !== f.device) return false;
    return true;
  };
  const wsPasses = (wsId: string) => userPasses(ownerOf.get(wsId)) && (!f.plan || wsById.get(wsId)?.plan === f.plan);
  const inRange = (t: string, a: number, b: number) => { const x = Date.parse(t); return x >= a && x < b; };

  // ── sign-ups and activation ──
  const signups = (a: number, b: number) => profiles.filter((p) => inRange(p.created_at, a, b) && userPasses(p.id));
  const sNow = signups(since, until), sPrev = signups(prevSince, since);
  const launched = new Map<string, number>();
  for (const c of campaigns) if (c.approved_at) { const t = Date.parse(c.approved_at); const was = launched.get(c.workspace_id); if (was == null || t < was) launched.set(c.workspace_id, t); }
  const activated = (ps: typeof sNow) => ps.filter((p) => p.workspace_id && launched.has(p.workspace_id)).length;

  // ── money ──
  const usdInvoices = invoices.filter((i) => (i.currency ?? "USD") === "USD" && wsPasses(i.workspace_id));
  const firstPaid = new Map<string, number>();
  for (const i of invoices) { const t = Date.parse(i.created_at); const was = firstPaid.get(i.workspace_id); if (was == null || t < was) firstPaid.set(i.workspace_id, t); }
  const revenueIn = (a: number, b: number) => usdInvoices.filter((i) => inRange(i.created_at, a, b)).reduce((s, i) => s + Number(i.amount), 0);
  const byCustomer = (a: number, b: number) => {
    const m = new Map<string, number>();
    for (const i of usdInvoices) if (inRange(i.created_at, a, b)) m.set(i.workspace_id, (m.get(i.workspace_id) ?? 0) + Number(i.amount));
    return m;
  };
  const newPayingIn = (a: number, b: number) => [...firstPaid.entries()].filter(([ws, t]) => t >= a && t < b && wsPasses(ws)).length;

  // Subscription timeline from events: active from "activated"/"resumed"/"renewed" until "ended".
  const subState = new Map<string, { active: boolean; period: string | null; plan: string | null; since: number }>();
  const endedAt: { ws: string; t: number }[] = [];
  const startedAt: { ws: string; t: number }[] = [];
  const activeAt = (t: number) => {
    const state = new Map<string, boolean>();
    for (const e of events) {
      if (Date.parse(e.created_at) >= t) break;
      if (e.status === "ended") state.set(e.workspace_id, false);
      else if (e.status === "activated" || e.status === "resumed" || e.status === "renewed" || e.status === "changed") state.set(e.workspace_id, true);
    }
    return [...state.entries()].filter(([ws, on]) => on && wsPasses(ws)).map(([ws]) => ws);
  };
  for (const e of events) {
    const t = Date.parse(e.created_at);
    if (e.status === "ended") { subState.set(e.workspace_id, { active: false, period: e.billing_period, plan: e.plan, since: t }); endedAt.push({ ws: e.workspace_id, t }); }
    else if (["activated", "resumed", "renewed", "changed"].includes(e.status)) {
      if (!subState.get(e.workspace_id)?.active) startedAt.push({ ws: e.workspace_id, t });
      subState.set(e.workspace_id, { active: true, period: e.billing_period, plan: e.plan, since: t });
    }
  }
  const activeNow = [...subState.entries()].filter(([ws, s]) => s.active && wsPasses(ws));
  const churnedIn = (a: number, b: number) => endedAt.filter((e) => e.t >= a && e.t < b && wsPasses(e.ws)).length;
  const churnRateFor = (a: number, b: number) => ratio(churnedIn(a, b), activeAt(a).length);

  // Pay As You Go customers: a pack bought in the last 30 days.
  const paygRecent = new Set(usdInvoices.filter((i) => i.kind === "pack" && Date.parse(i.created_at) >= until - 30 * DAY && Date.parse(i.created_at) < until).map((i) => i.workspace_id));
  const subscribers = { monthly: activeNow.filter(([, s]) => s.period !== "annual").length, annual: activeNow.filter(([, s]) => s.period === "annual").length, payg: [...paygRecent].filter((ws) => !subState.get(ws)?.active).length };
  const mrrOf = (subs: [string, { plan: string | null; period: string | null }][]) => subs.reduce((s, [, x]) => s + monthlyPrice(price.get(x.plan ?? "") ?? 0, x.period), 0);
  const mrr = mrrOf(activeNow);
  const activePrevList = activeAt(since).map((ws) => [ws, subState.get(ws) ?? { plan: wsById.get(ws)?.plan ?? null, period: wsById.get(ws)?.billing_period ?? null }] as [string, { plan: string | null; period: string | null }]);
  const mrrPrev = mrrOf(activePrevList);

  // Repeat purchases: Pay As You Go customers who bought more than once.
  const packs = new Map<string, number>();
  for (const i of usdInvoices) if (i.kind === "pack" && Date.parse(i.created_at) < until) packs.set(i.workspace_id, (packs.get(i.workspace_id) ?? 0) + 1);
  const repeatRate = ratio([...packs.values()].filter((n) => n > 1).length, packs.size);

  // ── costs ──
  const monthKey = (t: number) => new Date(t).toISOString().slice(0, 7);
  const monthsIn = (a: number, b: number) => { const s = new Set<string>(); for (let t = a; t < b; t += DAY) s.add(monthKey(t)); return s; };
  // A month's entered cost counts in proportion to the days of that month inside the period.
  const entered = (a: number, b: number, kind: "fixed" | "marketing", cogs?: boolean, category?: string | null) => {
    let sum = 0;
    for (const m of monthsIn(a, b)) {
      const start = Date.parse(`${m}-01T00:00:00Z`);
      const next = new Date(start); next.setUTCMonth(next.getUTCMonth() + 1);
      const overlap = Math.max(0, Math.min(b, next.getTime()) - Math.max(a, start)) / (next.getTime() - start);
      for (const e of finance) if (e.month.slice(0, 7) === m && e.kind === kind && (cogs == null || e.cogs === cogs) && (!category || e.category === category)) sum += Number(e.amount_usd) * overlap;
    }
    return sum;
  };
  const platform = (rows: { llm: number; provider: number }[] | null) => (rows ?? []).reduce((s, r) => s + Number(r.llm) + Number(r.provider), 0);
  const cogsNow = platform(costsNow.data) + entered(since, until, "fixed", true);
  const cogsPrev = platform(costsPrev.data) + entered(prevSince, since, "fixed", true);
  const fixedNow = entered(since, until, "fixed"), fixedPrev = entered(prevSince, since, "fixed");
  const mktNow = entered(since, until, "marketing", undefined, f.channel), mktPrev = entered(prevSince, since, "marketing", undefined, f.channel);

  // ── unit economics ──
  const revNow = revenueIn(since, until), revPrev = revenueIn(prevSince, since);
  const custNow = byCustomer(since, until), custPrev = byCustomer(prevSince, since);
  const months = Math.max(span / (30 * DAY), 1 / 30);
  const arppu = ratio(revNow, custNow.size), arppuPrev = ratio(revPrev, custPrev.size);
  const arppuMonthly = arppu == null ? null : arppu / Math.max(months, 1);
  const gm = ratio(revNow - cogsNow, revNow), gmPrev = ratio(revPrev - cogsPrev, revPrev);
  const newPay = newPayingIn(since, until), newPayPrev = newPayingIn(prevSince, since);
  const cac = ratio(mktNow, newPay), cacPrev = ratio(mktPrev, newPayPrev);
  const churnM = monthlyChurn(churnedIn(since, until), activeAt(since).length, span / DAY);
  const churnMPrev = monthlyChurn(churnedIn(prevSince, since), activeAt(prevSince).length, span / DAY);
  const ltvNow = ltv(arppuMonthly, gm, churnM), ltvPrev = ltv(arppuPrev == null ? null : arppuPrev / Math.max(months, 1), gmPrev, churnMPrev);
  const profitNow = revNow - cogsNow - (fixedNow - entered(since, until, "fixed", true)) - mktNow;
  const profitPrev = revPrev - cogsPrev - (fixedPrev - entered(prevSince, since, "fixed", true)) - mktPrev;
  const advertisersIn = (a: number, b: number) => new Set(campaigns.filter((c) => c.approved_at && Date.parse(c.approved_at) < b && (c.status === "active" || c.status === "completed" || c.status === "paused") && wsPasses(c.workspace_id) && Date.parse(c.created_at) < b && Date.parse(c.created_at) >= a - 90 * DAY).map((c) => c.workspace_id)).size;
  const campaignsIn = (a: number, b: number) => campaigns.filter((c) => inRange(c.created_at, a, b) && wsPasses(c.workspace_id)).length;
  const sessionsIn = (a: number, b: number) => sessions.filter((s) => inRange(s.started_at, a, b) && userPasses(s.user_id)).length;
  const sum = (rows: { views: number; visits: number; visitors: number }[] | null, k: "views" | "visits" | "visitors") => (rows ?? []).reduce((s, r) => s + Number(r[k]), 0);
  const filteredTraffic = Boolean(f.country || f.channel || f.device);

  // ── series ──
  const { unit, starts } = buckets(since, until);
  const z = () => starts.map(() => 0);
  const series = { visitors: z(), visits: z(), signups: z(), newPaying: z(), revenue: z(), cost: z(), churned: z() };
  for (const r of trafficNow.data ?? []) { const i = bucketOf(starts, Date.parse(`${r.day}T00:00:00Z`), until); if (i >= 0) { series.visitors[i] += Number(r.visitors); series.visits[i] += Number(r.visits); } }
  for (const p of sNow) { const i = bucketOf(starts, Date.parse(p.created_at), until); if (i >= 0) series.signups[i]++; }
  for (const [ws, t] of firstPaid) { const i = bucketOf(starts, t, until); if (i >= 0 && wsPasses(ws)) series.newPaying[i]++; }
  for (const inv of usdInvoices) { const i = bucketOf(starts, Date.parse(inv.created_at), until); if (i >= 0) series.revenue[i] += Number(inv.amount); }
  for (const r of costsNow.data ?? []) { const i = bucketOf(starts, Date.parse(`${r.day}T00:00:00Z`), until); if (i >= 0) series.cost[i] += Number(r.llm) + Number(r.provider); }
  for (const e of endedAt) { const i = bucketOf(starts, e.t, until); if (i >= 0 && wsPasses(e.ws)) series.churned[i]++; }
  const labels = starts.map((t) => new Date(t).toISOString().slice(0, unit === "month" ? 7 : 10));

  // ── growth (day, month, year), against the same length before ──
  const g = (fn: (a: number, b: number) => number) => {
    const end = until;
    const d = (n: number) => metric(fn(end - n * DAY, end), fn(end - 2 * n * DAY, end - n * DAY));
    return { day: d(1), month: d(30), year: d(365) };
  };
  const churnWindow = (n: number) => ratio(churnedIn(until - n * DAY, until), activeAt(until - n * DAY).length);

  // ── breakdowns ──
  const accountsBy = (key: (userId: string) => string) => {
    const m = new Map<string, { signups: number; paying: number; revenue: number }>();
    for (const p of sNow) { const k = key(p.id); const r = m.get(k) ?? { signups: 0, paying: 0, revenue: 0 }; r.signups++; m.set(k, r); }
    for (const [ws, rev] of custNow) {
      const owner = ownerOf.get(ws); if (!owner) continue;
      const k = key(owner); const r = m.get(k) ?? { signups: 0, paying: 0, revenue: 0 };
      if ((firstPaid.get(ws) ?? Infinity) >= since && (firstPaid.get(ws) ?? Infinity) < until) r.paying++;
      r.revenue += rev; m.set(k, r);
    }
    return m;
  };
  const [byChannelVisits, byCountryVisits, byDevice, byBrowser] = await Promise.all([
    db.rpc("admin_traffic_by", { p_since: iso(since), p_until: iso(until), p_dim: "channel", p_area: "site" }),
    db.rpc("admin_traffic_by", { p_since: iso(since), p_until: iso(until), p_dim: "country", p_area: "site", p_limit: 250 }),
    db.rpc("admin_traffic_by", { p_since: iso(since), p_until: iso(until), p_dim: "device", p_area: "site" }),
    db.rpc("admin_traffic_by", { p_since: iso(since), p_until: iso(until), p_dim: "browser", p_area: "site" }),
  ]);
  const chAcc = accountsBy((u) => channelOf.get(u) ?? "unknown");
  const chVisitors = new Map<string, number>();
  for (const r of byChannelVisits.data ?? []) { const k = channelGroup(r.key); chVisitors.set(k, (chVisitors.get(k) ?? 0) + Number(r.visitors)); }
  const channels = [...new Set([...chVisitors.keys(), ...chAcc.keys()])].map((key) => ({ key, visitors: chVisitors.get(key) ?? 0, signups: chAcc.get(key)?.signups ?? 0, paying: chAcc.get(key)?.paying ?? 0, revenue: chAcc.get(key)?.revenue ?? 0 }))
    .sort((a, b) => b.visitors + b.signups * 100 - (a.visitors + a.signups * 100));
  const coAcc = accountsBy((u) => firstVisit.get(u)?.country ?? "unknown");
  const coVisitors = new Map((byCountryVisits.data ?? []).map((r) => [r.key, Number(r.visitors)]));
  const countries = [...new Set([...coVisitors.keys(), ...coAcc.keys()])].map((key) => ({ key, visitors: coVisitors.get(key) ?? 0, signups: coAcc.get(key)?.signups ?? 0, paying: coAcc.get(key)?.paying ?? 0, revenue: coAcc.get(key)?.revenue ?? 0 }))
    .sort((a, b) => b.visitors - a.visitors || b.signups - a.signups);

  // ── plans, top customers, cohorts ──
  const planRows = new Map<string, { plan: string; period: string; subscribers: number; mrr: number }>();
  for (const [, s] of activeNow) {
    const k = `${s.plan}|${s.period ?? "monthly"}`;
    const r = planRows.get(k) ?? { plan: s.plan ?? "—", period: s.period ?? "monthly", subscribers: 0, mrr: 0 };
    r.subscribers++; r.mrr += monthlyPrice(price.get(s.plan ?? "") ?? 0, s.period); planRows.set(k, r);
  }
  const topCustomers = [...custNow.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([workspaceId, revenue]) => ({ workspaceId, name: wsById.get(workspaceId)?.name ?? null, revenue }));
  // Paying cohorts by month of first payment: share still subscribed or buying N months later.
  const cohortMonths = [...new Set([...firstPaid.entries()].filter(([ws]) => wsPasses(ws)).map(([, t]) => monthKey(t)))].sort().slice(-6);
  const paidMonths = new Map<string, Set<string>>();
  for (const i of usdInvoices) { const s = paidMonths.get(i.workspace_id) ?? new Set<string>(); s.add(monthKey(Date.parse(i.created_at))); paidMonths.set(i.workspace_id, s); }
  const cohorts = cohortMonths.map((m) => {
    const members = [...firstPaid.entries()].filter(([ws, t]) => monthKey(t) === m && wsPasses(ws)).map(([ws]) => ws);
    const retained = Array.from({ length: 6 }, (_, k) => {
      const d = new Date(`${m}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + k);
      if (d.getTime() >= until) return null;
      const mk = monthKey(d.getTime());
      // Kept: paid that month, or had an active subscription that month (annual plans pay once a year).
      return ratio(members.filter((ws) => paidMonths.get(ws)?.has(mk) || (subState.get(ws)?.active && subState.get(ws)!.since <= d.getTime())).length, members.length);
    });
    return { month: m, size: members.length, retained };
  });

  const k = {
    views: metric(filteredTraffic ? null : sum(trafficNow.data, "views"), filteredTraffic ? null : sum(trafficPrev.data, "views")),
    visits: metric(filteredTraffic ? null : sum(trafficNow.data, "visits"), filteredTraffic ? null : sum(trafficPrev.data, "visits")),
    visitors: metric(filteredTraffic ? null : sum(trafficNow.data, "visitors"), filteredTraffic ? null : sum(trafficPrev.data, "visitors")),
    signups: metric(sNow.length, sPrev.length),
    signupRate: metric(
      filteredTraffic || tracked >= until ? null : ratio(signups(Math.max(since, tracked), until).length, sum(trafficNow.data, "visitors")),
      filteredTraffic || tracked >= since ? null : ratio(signups(Math.max(prevSince, tracked), since).length, sum(trafficPrev.data, "visitors")),
    ),
    activationRate: metric(ratio(activated(sNow), sNow.length), ratio(activated(sPrev), sPrev.length)),
    paidConversion: metric(ratio(sNow.filter((p) => p.workspace_id && firstPaid.has(p.workspace_id)).length, sNow.length), ratio(sPrev.filter((p) => p.workspace_id && firstPaid.has(p.workspace_id)).length, sPrev.length)),
    newPaying: metric(newPay, newPayPrev),
    activePaying: metric(activeNow.length + subscribers.payg, activeAt(since).length),
    churnRate: metric(churnRateFor(since, until), churnRateFor(prevSince, since)),
    revenue: metric(revNow, revPrev),
    arppu: metric(arppu, arppuPrev),
    mrr: metric(mrr, mrrPrev),
    arr: metric(mrr * 12, mrrPrev * 12),
    runRate: metric(revenueIn(until - 30 * DAY, until) * 12, revenueIn(until - 60 * DAY, until - 30 * DAY) * 12),
    repeatRate: metric(repeatRate, null),
    cac: metric(cac, cacPrev),
    ltv: metric(ltvNow, ltvPrev),
    ltvCac: metric(ltvNow != null && cac ? ltvNow / cac : null, ltvPrev != null && cacPrev ? ltvPrev / cacPrev : null),
    payback: metric(paybackMonths(cac, arppuMonthly, gm), null),
    grossMargin: metric(gm, gmPrev),
    profit: metric(revNow || cogsNow || fixedNow || mktNow ? profitNow : null, revPrev || cogsPrev || fixedPrev || mktPrev ? profitPrev : null),
    profitMargin: metric(ratio(profitNow, revNow), ratio(profitPrev, revPrev)),
    avgRecurring: metric(ratio(mrr, activeNow.length), ratio(mrrPrev, activePrevList.length)),
    activeAdvertisers: metric(advertisersIn(since, until), advertisersIn(prevSince, since)),
    campaigns: metric(campaignsIn(since, until), campaignsIn(prevSince, since)),
    appSessions: metric(sessionsIn(since, until), sessionsIn(prevSince, since)),
    nrr: metric(nrr(custPrev, custNow), null),
    costToServe: metric(cogsNow, cogsPrev),
    marketing: metric(mktNow, mktPrev),
    fixed: metric(fixedNow, fixedPrev),
  };

  return {
    filters: f, unit, labels, series, kpis: k,
    growth: { signups: g((a, b) => signups(a, b).length), revenue: g(revenueIn), paying: g(newPayingIn) },
    churn: { day: churnWindow(1), month: churnWindow(30), year: churnWindow(365) },
    subscribers,
    // Visitors lead the journey only when the whole period was tracked.
    funnel: [
      ...(filteredTraffic || tracked > since ? [] : [{ key: "visitors", n: sum(trafficNow.data, "visitors") }]),
      { key: "signups", n: sNow.length },
      { key: "onboarded", n: sNow.filter((p) => p.onboarded_at).length },
      { key: "activated", n: activated(sNow) },
      { key: "paying", n: sNow.filter((p) => p.workspace_id && firstPaid.has(p.workspace_id)).length },
    ],
    channels, countries,
    devices: (byDevice.data ?? []).map((r) => ({ key: r.key, visitors: Number(r.visitors) })),
    browsers: (byBrowser.data ?? []).map((r) => ({ key: r.key, visitors: Number(r.visitors) })),
    plans: [...planRows.values()].sort((a, b) => b.mrr - a.mrr),
    topCustomers,
    concentration: concentration([...custNow.values()]),
    cohorts,
  };
}

/** Live: who is on Yolias in the last minutes (page views), with signed-in names. */
export async function liveVisitors(minutes = 5) {
  const db = ydb();
  const { data, error } = await db.rpc("admin_live_visitors", { p_minutes: minutes });
  if (error) throw error;
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.user_id).filter((x): x is string => Boolean(x)))];
  const { data: people } = ids.length ? await db.from("profiles").select("id, email, full_name").in("id", ids) : { data: [] };
  const who = new Map((people ?? []).map((p) => [p.id, p]));
  return rows.map((r) => ({ ...r, name: r.user_id ? who.get(r.user_id)?.full_name ?? null : null, email: r.user_id ? who.get(r.user_id)?.email ?? null : null }));
}

/** The owner's monthly costs (fixed costs and marketing spend per channel). */
export async function financeEntries(limitMonths = 12) {
  const from = new Date(); from.setUTCDate(1); from.setUTCMonth(from.getUTCMonth() - limitMonths + 1);
  const { data, error } = await ydb().from("yolias_finance_entries").select("*").gte("month", from.toISOString().slice(0, 10)).order("month", { ascending: false }).order("kind").order("category");
  if (error) throw error;
  return data ?? [];
}
