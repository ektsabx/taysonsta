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

type Db = ReturnType<typeof createAdminClient>;
const DAY = 86_400_000;
export const MIN_CONTACTED = 10;
const WINDOW_DAYS = 180;

export interface Row { value: string; contacted: number; replies: number; positive: number; meetings: number }
export interface Insights {
  contacted: number;
  byIndustry: Row[]; byCountry: Row[]; byTitle: Row[]; bySize: Row[];
  openings: (Row & { group: string | null })[];
  sources: (Row & { bounced: number })[];
  objections: string[]; notInterested: string[];
}

const POSITIVE = new Set(["interested", "meeting_request"]);
const band = (n: number | null | undefined) => n == null ? null : n <= 10 ? "1-10" : n <= 50 ? "11-50" : n <= 200 ? "51-200" : n <= 500 ? "201-500" : n <= 1000 ? "501-1000" : "1001+";

/** Pure: per-value results from per-person facts (unit-tested). */
export function tally(people: { key: string | null; replied: boolean; positive: boolean; meeting: boolean }[]): Row[] {
  const m = new Map<string, Row>();
  for (const p of people) {
    if (!p.key) continue;
    const r = m.get(p.key) ?? { value: p.key, contacted: 0, replies: 0, positive: 0, meetings: 0 };
    r.contacted++; if (p.replied) r.replies++; if (p.positive) r.positive++; if (p.meeting) r.meetings++;
    m.set(p.key, r);
  }
  return [...m.values()].filter((r) => r.contacted >= MIN_CONTACTED).sort((a, b) => b.positive / b.contacted - a.positive / a.contacted || b.contacted - a.contacted).slice(0, 8);
}

export async function computeInsights(db: Db, workspaceId: string): Promise<Insights> {
  const since = new Date(Date.now() - WINDOW_DAYS * DAY).toISOString();
  const { data: firsts } = await db.from("outreach_messages").select("lead_id, variant, delivery_status, prospect_id, company_id, enrollment:outreach_enrollments(audience_group_id)")
    .eq("workspace_id", workspaceId).eq("direction", "outbound").eq("status", "sent").eq("step_position", 1).gte("sent_at", since).limit(10_000);
  const sent = (firsts ?? []).filter((m) => m.lead_id);
  const leadIds = [...new Set(sent.map((m) => m.lead_id!))];
  const empty: Insights = { contacted: 0, byIndustry: [], byCountry: [], byTitle: [], bySize: [], openings: [], sources: [], objections: [], notInterested: [] };
  if (!leadIds.length) return empty;
  const chunk = <T,>(xs: T[], n = 500) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
  const replies: { lead_id: string | null; analysis: unknown }[] = [];
  const meetings = new Set<string>();
  const leads = new Map<string, { prospect_id: string | null; company_id: string | null }>();
  for (const ids of chunk(leadIds)) {
    const [{ data: r }, { data: mt }, { data: l }] = await Promise.all([
      db.from("outreach_messages").select("lead_id, analysis").eq("workspace_id", workspaceId).eq("direction", "inbound").in("lead_id", ids),
      db.from("sales_meetings").select("lead_id").eq("workspace_id", workspaceId).neq("status", "canceled").in("lead_id", ids),
      db.from("sales_leads").select("id, prospect_id, company_id").in("id", ids),
    ]);
    replies.push(...(r ?? []));
    for (const m of mt ?? []) meetings.add(m.lead_id);
    for (const x of l ?? []) leads.set(x.id, { prospect_id: x.prospect_id, company_id: x.company_id });
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
      industry: c?.industry ?? null, country: (p?.country ?? c?.country ?? null)?.toUpperCase() ?? null, title: p?.title ?? null, size: band(c?.employee_count),
      source: p?.source ?? c?.source ?? null,
      opening: m.variant === "b" ? g?.angle_b ?? null : g?.angle_a ?? null, group,
    };
  });
  const by = (f: (p: (typeof people)[number]) => string | null) => tally(people.map((p) => ({ key: f(p), replied: p.replied, positive: p.positive, meeting: p.meeting })));
  const openings = by((p) => p.opening).map((r) => ({ ...r, value: r.value.slice(0, 300), group: people.find((p) => p.opening === r.value)?.group ?? null }));
  const sources = by((p) => p.source).map((r) => ({ ...r, bounced: people.filter((p) => p.source === r.value && p.bounced).length }));
  const uniq = (xs: string[]) => [...new Map(xs.map((x) => [x.toLowerCase(), x])).values()].slice(-6);
  return {
    contacted: people.length,
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
  return [
    best(i.openings, "Openings that got interest"),
    best(i.byIndustry, "Industries that responded best"),
    best(i.byTitle, "Job titles that responded best"),
    i.objections.length ? `Objections people raised (answer them before they come up, without naming them): ${i.objections.slice(-3).join(" | ")}` : "",
  ].filter(Boolean).join("\n");
}

/** The writer's hint for one workspace (cached per run of the worker by the caller's process). */
export async function insightLines(workspaceId: string): Promise<string> {
  const { data } = await createAdminClient().from("workspace_insights").select("data").eq("workspace_id", workspaceId).maybeSingle();
  return hintLines((data?.data as unknown as Insights | null) ?? null);
}
