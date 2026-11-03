import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

// Learning (owner, 2026-10-31, D-273): once a day, from each workspace's own
// results, which industries, countries, job titles and openings got replies
// and meetings, the objections and reasons for "no" people gave, and how each
// data source's contacts did (bounces, replies). Counts and short phrases
// only; message bodies are never copied. The writer gets the strongest lines
// as a hint (lib/outreach/index.ts); nothing here changes the agent's policy,
// limits or permissions (lib/agent-core/policy.ts). A number is shown only
// with enough behind it (MIN_CONTACTED people).
//
// D-275 (owner, 2026-11-02): a result is now what the campaign is for, not
// only a meeting: a meeting booked, a deal won, or a purchase or lead the
// Yolias pixel counted for that person. What worked also decides who is
// contacted first (learnedLift → lib/campaigns/engines.ts priority), and each
// campaign gets its own insights and plain "Yolias learned…" facts.

type Db = ReturnType<typeof createAdminClient>;
const DAY = 86_400_000;
export const MIN_CONTACTED = 10;
const WINDOW_DAYS = 180;

export interface Row {
  value: string; contacted: number; replies: number; positive: number; meetings: number;
  /** D-275: meetings that took place, deals won, pixel conversions, and results (a meeting, a win or a conversion, once per person). Older stored rows lack them. */
  held?: number; won?: number; conversions?: number; results?: number; value_usd?: number;
}
export interface Insights {
  contacted: number;
  /** Totals behind the rows (D-275), for the baseline rate. */
  positive?: number; results?: number;
  byIndustry: Row[]; byCountry: Row[]; byTitle: Row[]; bySize: Row[];
  openings: (Row & { group: string | null })[];
  sources: (Row & { bounced: number })[];
  objections: string[]; notInterested: string[];
}

const POSITIVE = new Set(["interested", "meeting_request"]);
const band = (n: number | null | undefined) => n == null ? null : n <= 10 ? "1-10" : n <= 50 ? "11-50" : n <= 200 ? "51-200" : n <= 500 ? "201-500" : n <= 1000 ? "501-1000" : "1001+";

export interface Fact { key: string | null; replied: boolean; positive: boolean; meeting: boolean; held?: boolean; won?: boolean; conversion?: boolean; value?: number }

/** A person's result: a meeting booked, a deal won or a conversion on the member's website (D-275). */
export const isResult = (p: Pick<Fact, "meeting" | "won" | "conversion">) => p.meeting || Boolean(p.won) || Boolean(p.conversion);

/** Pure: per-value results from per-person facts (unit-tested). Best results first, then interest. */
export function tally(people: Fact[]): Row[] {
  const m = new Map<string, Row>();
  for (const p of people) {
    if (!p.key) continue;
    const r = m.get(p.key) ?? { value: p.key, contacted: 0, replies: 0, positive: 0, meetings: 0, held: 0, won: 0, conversions: 0, results: 0, value_usd: 0 };
    r.contacted++; if (p.replied) r.replies++; if (p.positive) r.positive++; if (p.meeting) r.meetings++;
    if (p.held) r.held!++; if (p.won) r.won!++; if (p.conversion) r.conversions!++; if (isResult(p)) r.results!++;
    r.value_usd = (r.value_usd ?? 0) + (p.value ?? 0);
    m.set(p.key, r);
  }
  const rate = (r: Row, k: "results" | "positive") => (r[k] ?? 0) / r.contacted;
  return [...m.values()].filter((r) => r.contacted >= MIN_CONTACTED)
    .sort((a, b) => rate(b, "results") - rate(a, "results") || rate(b, "positive") - rate(a, "positive") || b.contacted - a.contacted).slice(0, 8);
}

/**
 * What the results so far say about one person (D-275): above 1 when people
 * like them (industry, job title, company size, country) brought more
 * results than the workspace's average, below 1 when fewer. Each group is
 * pulled toward the average by its size (SHRINK people of "prior"), so a
 * handful of lucky replies never moves the order much. Interest stands in
 * for results until there are enough results to learn from. 1 = nothing
 * learned yet.
 */
export const LEARN_MIN_CONTACTED = 50;
const SHRINK = 25;
export function learnedLift(i: Insights | null, person: { industry?: string | null; title?: string | null; size?: string | null; country?: string | null }): number {
  if (!i || i.contacted < LEARN_MIN_CONTACTED) return 1;
  const metric: "results" | "positive" = (i.results ?? 0) >= 5 ? "results" : "positive";
  const total = metric === "results" ? i.results ?? 0 : i.positive ?? 0;
  if (total < 3) return 1;
  const base = total / i.contacted;
  const one = (rows: Row[], v: string | null | undefined) => {
    if (!v) return 1;
    const row = rows.find((r) => r.value.toLowerCase() === v.toLowerCase());
    if (!row) return 1;
    return ((row[metric] ?? 0) + SHRINK * base) / (row.contacted + SHRINK) / base;
  };
  const lift = one(i.byIndustry, person.industry) * one(i.byTitle, person.title) * one(i.bySize, person.size) * one(i.byCountry, person.country?.toUpperCase());
  return Math.min(1.6, Math.max(0.6, lift));
}

export type LearnedDim = "industry" | "title" | "size" | "country" | "opening";
export interface Learned { dim: LearnedDim; metric: "results" | "positive"; best: { value: string; rate: number; n: number }; other: { rate: number; n: number } }

/**
 * Pure: plain facts a member can read on a campaign ("Owners booked 3× more
 * than the rest", D-275). Only a clear difference with enough people behind
 * both sides is said; otherwise nothing.
 */
export function learnedFacts(i: Insights | null, max = 4): Learned[] {
  if (!i || i.contacted < LEARN_MIN_CONTACTED) return [];
  const metric: "results" | "positive" = (i.results ?? 0) >= 5 ? "results" : "positive";
  const dims: [LearnedDim, Row[]][] = [["title", i.byTitle], ["industry", i.byIndustry], ["size", i.bySize], ["country", i.byCountry], ["opening", i.openings]];
  const out: (Learned & { lift: number })[] = [];
  for (const [dim, rows] of dims) {
    const best = rows.filter((r) => r.contacted >= 20 && (r[metric] ?? 0) >= 3).sort((a, b) => (b[metric] ?? 0) / b.contacted - (a[metric] ?? 0) / a.contacted)[0];
    if (!best) continue;
    const total = metric === "results" ? i.results ?? 0 : i.positive ?? 0;
    const restN = i.contacted - best.contacted, restK = total - (best[metric] ?? 0);
    if (restN < 20) continue;
    const bestRate = (best[metric] ?? 0) / best.contacted, restRate = restK / restN;
    const lift = restRate > 0 ? bestRate / restRate : bestRate > 0 ? 3 : 0;
    if (lift < 1.5) continue;
    out.push({ dim, metric, best: { value: best.value.slice(0, 120), rate: bestRate, n: best.contacted }, other: { rate: restRate, n: restN }, lift });
  }
  return out.sort((a, b) => b.lift - a.lift).slice(0, max).map((f) => ({ dim: f.dim, metric: f.metric, best: f.best, other: f.other }));
}

/** Pixel events that count as a conversion for learning (the website objectives' results). */
const CONVERSION_EVENTS = ["Purchase", "Lead", "CompleteRegistration", "SubmitApplication", "Subscribe", "StartTrial"];

export async function computeInsights(db: Db, workspaceId: string, opts: { campaignId?: string } = {}): Promise<Insights> {
  const since = new Date(Date.now() - WINDOW_DAYS * DAY).toISOString();
  let q = db.from("outreach_messages").select("lead_id, variant, delivery_status, prospect_id, company_id, enrollment:outreach_enrollments(audience_group_id)")
    .eq("workspace_id", workspaceId).eq("direction", "outbound").eq("status", "sent").eq("step_position", 1).gte("sent_at", since);
  if (opts.campaignId) q = q.eq("outreach_campaign_id", opts.campaignId);
  const { data: firsts } = await q.limit(10_000);
  const sent = (firsts ?? []).filter((m) => m.lead_id);
  const leadIds = [...new Set(sent.map((m) => m.lead_id!))];
  const empty: Insights = { contacted: 0, byIndustry: [], byCountry: [], byTitle: [], bySize: [], openings: [], sources: [], objections: [], notInterested: [] };
  if (!leadIds.length) return empty;
  const chunk = <T,>(xs: T[], n = 500) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
  const replies: { lead_id: string | null; analysis: unknown }[] = [];
  const meetings = new Set<string>(), held = new Set<string>(), won = new Set<string>(), converted = new Set<string>();
  const value = new Map<string, number>();
  const leads = new Map<string, { prospect_id: string | null; company_id: string | null }>();
  for (const ids of chunk(leadIds)) {
    const [{ data: r }, { data: mt }, { data: l }, { data: px }] = await Promise.all([
      db.from("outreach_messages").select("lead_id, analysis").eq("workspace_id", workspaceId).eq("direction", "inbound").in("lead_id", ids),
      db.from("sales_meetings").select("lead_id, status").eq("workspace_id", workspaceId).neq("status", "canceled").in("lead_id", ids),
      db.from("sales_leads").select("id, prospect_id, company_id, stage, deal_value").in("id", ids),
      db.from("pixel_events").select("lead_id, event, value, currency").eq("workspace_id", workspaceId).is("test_code", null).in("event", CONVERSION_EVENTS).in("lead_id", ids),
    ]);
    replies.push(...(r ?? []));
    for (const m of mt ?? []) { meetings.add(m.lead_id); if (m.status === "completed") held.add(m.lead_id); }
    for (const x of l ?? []) {
      leads.set(x.id, { prospect_id: x.prospect_id, company_id: x.company_id });
      if (x.stage === "closed") { won.add(x.id); if (x.deal_value != null) value.set(x.id, (value.get(x.id) ?? 0) + Number(x.deal_value)); }
    }
    for (const e of px ?? []) {
      if (!e.lead_id) continue;
      converted.add(e.lead_id);
      if (e.event === "Purchase" && e.value != null && (!e.currency || e.currency === "USD")) value.set(e.lead_id, (value.get(e.lead_id) ?? 0) + Number(e.value));
    }
  }
  const kindOf = new Map<string, string>();
  const objections: string[] = [], notInterested: string[] = [];
  for (const r of replies) {
    if (!r.lead_id) continue;
    const a = r.analysis as { kind?: string; summary?: string } | null;
    const k = a?.kind ?? "reply";
    if (!kindOf.has(r.lead_id) || POSITIVE.has(k)) kindOf.set(r.lead_id, k);
    const line = a?.summary?.replace(/\s+/g, " ").trim().slice(0, 140);
    if (line && k === "objection") objections.push(line);
    if (line && k === "not_interested") notInterested.push(line);
  }
  const prospectIds = [...new Set([...leads.values()].map((l) => l.prospect_id).filter((x): x is string => Boolean(x)))];
  const companyIds = [...new Set([...leads.values()].map((l) => l.company_id).filter((x): x is string => Boolean(x)))];
  const prospects = new Map<string, { title: string | null; country: string | null; source: string }>();
  const companies = new Map<string, { industry: string | null; country: string | null; employee_count: number | null; source: string }>();
  for (const ids of chunk(prospectIds)) for (const p of (await db.from("prospects").select("id, title, country, source").in("id", ids)).data ?? []) prospects.set(p.id, p);
  for (const ids of chunk(companyIds)) for (const c of (await db.from("companies").select("id, industry, country, employee_count, source").in("id", ids)).data ?? []) companies.set(c.id, c);
  const { data: groups } = await db.from("audience_groups").select("id, angle_a, angle_b").eq("workspace_id", workspaceId).limit(500);
  const angles = new Map((groups ?? []).map((g) => [g.id, g]));

  const people = sent.map((m) => {
    const lead = leads.get(m.lead_id!) ?? { prospect_id: null, company_id: null };
    const p = lead.prospect_id ? prospects.get(lead.prospect_id) : undefined;
    const c = lead.company_id ? companies.get(lead.company_id) : undefined;
    const k = kindOf.get(m.lead_id!);
    const group = (m.enrollment as unknown as { audience_group_id: string | null } | null)?.audience_group_id ?? null;
    const g = group ? angles.get(group) : undefined;
    return {
      replied: Boolean(k), positive: POSITIVE.has(k ?? ""), meeting: meetings.has(m.lead_id!), bounced: m.delivery_status === "bounced",
      held: held.has(m.lead_id!), won: won.has(m.lead_id!), conversion: converted.has(m.lead_id!), value: value.get(m.lead_id!) ?? 0,
      industry: c?.industry ?? null, country: (p?.country ?? c?.country ?? null)?.toUpperCase() ?? null, title: p?.title ?? null, size: band(c?.employee_count),
      source: p?.source ?? c?.source ?? null,
      opening: m.variant === "b" ? g?.angle_b ?? null : g?.angle_a ?? null, group,
    };
  });
  const by = (f: (p: (typeof people)[number]) => string | null) => tally(people.map((p) => ({ key: f(p), replied: p.replied, positive: p.positive, meeting: p.meeting, held: p.held, won: p.won, conversion: p.conversion, value: p.value })));
  const openings = by((p) => p.opening).map((r) => ({ ...r, value: r.value.slice(0, 300), group: people.find((p) => p.opening === r.value)?.group ?? null }));
  const sources = by((p) => p.source).map((r) => ({ ...r, bounced: people.filter((p) => p.source === r.value && p.bounced).length }));
  const uniq = (xs: string[]) => [...new Map(xs.map((x) => [x.toLowerCase(), x])).values()].slice(-6);
  return {
    contacted: people.length,
    positive: people.filter((p) => p.positive).length,
    results: people.filter((p) => isResult(p)).length,
    byIndustry: by((p) => p.industry), byCountry: by((p) => p.country), byTitle: by((p) => p.title), bySize: by((p) => p.size),
    openings, sources, objections: uniq(objections), notInterested: uniq(notInterested),
  };
}

/** Worker step: once a day, the insights of every workspace that sent emails in the last 30 days. */
export async function learningSweep(): Promise<number> {
  const db = createAdminClient();
  const key = "learning.workspaces";
  const { data: st } = await db.from("worker_state").select("updated_at").eq("key", key).maybeSingle();
  if (st && Date.now() - Date.parse(st.updated_at) < DAY) return 0;
  await db.from("worker_state").upsert({ key, value: {}, updated_at: new Date().toISOString() }, { onConflict: "key" });
  const { data: active } = await db.from("outreach_messages").select("workspace_id").eq("direction", "outbound").eq("status", "sent").gte("sent_at", new Date(Date.now() - 30 * DAY).toISOString()).limit(10_000);
  const ids = [...new Set((active ?? []).map((m) => m.workspace_id))];
  for (const ws of ids) {
    try {
      const data = await computeInsights(db, ws);
      await db.from("workspace_insights").upsert({ workspace_id: ws, data: data as unknown as Json, computed_at: new Date().toISOString() }, { onConflict: "workspace_id" });
    } catch (e) {
      console.error("[learning]", ws, e instanceof Error ? e.message : e);
    }
  }
  // D-275: each campaign that sent in the last 30 days gets its own insights ("Yolias learned…").
  const { data: camps } = await db.from("outreach_messages").select("workspace_id, outreach_campaign_id").eq("direction", "outbound").eq("status", "sent").not("outreach_campaign_id", "is", null)
    .gte("sent_at", new Date(Date.now() - 30 * DAY).toISOString()).limit(20_000);
  const pairs = [...new Map((camps ?? []).map((c) => [c.outreach_campaign_id!, c.workspace_id])).entries()];
  for (const [campaignId, ws] of pairs) {
    try {
      const data = await computeInsights(db, ws, { campaignId });
      await db.from("campaign_insights").upsert({ campaign_id: campaignId, workspace_id: ws, data: data as unknown as Json, computed_at: new Date().toISOString() }, { onConflict: "campaign_id" });
    } catch (e) {
      console.error("[learning]", campaignId, e instanceof Error ? e.message : e);
    }
  }
  return ids.length;
}

const pct = (a: number, b: number) => `${Math.round((a / Math.max(b, 1)) * 100)}%`;

/** Pure: the writer's hint lines from stored insights (empty without enough data). */
export function hintLines(i: Insights | null): string {
  if (!i || i.contacted < MIN_CONTACTED) return "";
  const best = (rows: Row[], label: string) => {
    const top = rows.filter((r) => r.positive > 0).slice(0, 3);
    return top.length ? `${label}: ${top.map((r) => `${r.value} (${pct(r.positive, r.contacted)} interested of ${r.contacted})`).join("; ")}` : "";
  };
  const won = (rows: Row[], label: string) => {
    const top = rows.filter((r) => (r.results ?? 0) > 0).sort((a, b) => (b.results ?? 0) / b.contacted - (a.results ?? 0) / a.contacted).slice(0, 3);
    return top.length && (i.results ?? 0) >= 3 ? `${label}: ${top.map((r) => `${r.value} (${pct(r.results ?? 0, r.contacted)} became a meeting, a sale or a lead, of ${r.contacted})`).join("; ")}` : "";
  };
  return [
    won(i.openings, "Openings that brought results"),
    won(i.byTitle, "Job titles that brought results"),
    best(i.openings, "Openings that got interest"),
    best(i.byIndustry, "Industries that responded best"),
    best(i.byTitle, "Job titles that responded best"),
    i.objections.length ? `Objections people raised (answer them before they come up, without naming them): ${i.objections.slice(-3).join(" | ")}` : "",
  ].filter(Boolean).join("\n");
}

/** The stored insights of a workspace (or null before the first daily run). */
export async function storedInsights(workspaceId: string): Promise<Insights | null> {
  const { data } = await createAdminClient().from("workspace_insights").select("data").eq("workspace_id", workspaceId).maybeSingle();
  return (data?.data as unknown as Insights | null) ?? null;
}

export { band as sizeBand };

/** The writer's hint for one workspace (cached per run of the worker by the caller's process). */
export async function insightLines(workspaceId: string): Promise<string> {
  const { data } = await createAdminClient().from("workspace_insights").select("data").eq("workspace_id", workspaceId).maybeSingle();
  return hintLines((data?.data as unknown as Insights | null) ?? null);
}
