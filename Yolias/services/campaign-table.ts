import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAutoReplyRow } from "@/lib/outreach/auto-reply";
import { addCounts, inRange, zeroCounts, type Counts } from "@/lib/campaigns/metrics";
import { prospectRate, ATTRIBUTION_DAYS } from "@/services/campaign-metrics";
import type { AudienceGroupRow, OutreachCampaignRow } from "@/types/database";

// The Campaigns table (owner, 2026-10-31, D-272): every campaign and each of
// its audience groups with the counts the metric registry turns into columns,
// for a date range. Counted from real rows (messages, meetings, ledger), each
// person once per count. Called after requireViewer with the session's
// workspace (admin client, always filtered by it).

const DAY = 86_400_000;
const POSITIVE = new Set(["interested", "meeting_request"]);

export interface GroupLine { id: string; name: string; status: AudienceGroupRow["status"]; source: AudienceGroupRow["source"]; counts: Counts }
export interface CampaignLine {
  id: string; name: string; status: OutreachCampaignRow["status"]; objective: OutreachCampaignRow["objective"]; channels: string[];
  ownerId: string | null; createdAt: string; startsAt: string | null; endsAt: string | null; budgetUsd: number | null; budgetType: OutreachCampaignRow["budget_type"];
  approved: boolean; countries: string[]; counts: Counts; groups: GroupLine[];
}

type Msg = { outreach_campaign_id: string | null; enrollment_id: string | null; lead_id: string | null; direction: string; status: string; delivery_status: string | null; sent_at: string | null; received_at: string | null; created_at: string; analysis: unknown };

async function paged<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null }>, cap = 50_000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < cap; from += 1000) {
    const { data } = await q(from, from + 999);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function campaignTable(workspaceId: string, range: { from: string | null; to: string | null }, opts: { ids?: string[]; includeArchived?: boolean } = {}): Promise<CampaignLine[]> {
  const db = createAdminClient();
  let cq = db.from("outreach_campaigns").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(500);
  if (opts.ids?.length) cq = cq.in("id", opts.ids);
  else if (!opts.includeArchived) cq = cq.neq("status", "archived");
  const camps = ((await cq).data ?? []) as OutreachCampaignRow[];
  if (!camps.length) return [];
  const ids = camps.map((c) => c.id);
  const { data: groupRows } = await db.from("audience_groups").select("*").in("campaign_id", ids).order("created_at");
  const groups = (groupRows ?? []) as AudienceGroupRow[];
  const searchIds = [...new Set([...groups.map((g) => g.search_campaign_id), ...camps.map((c) => c.source_campaign_id)].filter((x): x is string => Boolean(x)))];

  const [msgs, enrollments, meetings, ledger, prospects, rate] = await Promise.all([
    paged<Msg>((a, b) => db.from("outreach_messages").select("outreach_campaign_id, enrollment_id, lead_id, direction, status, delivery_status, sent_at, received_at, created_at, analysis")
      .eq("workspace_id", workspaceId).not("lead_id", "is", null).order("created_at").range(a, b)),
    paged<{ id: string; campaign_id: string; lead_id: string; audience_group_id: string | null }>((a, b) => db.from("outreach_enrollments").select("id, campaign_id, lead_id, audience_group_id").in("campaign_id", ids).range(a, b)),
    paged<{ campaign_id: string | null; lead_id: string; status: string; qualified: boolean | null; starts_at: string; created_at: string }>((a, b) => db.from("sales_meetings").select("campaign_id, lead_id, status, qualified, starts_at, created_at").eq("workspace_id", workspaceId).in("campaign_id", ids).range(a, b)),
    searchIds.length ? paged<{ campaign_id: string | null; prospects: number; created_at: string }>((a, b) => db.from("usage_ledger").select("campaign_id, prospects, created_at").eq("workspace_id", workspaceId).eq("kind", "consume").in("campaign_id", searchIds).range(a, b)) : Promise.resolve([]),
    searchIds.length ? paged<{ campaign_id: string; created_at: string }>((a, b) => db.from("prospects").select("campaign_id, created_at").in("campaign_id", searchIds).range(a, b)) : Promise.resolve([]),
    prospectRate(workspaceId),
  ]);

  // Which group each enrollment and each (campaign, lead) belongs to.
  const groupOfEnrollment = new Map(enrollments.map((e) => [e.id, e.audience_group_id]));
  const groupOfLead = new Map(enrollments.map((e) => [`${e.campaign_id}:${e.lead_id}`, e.audience_group_id]));
  // First touch (D-270): the campaign that first wrote to a person owns their outcome.
  const first = new Map<string, { campaign: string; at: number; group: string | null }>();
  for (const m of msgs) {
    if (m.direction !== "outbound" || m.status !== "sent" || !m.lead_id || !m.outreach_campaign_id || !m.sent_at) continue;
    const at = Date.parse(m.sent_at);
    const cur = first.get(m.lead_id);
    if (!cur || at < cur.at) first.set(m.lead_id, { campaign: m.outreach_campaign_id, at, group: m.enrollment_id ? groupOfEnrollment.get(m.enrollment_id) ?? null : null });
  }
  const owned = [...first.keys()];
  const won = owned.length ? await paged<{ id: string; deal_value: number | null; closed_at: string | null }>((a, b) => db.from("sales_leads").select("id, deal_value, closed_at").eq("workspace_id", workspaceId).eq("stage", "closed").in("id", owned.slice(0, 5000)).range(a, b)) : [];

  // Counts per bucket ("c:<campaign>" and "g:<group>"); each person once per count.
  const sets = new Map<string, Record<"contacted" | "replies" | "interested" | "requests", Set<string>>>();
  const nums = new Map<string, Counts>();
  const keysFor = (campaign: string, group: string | null | undefined) => [`c:${campaign}`, ...(group ? [`g:${group}`] : [])];
  const bucket = (k: string) => {
    if (!sets.has(k)) { sets.set(k, { contacted: new Set(), replies: new Set(), interested: new Set(), requests: new Set() }); nums.set(k, zeroCounts()); }
    return { s: sets.get(k)!, n: nums.get(k)! };
  };
  for (const m of msgs) {
    if (!m.outreach_campaign_id || !m.lead_id || !ids.includes(m.outreach_campaign_id)) continue;
    const g = m.enrollment_id ? groupOfEnrollment.get(m.enrollment_id) : groupOfLead.get(`${m.outreach_campaign_id}:${m.lead_id}`);
    for (const k of keysFor(m.outreach_campaign_id, g)) {
      const { s, n } = bucket(k);
      if (m.direction === "outbound" && m.status === "sent" && inRange(m.sent_at, range)) {
        n.sent++; if (m.delivery_status === "bounced") n.bounced++; else n.delivered++;
        s.contacted.add(m.lead_id);
      }
      if (m.direction === "inbound" && inRange(m.received_at ?? m.created_at, range) && !isAutoReplyRow(m as never)) {
        s.replies.add(m.lead_id);
        const kind = (m.analysis as { kind?: string } | null)?.kind ?? "";
        if (POSITIVE.has(kind)) s.interested.add(m.lead_id);
        if (kind === "meeting_request") s.requests.add(m.lead_id);
      }
    }
  }
  for (const mt of meetings) {
    if (!mt.campaign_id || mt.status === "canceled") continue;
    for (const k of keysFor(mt.campaign_id, groupOfLead.get(`${mt.campaign_id}:${mt.lead_id}`))) {
      const { n } = bucket(k);
      if (inRange(mt.created_at, range)) n.meetings++;
      if (mt.status === "completed" && inRange(mt.starts_at, range)) n.held++;
      if (mt.qualified === true && inRange(mt.starts_at, range)) n.qualified++;
    }
  }
  for (const l of won) {
    const f = first.get(l.id);
    if (!f || !l.closed_at || !ids.includes(f.campaign)) continue;
    const at = Date.parse(l.closed_at);
    if (at < f.at || at - f.at > ATTRIBUTION_DAYS * DAY || !inRange(l.closed_at, range)) continue;
    for (const k of keysFor(f.campaign, f.group)) { const { n } = bucket(k); n.customers++; n.revenueUsd += Number(l.deal_value ?? 0); }
  }
  // Searches: people found and prospects used, to the group that owns the search (else the campaign).
  const searchOwner = new Map<string, { campaign: string; group: string | null }>();
  for (const c of camps) if (c.source_campaign_id) searchOwner.set(c.source_campaign_id, { campaign: c.id, group: null });
  for (const g of groups) if (g.search_campaign_id) searchOwner.set(g.search_campaign_id, { campaign: g.campaign_id, group: g.id });
  for (const p of prospects) {
    const o = searchOwner.get(p.campaign_id);
    if (o && inRange(p.created_at, range)) for (const k of keysFor(o.campaign, o.group)) bucket(k).n.found++;
  }
  for (const u of ledger) {
    const o = u.campaign_id ? searchOwner.get(u.campaign_id) : null;
    if (o && inRange(u.created_at, range)) for (const k of keysFor(o.campaign, o.group)) { const { n } = bucket(k); n.prospectsUsed += u.prospects; n.spendUsd += u.prospects * rate; }
  }
  const counts = (k: string): Counts => {
    const b = sets.get(k), n = nums.get(k) ?? zeroCounts();
    return b ? { ...n, contacted: b.contacted.size, replies: b.replies.size, interested: b.interested.size, meetingRequests: b.requests.size } : n;
  };

  return camps.map((c) => {
    const mine = groups.filter((g) => g.campaign_id === c.id);
    const countries = [...new Set(mine.flatMap((g) => ((g.targeting as { countries?: { include?: string[] } } | null)?.countries?.include ?? [])))];
    return {
      id: c.id, name: c.name, status: c.status, objective: c.objective ?? "meetings", channels: c.channels?.length ? c.channels : ["email"], ownerId: c.owner_id ?? c.created_by,
      createdAt: c.created_at, startsAt: c.starts_at, endsAt: c.ends_at, budgetUsd: c.budget_usd == null ? null : Number(c.budget_usd), budgetType: c.budget_type, approved: Boolean(c.approved_at),
      countries, counts: counts(`c:${c.id}`),
      groups: mine.map((g) => ({ id: g.id, name: g.name, status: g.status, source: g.source, counts: counts(`g:${g.id}`) })),
    };
  });
}

/** The account's totals (the dashboard), from the same lines. */
export const totalCounts = (lines: CampaignLine[]): Counts => lines.reduce((s, l) => addCounts(s, l.counts), zeroCounts());
