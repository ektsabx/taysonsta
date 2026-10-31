import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlanCatalog } from "@/lib/plan-catalog";
import { isPaidPlan } from "@/lib/plans";
import { parseIcp } from "@/lib/discovery/icp";
import { forecastMeetings, pace, planGoal, priorFrom, roi, sharedFor, type Forecast, type FunnelCounts, type LearningRow, type Pace, type Plan, type Roi } from "@/lib/campaigns/engines";
import type { OutreachCampaignRow } from "@/types/database";

// A campaign's results, plan and forecast (owner, 2026-10-31, D-270), for the
// dashboard (every campaign) and a campaign's page (one). Counted from real
// rows only; the plan and the forecast come from lib/campaigns/engines.ts and
// are null without enough data. Called after requireViewer, with the
// workspace id from the session (admin client, always filtered by it).

const DAY = 86_400_000;
const POSITIVE = new Set(["interested", "meeting_request"]);
const STRONG_MATCH = 70;
/** A deal counts for the campaign that first contacted the person, if won within this many days. */
export const ATTRIBUTION_DAYS = 180;

export interface CampaignMetrics {
  id: string;
  name: string;
  status: OutreachCampaignRow["status"];
  aim: OutreachCampaignRow["aim"];
  approved: boolean;
  target: number | null;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  failureReason: string | null;
  found: number;
  strongMatch: number;
  contacted: number;
  sent: number;
  bounced: number;
  positive: number;
  requests: number;
  booked: number;
  held: number;
  noShow: number;
  qualified: number;
  /** Booked meetings not marked "not qualified": what counts toward the target. */
  towardTarget: number;
  customers: number;
  revenueUsd: number;
  prospectsUsed: number;
  costs: Roi;
  pace: Pace;
  plan: Plan | null;
  forecast: Forecast | null;
  /** Workspaces behind the shared-learning prior used, or 0 when none was used. */
  sharedWorkspaces: number;
}

type Msg = { outreach_campaign_id: string | null; lead_id: string | null; direction: string; status: string; delivery_status: string | null; sent_at: string | null; created_at: string; analysis: unknown };

async function paged<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null }>, cap = 50_000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < cap; from += 1000) {
    const { data } = await q(from, from + 999);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** The price of one prospect for this workspace: its plan's rate, or the smallest pay-as-you-go pack's. */
export async function prospectRate(workspaceId: string): Promise<number> {
  const db = createAdminClient();
  const { data: ws } = await db.from("workspaces").select("plan, subscription_status").eq("id", workspaceId).maybeSingle();
  if (ws && isPaidPlan(ws.plan) && ["active", "trialing", "past_due"].includes(ws.subscription_status ?? "")) {
    const terms = (await getPlanCatalog())[ws.plan];
    if (terms.prospects > 0) return terms.priceUsd / terms.prospects;
  }
  const { data: packs } = await db.from("prospect_packs").select("prospects, price_usd").eq("active", true);
  const rates = (packs ?? []).filter((p) => p.prospects > 0).map((p) => Number(p.price_usd) / p.prospects);
  return rates.length ? Math.max(...rates) : 0;
}

export async function campaignMetrics(workspaceId: string, opts: { ids?: string[]; includeArchived?: boolean } = {}): Promise<CampaignMetrics[]> {
  const db = createAdminClient();
  let cq = db.from("outreach_campaigns").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(200);
  if (opts.ids?.length) cq = cq.in("id", opts.ids);
  else if (!opts.includeArchived) cq = cq.neq("status", "archived");
  const { data: campRows } = await cq;
  const camps = (campRows ?? []) as OutreachCampaignRow[];
  if (!camps.length) return [];
  const ids = camps.map((c) => c.id);
  const searchIds = camps.map((c) => c.source_campaign_id).filter((x): x is string => Boolean(x));
  const strategyIds = camps.map((c) => c.strategy_id).filter((x): x is string => Boolean(x));

  const [msgs, meetings, searches, strong, ledger, strategies, learning, rate] = await Promise.all([
    // Every campaign message of the workspace: the first campaign that wrote to a person owns their outcome.
    paged<Msg>((a, b) => db.from("outreach_messages").select("outreach_campaign_id, lead_id, direction, status, delivery_status, sent_at, created_at, analysis")
      .eq("workspace_id", workspaceId).not("lead_id", "is", null).order("created_at").range(a, b)),
    paged<{ campaign_id: string | null; status: string; qualified: boolean | null; lead_id: string }>((a, b) => db.from("sales_meetings").select("campaign_id, status, qualified, lead_id").eq("workspace_id", workspaceId).in("campaign_id", ids).range(a, b)),
    searchIds.length ? db.from("campaigns").select("id, prospects_found").in("id", searchIds).then((r) => r.data ?? []) : Promise.resolve([]),
    searchIds.length ? paged<{ campaign_id: string }>((a, b) => db.from("prospects").select("campaign_id").in("campaign_id", searchIds).gte("match_score", STRONG_MATCH).range(a, b)) : Promise.resolve([]),
    searchIds.length ? paged<{ campaign_id: string | null; prospects: number }>((a, b) => db.from("usage_ledger").select("campaign_id, prospects").eq("workspace_id", workspaceId).eq("kind", "consume").in("campaign_id", searchIds).range(a, b)) : Promise.resolve([]),
    strategyIds.length ? db.from("strategies").select("id, icp").in("id", strategyIds).then((r) => r.data ?? []) : Promise.resolve([]),
    db.from("learning_rates").select("*").then((r) => (r.data ?? []) as LearningRow[]),
    prospectRate(workspaceId),
  ]);

  // First touch: the campaign that first sent to each person, and when.
  const first = new Map<string, { campaign: string; at: number }>();
  for (const m of msgs) {
    if (m.direction !== "outbound" || m.status !== "sent" || !m.lead_id || !m.outreach_campaign_id || !m.sent_at) continue;
    const at = Date.parse(m.sent_at);
    const cur = first.get(m.lead_id);
    if (!cur || at < cur.at) first.set(m.lead_id, { campaign: m.outreach_campaign_id, at });
  }
  const owned = new Map<string, string[]>();
  for (const [lead, f] of first) owned.set(f.campaign, [...(owned.get(f.campaign) ?? []), lead]);
  const allOwned = [...first.keys()];
  const won = allOwned.length
    ? await paged<{ id: string; deal_value: number | null; closed_at: string | null }>((a, b) => db.from("sales_leads").select("id, deal_value, closed_at").eq("workspace_id", workspaceId).eq("stage", "closed").in("id", allOwned.slice(0, 5000)).range(a, b))
    : [];
  const wonById = new Map(won.map((l) => [l.id, l]));
  const now = Date.now();

  return camps.map((c) => {
    const mine = msgs.filter((m) => m.outreach_campaign_id === c.id);
    const sent = mine.filter((m) => m.direction === "outbound" && m.status === "sent");
    const contactedLeads = new Set(sent.map((m) => m.lead_id!));
    const inbound = mine.filter((m) => m.direction === "inbound");
    const kind = (m: Msg) => (m.analysis as { kind?: string } | null)?.kind ?? "";
    const positiveLeads = new Set(inbound.filter((m) => POSITIVE.has(kind(m))).map((m) => m.lead_id!));
    const requestLeads = new Set(inbound.filter((m) => kind(m) === "meeting_request").map((m) => m.lead_id!));
    const meet = meetings.filter((m) => m.campaign_id === c.id && m.status !== "canceled");
    const customers = (owned.get(c.id) ?? []).map((id) => wonById.get(id)).filter((l): l is NonNullable<typeof l> => {
      if (!l?.closed_at) return false;
      const f = first.get(l.id)!;
      const at = Date.parse(l.closed_at);
      return at >= f.at && at - f.at <= ATTRIBUTION_DAYS * DAY;
    });
    const revenueUsd = customers.reduce((s, l) => s + Number(l.deal_value ?? 0), 0);
    const found = c.source_campaign_id ? searches.find((s) => s.id === c.source_campaign_id)?.prospects_found ?? 0 : 0;
    const prospectsUsed = c.source_campaign_id ? ledger.filter((l) => l.campaign_id === c.source_campaign_id).reduce((s, l) => s + l.prospects, 0) : 0;
    const funnel: FunnelCounts = {
      contacted: contactedLeads.size, positive: positiveLeads.size, meetings: meet.length,
      held: meet.filter((m) => m.status === "completed").length, qualified: meet.filter((m) => m.qualified === true).length,
    };
    const towardTarget = meet.filter((m) => m.qualified !== false).length;

    // Shared learning for this campaign's industry and country, when it exists.
    const icp = parseIcp(strategies.find((s) => s.id === c.strategy_id)?.icp ?? null);
    const shared = sharedFor(learning, icp?.industries[0] ?? null, icp?.countries[0] ?? null, c.aim ?? "meeting");
    const prior = shared ? priorFrom({ n: shared.contacted, s: shared.meetings }) : null;

    // Days left and the campaign's real recent pace (people first contacted in the last 7 days).
    const end = c.ends_at ? Date.parse(c.ends_at) : now + 30 * DAY;
    const daysLeft = Math.max(0, Math.ceil((end - now) / DAY));
    const weekAgo = now - 7 * DAY;
    const recent = [...contactedLeads].filter((l) => (first.get(l)?.campaign === c.id ? first.get(l)!.at >= weekAgo : false)).length;
    const perDay = Math.min(recent / 7, c.daily_limit ?? Infinity);
    const active = c.status === "active" || c.status === "scheduled";

    return {
      id: c.id, name: c.name, status: c.status, aim: c.aim, approved: Boolean(c.approved_at), target: c.target_meetings,
      startsAt: c.starts_at ?? c.started_at, endsAt: c.ends_at, createdAt: c.created_at, failureReason: c.failure_reason,
      found, strongMatch: strong.filter((p) => p.campaign_id === c.source_campaign_id).length,
      contacted: funnel.contacted, sent: sent.length, bounced: sent.filter((m) => m.delivery_status === "bounced").length,
      positive: funnel.positive, requests: requestLeads.size, booked: funnel.meetings, held: funnel.held,
      noShow: meet.filter((m) => m.status === "no_show").length, qualified: funnel.qualified, towardTarget,
      customers: customers.length, revenueUsd, prospectsUsed,
      costs: roi({ spendUsd: prospectsUsed * rate, revenueUsd, prospects: prospectsUsed, positive: funnel.positive, meetings: funnel.meetings, qualified: funnel.qualified }),
      pace: pace({ target: c.target_meetings, meetings: towardTarget, contacted: funnel.contacted, startsAt: c.starts_at ?? c.started_at, endsAt: c.ends_at }),
      plan: c.target_meetings && active ? planGoal(c.target_meetings, { ...funnel, meetings: towardTarget }, daysLeft, prior) : null,
      forecast: active && daysLeft > 0 ? forecastMeetings({ ...funnel, meetings: towardTarget }, perDay * daysLeft, prior) : null,
      sharedWorkspaces: prior ? shared!.workspaces : 0,
    };
  });
}

/** What Yolias did lately, across campaigns or in one. */
export async function campaignActivity(workspaceId: string, campaignId?: string, limit = 12) {
  let q = createAdminClient().from("campaign_activity").select("id, campaign_id, kind, body, created_at, campaign:outreach_campaigns(name)")
    .eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(limit);
  if (campaignId) q = q.eq("campaign_id", campaignId);
  const { data } = await q;
  return (data ?? []).map((a) => ({ id: a.id, campaignId: a.campaign_id, kind: a.kind, body: a.body, at: a.created_at, campaign: (a.campaign as unknown as { name: string } | null)?.name ?? "" }));
}
