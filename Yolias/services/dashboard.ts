import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAutoReplyRow } from "@/lib/outreach/auto-reply";
import { rangeBounds, zeroCounts, addCounts, type Counts } from "@/lib/campaigns/metrics";
import { campaignTable, type CampaignLine } from "@/services/campaign-table";
import { prospectRate } from "@/services/campaign-metrics";
import { monthlyUsage } from "@/services/workspace";
import { spentToday } from "@/lib/campaigns/budget";

// The dashboard (owner, 2026-10-31, D-273), after the reference the owner
// chose: what Yolias is working on now, the daily budget and the balance,
// performance for a period (one campaign or all) with a small chart per
// number, then every campaign with its state, results, cost per meeting,
// spend and daily cap, and what Yolias did last. Real rows only; a number
// that can't be worked out is null (shown "–").

export type DashRange = "7d" | "30d" | "90d";
const DAY = 86_400_000;
type Msg = { outreach_campaign_id: string | null; lead_id: string | null; direction: string; status: string; delivery_status: string | null; step_position: number | null; sent_at: string | null; received_at: string | null; created_at: string; analysis: unknown; subject?: string; instruction?: string | null };

export interface Series { days: string[]; sent: number[]; delivered: (number | null)[]; replies: number[]; interested: number[]; meetings: number[]; spent: number[] }
export interface DashboardData {
  live: { campaignId: string; name: string; what: string; at: string; kind: string; meta: unknown } | null;
  budget: { dailyUsd: number | null; spentToday: number; balanceUsd: number | null; rate: number };
  counts: Counts; firsts: number; followUps: number; series: Series;
  campaigns: CampaignLine[]; total: Counts;
  activity: { id: number; campaignId: string; campaign: string; body: string; at: string; kind: string; meta: unknown }[];
}

async function paged<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null }>, cap = 30_000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < cap; from += 1000) {
    const { data } = await q(from, from + 999);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function dashboardData(workspaceId: string, range: DashRange, campaignId: string | null): Promise<DashboardData> {
  const db = createAdminClient();
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const bounds = range === "90d" ? { from: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()) - 89 * DAY).toISOString(), to: null } : rangeBounds(range, new Date());
  const [lines, rate, usage, { data: ws }, today, act] = await Promise.all([
    campaignTable(workspaceId, bounds, {}),
    prospectRate(workspaceId), monthlyUsage(workspaceId),
    db.from("workspaces").select("daily_budget_usd").eq("id", workspaceId).maybeSingle(),
    spentToday(workspaceId),
    db.from("campaign_activity").select("id, campaign_id, kind, body, meta, created_at, campaign:outreach_campaigns(name, status)").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(12),
  ]);
  const scope = campaignId ? lines.filter((l) => l.id === campaignId) : lines;
  const ids = new Set(scope.map((l) => l.id));
  const total = scope.reduce((s, l) => addCounts(s, l.counts), zeroCounts());

  // Day by day, for the small charts.
  const start = Date.parse(bounds.from!);
  const keys = Array.from({ length: days }, (_, i) => new Date(start + i * DAY).toISOString().slice(0, 10));
  const idx = new Map(keys.map((k, i) => [k, i]));
  const msgs = await paged<Msg>((a, b) => db.from("outreach_messages").select("outreach_campaign_id, lead_id, direction, status, delivery_status, step_position, sent_at, received_at, created_at, analysis, instruction")
    .eq("workspace_id", workspaceId).not("outreach_campaign_id", "is", null).or(`sent_at.gte.${bounds.from},received_at.gte.${bounds.from}`).range(a, b));
  const sent = keys.map(() => 0), bounced = keys.map(() => 0), replies = keys.map(() => new Set<string>()), interested = keys.map(() => new Set<string>()), meetings = keys.map(() => 0), spent = keys.map(() => 0);
  let firsts = 0, followUps = 0;
  for (const m of msgs) {
    if (!m.outreach_campaign_id || !ids.has(m.outreach_campaign_id)) continue;
    if (m.direction === "outbound" && m.status === "sent" && m.sent_at) {
      const i = idx.get(m.sent_at.slice(0, 10)); if (i == null) continue;
      sent[i]++; if (m.delivery_status === "bounced") bounced[i]++;
      if (m.step_position === 1) firsts++; else followUps++;
    } else if (m.direction === "inbound" && m.lead_id && !isAutoReplyRow(m as never)) {
      const i = idx.get((m.received_at ?? m.created_at).slice(0, 10)); if (i == null) continue;
      replies[i].add(m.lead_id);
      if (["interested", "meeting_request"].includes((m.analysis as { kind?: string } | null)?.kind ?? "")) interested[i].add(m.lead_id);
    }
  }
  const { data: mt } = await db.from("sales_meetings").select("created_at, campaign_id, status").eq("workspace_id", workspaceId).gte("created_at", bounds.from!).neq("status", "canceled").limit(5000);
  for (const x of mt ?? []) { if (!x.campaign_id || !ids.has(x.campaign_id)) continue; const i = idx.get(x.created_at.slice(0, 10)); if (i != null) meetings[i]++; }
  // Spend by day: prospects consumed by the searches behind these campaigns × the rate.
  const { data: groups } = await db.from("audience_groups").select("campaign_id, search_campaign_id").eq("workspace_id", workspaceId).not("search_campaign_id", "is", null);
  const searches = new Set((groups ?? []).filter((g) => ids.has(g.campaign_id)).map((g) => g.search_campaign_id!));
  if (searches.size) {
    const ledger = await paged<{ campaign_id: string | null; prospects: number; created_at: string }>((a, b) => db.from("usage_ledger").select("campaign_id, prospects, created_at").eq("workspace_id", workspaceId).eq("kind", "consume").gte("created_at", bounds.from!).range(a, b));
    for (const u of ledger) { if (!u.campaign_id || !searches.has(u.campaign_id)) continue; const i = idx.get(u.created_at.slice(0, 10)); if (i != null) spent[i] += u.prospects * rate; }
  }

  // What Yolias is working on: the latest thing it did for a running campaign.
  const rows = (act.data ?? []).map((a) => ({ id: a.id, campaignId: a.campaign_id, kind: a.kind, body: a.body, meta: a.meta, at: a.created_at, campaign: (a.campaign as unknown as { name: string; status: string } | null) }));
  const running = rows.find((a) => a.campaign && ["active", "scheduled"].includes(a.campaign.status));
  const anyActive = lines.find((l) => l.status === "active" || l.status === "scheduled");
  return {
    live: running ? { campaignId: running.campaignId, name: running.campaign!.name, what: running.body, at: running.at, kind: running.kind, meta: running.meta } : anyActive ? { campaignId: anyActive.id, name: anyActive.name, what: "", at: anyActive.startsAt ?? anyActive.createdAt, kind: "note", meta: null } : null,
    budget: { dailyUsd: ws?.daily_budget_usd == null ? null : Number(ws.daily_budget_usd), spentToday: today, balanceUsd: rate > 0 ? Math.max(Number(usage.available ?? 0), 0) * rate : null, rate },
    counts: total, firsts, followUps,
    series: { days: keys, sent, delivered: sent.map((s, i) => (s ? (s - bounced[i]) / s : null)), replies: replies.map((x) => x.size), interested: interested.map((x) => x.size), meetings, spent },
    campaigns: lines, total: lines.reduce((s, l) => addCounts(s, l.counts), zeroCounts()),
    activity: rows.slice(0, 4).map((a) => ({ id: a.id, campaignId: a.campaignId, campaign: a.campaign?.name ?? "", body: a.body, at: a.at, kind: a.kind, meta: a.meta })),
  };
}
