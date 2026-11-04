import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAutoReplyRow } from "@/lib/outreach/auto-reply";
import { addCounts, inRange, resultOf, zeroCounts, type Counts } from "@/lib/campaigns/metrics";
import { prospectRate, ATTRIBUTION_DAYS } from "@/services/campaign-metrics";
import type { AudienceGroupRow, OutreachCampaignRow } from "@/types/database";

// The Campaigns table (owner, 2026-10-31, D-272): every campaign and each of
// its audience groups with the counts the metric registry turns into columns,
// for a date range. Counted from real rows (messages, meetings, ledger), each
// person once per count. Called after requireViewer with the session's
// workspace (admin client, always filtered by it).

const DAY = 86_400_000;
const POSITIVE = new Set(["interested", "meeting_request"]);

/** D-273: one opening (first-email angle) of an audience, like an ad of an ad set. */
export interface OpeningLine { key: string; variant: "a" | "b"; text: string; counts: Counts }
export interface GroupLine {
  id: string; name: string; status: AudienceGroupRow["status"]; source: AudienceGroupRow["source"]; counts: Counts; openings: OpeningLine[];
  /** D-274: the optimizer's share of the budget (null = not set yet), whether it is learning, and its last reading. */
  share: number | null; learning: boolean; opt: { event: string | null; reason: string | null } | null;
}
export interface CampaignLine {
  id: string; name: string; status: OutreachCampaignRow["status"]; objective: OutreachCampaignRow["objective"]; channels: string[];
  ownerId: string | null; createdAt: string; startsAt: string | null; endsAt: string | null; budgetUsd: number | null; budgetType: OutreachCampaignRow["budget_type"];
  approved: boolean; countries: string[]; counts: Counts; groups: GroupLine[];
  /** D-273: the campaign's daily pace (new people a day) and its daily budget in USD, when it has one. */
  dailyLimit: number | null; dailyUsd: number | null;
}

type Msg = { outreach_campaign_id: string | null; enrollment_id: string | null; lead_id: string | null; direction: string; status: string; delivery_status: string | null; sent_at: string | null; received_at: string | null; created_at: string; analysis: unknown; step_position: number | null; variant: string | null; recipient_opened_at: string | null };

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

  const [msgs, enrollments, meetings, ledger, prospects, companies, visits, pixel, rate, clicks] = await Promise.all([
    paged<Msg>((a, b) => db.from("outreach_messages").select("outreach_campaign_id, enrollment_id, lead_id, direction, status, delivery_status, sent_at, received_at, created_at, analysis, step_position, variant, recipient_opened_at")
      .eq("workspace_id", workspaceId).not("lead_id", "is", null).order("created_at").range(a, b)),
    paged<{ id: string; campaign_id: string; lead_id: string; audience_group_id: string | null }>((a, b) => db.from("outreach_enrollments").select("id, campaign_id, lead_id, audience_group_id").in("campaign_id", ids).range(a, b)),
    paged<{ campaign_id: string | null; lead_id: string; status: string; qualified: boolean | null; starts_at: string; created_at: string; confirmed_at: string | null }>((a, b) => db.from("sales_meetings").select("campaign_id, lead_id, status, qualified, starts_at, created_at, confirmed_at").eq("workspace_id", workspaceId).in("campaign_id", ids).range(a, b)),
    searchIds.length ? paged<{ campaign_id: string | null; prospects: number; created_at: string }>((a, b) => db.from("usage_ledger").select("campaign_id, prospects, created_at").eq("workspace_id", workspaceId).eq("kind", "consume").in("campaign_id", searchIds).range(a, b)) : Promise.resolve([]),
    searchIds.length ? paged<{ campaign_id: string; created_at: string }>((a, b) => db.from("prospects").select("campaign_id, created_at").in("campaign_id", searchIds).range(a, b)) : Promise.resolve([]),
    // D-274: companies found too (a search may find companies and no people yet).
    searchIds.length ? paged<{ campaign_id: string | null; created_at: string }>((a, b) => db.from("companies").select("campaign_id, created_at").in("campaign_id", searchIds).range(a, b)) : Promise.resolve([]),
    paged<{ campaign_id: string | null; lead_id: string | null; started_at: string | null; meeting_id: string | null; created_at: string; updated_at: string }>((a, b) => db.from("booking_visits").select("campaign_id, lead_id, started_at, meeting_id, created_at, updated_at").eq("workspace_id", workspaceId).in("campaign_id", ids).range(a, b)),
    // D-274: pixel events credited to these campaigns.
    paged<{ campaign_id: string | null; group_id: string | null; lead_id: string | null; event: string; value: number | null; currency: string | null; visitor: string | null; created_at: string }>((a, b) => db.from("pixel_events").select("campaign_id, group_id, lead_id, event, value, currency, visitor, created_at").eq("workspace_id", workspaceId).in("campaign_id", ids).is("test_code", null).range(a, b)),
    prospectRate(workspaceId),
    paged<{ campaign_id: string | null; lead_id: string; first_click_at: string }>((a, b) => db.from("email_links").select("campaign_id, lead_id, first_click_at").in("campaign_id", ids).not("first_click_at", "is", null).range(a, b)),
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
  const sets = new Map<string, Record<"contacted" | "replies" | "interested" | "requests" | "opened" | "qualified", Set<string>>>();
  const nums = new Map<string, Counts>();
  // D-273: which opening each person got first (their first email's variant), per campaign.
  const openingOf = new Map<string, string>();
  for (const m of msgs) {
    if (m.direction !== "outbound" || m.status !== "sent" || m.step_position !== 1 || !m.lead_id || !m.outreach_campaign_id) continue;
    const g = m.enrollment_id ? groupOfEnrollment.get(m.enrollment_id) : groupOfLead.get(`${m.outreach_campaign_id}:${m.lead_id}`);
    if (g) openingOf.set(`${m.outreach_campaign_id}:${m.lead_id}`, `v:${g}:${m.variant === "b" ? "b" : "a"}`);
  }
  const keysFor = (campaign: string, group: string | null | undefined, lead?: string | null) => {
    const v = lead ? openingOf.get(`${campaign}:${lead}`) : undefined;
    return [`c:${campaign}`, ...(group ? [`g:${group}`] : []), ...(v ? [v] : [])];
  };
  const bucket = (k: string) => {
    if (!sets.has(k)) { sets.set(k, { contacted: new Set(), replies: new Set(), interested: new Set(), requests: new Set(), opened: new Set(), qualified: new Set() }); nums.set(k, zeroCounts()); }
    return { s: sets.get(k)!, n: nums.get(k)! };
  };
  for (const m of msgs) {
    if (!m.outreach_campaign_id || !m.lead_id || !ids.includes(m.outreach_campaign_id)) continue;
    const g = m.enrollment_id ? groupOfEnrollment.get(m.enrollment_id) : groupOfLead.get(`${m.outreach_campaign_id}:${m.lead_id}`);
    for (const k of keysFor(m.outreach_campaign_id, g, m.lead_id)) {
      const { s, n } = bucket(k);
      if (m.direction === "outbound" && m.status === "sent" && inRange(m.sent_at, range)) {
        n.sent++; if (m.delivery_status === "bounced") n.bounced++; else n.delivered++;
        s.contacted.add(m.lead_id);
      }
      if (m.direction === "outbound" && m.recipient_opened_at && inRange(m.recipient_opened_at, range)) s.opened.add(m.lead_id);
      if (m.direction === "inbound" && inRange(m.received_at ?? m.created_at, range) && !isAutoReplyRow(m as never)) {
        s.replies.add(m.lead_id);
        const kind = (m.analysis as { kind?: string } | null)?.kind ?? "";
        if (POSITIVE.has(kind)) { s.interested.add(m.lead_id); s.qualified.add(m.lead_id); }
        if (kind === "meeting_request") s.requests.add(m.lead_id);
      }
    }
  }
  for (const mt of meetings) {
    if (!mt.campaign_id) continue;
    for (const k of keysFor(mt.campaign_id, groupOfLead.get(`${mt.campaign_id}:${mt.lead_id}`), mt.lead_id)) {
      const { n } = bucket(k);
      if (mt.status === "canceled") { if (inRange(mt.created_at, range)) n.canceled++; continue; }
      if (inRange(mt.created_at, range)) { n.meetings++; sets.get(k)?.qualified.add(mt.lead_id); }
      if (mt.confirmed_at && inRange(mt.created_at, range)) n.confirmed++;
      if (mt.status === "completed" && inRange(mt.starts_at, range)) n.held++;
      if (mt.qualified === true && inRange(mt.starts_at, range)) n.qualified++;
    }
  }
  for (const l of won) {
    const f = first.get(l.id);
    if (!f || !l.closed_at || !ids.includes(f.campaign)) continue;
    const at = Date.parse(l.closed_at);
    if (at < f.at || at - f.at > ATTRIBUTION_DAYS * DAY || !inRange(l.closed_at, range)) continue;
    for (const k of keysFor(f.campaign, f.group, l.id)) { const { n } = bucket(k); n.customers++; n.revenueUsd += Number(l.deal_value ?? 0); }
  }
  // Searches: people found and prospects used, to the group that owns the search (else the campaign).
  const searchOwner = new Map<string, { campaign: string; group: string | null }>();
  for (const c of camps) if (c.source_campaign_id) searchOwner.set(c.source_campaign_id, { campaign: c.id, group: null });
  for (const g of groups) if (g.search_campaign_id) searchOwner.set(g.search_campaign_id, { campaign: g.campaign_id, group: g.id });
  for (const p of prospects) {
    const o = searchOwner.get(p.campaign_id);
    if (o && inRange(p.created_at, range)) for (const k of keysFor(o.campaign, o.group)) { const { n } = bucket(k); n.found++; n.foundPeople++; }
  }
  for (const co of companies) {
    const o = co.campaign_id ? searchOwner.get(co.campaign_id) : null;
    if (o && inRange(co.created_at, range)) for (const k of keysFor(o.campaign, o.group)) { const { n } = bucket(k); n.found++; n.foundCompanies++; }
  }
  // D-274: the booking link's visits from the campaign's emails (each visit row is one visitor's visit).
  const ABANDON_MS = 30 * 60_000;
  for (const v of visits) {
    if (!v.campaign_id || !inRange(v.created_at, range)) continue;
    for (const k of keysFor(v.campaign_id, v.lead_id ? groupOfLead.get(`${v.campaign_id}:${v.lead_id}`) : null, v.lead_id)) {
      const { n } = bucket(k);
      n.visits++;
      if (v.meeting_id) n.linkBooked++;
      else if (v.started_at && Date.now() - Date.parse(v.updated_at) > ABANDON_MS) n.abandoned++;
    }
  }
  // Owner, 2026-11-05: each person once per campaign, on their first click.
  const clicked = new Set<string>();
  for (const c of clicks) {
    if (!c.campaign_id || !inRange(c.first_click_at, range) || clicked.has(`${c.campaign_id}:${c.lead_id}`)) continue;
    clicked.add(`${c.campaign_id}:${c.lead_id}`);
    for (const k of keysFor(c.campaign_id, groupOfLead.get(`${c.campaign_id}:${c.lead_id}`) ?? null, c.lead_id)) bucket(k).n.linkClicks++;
  }
  for (const u of ledger) {
    const o = u.campaign_id ? searchOwner.get(u.campaign_id) : null;
    if (o && inRange(u.created_at, range)) for (const k of keysFor(o.campaign, o.group)) { const { n } = bucket(k); n.prospectsUsed += u.prospects; n.spendUsd += u.prospects * rate; }
  }
  // Pixel events: visits are people (each once), the others are events; purchase value in USD.
  const visitors = new Map<string, Set<string>>();
  // Each website campaign counts its own conversion event (Purchase / Lead by default), like an ads platform's optimization event.
  const conversionOf = new Map(camps.map((c) => [c.id, c.conversion_event ?? (c.objective === "purchases" ? "Purchase" : c.objective === "form_leads" ? "Lead" : null)]));
  for (const e of pixel) {
    if (!e.campaign_id || !inRange(e.created_at, range)) continue;
    for (const k of keysFor(e.campaign_id, e.group_id, e.lead_id)) {
      const { n } = bucket(k);
      if (e.event === "PageView") { const set = visitors.get(k) ?? new Set<string>(); set.add(e.lead_id ?? e.visitor ?? ""); visitors.set(k, set); }
      else if (e.event === "InitiateCheckout") n.checkouts++;
      else if (e.event === "Purchase") { n.purchases++; if (e.value != null && (!e.currency || e.currency === "USD")) n.purchaseValue += Number(e.value); }
      else if (e.event === "Lead" || e.event === "CompleteRegistration") { n.formLeads++; if (e.event === "CompleteRegistration") n.signups++; }
      else if (e.event === "Activated") n.activated++;
      if (conversionOf.get(e.campaign_id) === e.event) { n.conversions++; if (e.value != null && (!e.currency || e.currency === "USD")) n.conversionValue += Number(e.value); }
    }
  }
  for (const [k, set] of visitors) bucket(k).n.siteVisits = set.size;
  const counts = (k: string): Counts => {
    const b = sets.get(k), n = nums.get(k) ?? zeroCounts();
    return b ? { ...n, contacted: b.contacted.size, replies: b.replies.size, interested: b.interested.size, meetingRequests: b.requests.size, opened: b.opened.size, qualifiedLeads: b.qualified.size } : n;
  };

  // The objective's result on every line of the campaign (campaign, audiences, openings).
  const withResult = (objective: string | null | undefined, x: Counts): Counts => ({ ...x, results: resultOf(objective, x) });
  return camps.map((c) => {
    const mine = groups.filter((g) => g.campaign_id === c.id);
    const countries = [...new Set(mine.flatMap((g) => ((g.targeting as { countries?: { include?: string[] } } | null)?.countries?.include ?? [])))];
    return {
      id: c.id, name: c.name, status: c.status, objective: c.objective ?? "meetings", channels: c.channels?.length ? c.channels : ["email"], ownerId: c.owner_id ?? c.created_by,
      createdAt: c.created_at, startsAt: c.starts_at, endsAt: c.ends_at, budgetUsd: c.budget_usd == null ? null : Number(c.budget_usd), budgetType: c.budget_type, approved: Boolean(c.approved_at),
      countries, counts: withResult(c.objective, counts(`c:${c.id}`)), dailyLimit: c.daily_limit, dailyUsd: c.budget_type === "daily" && c.budget_usd != null ? Number(c.budget_usd) : null,
      groups: mine.map((g) => ({
        id: g.id, name: g.name, status: g.status, source: g.source, counts: withResult(c.objective, counts(`g:${g.id}`)),
        share: g.budget_share == null ? null : Number(g.budget_share), learning: g.learning ?? true,
        opt: (g.opt_state as { event?: string | null; reason?: string | null } | null)?.reason ? { event: (g.opt_state as { event?: string | null }).event ?? null, reason: (g.opt_state as { reason?: string }).reason ?? null } : null,
        openings: (["a", "b"] as const).filter((v) => (v === "a" ? g.angle_a ?? c.goal : g.angle_b)).map((v) => ({ key: `${g.id}:${v}`, variant: v, text: (v === "a" ? g.angle_a ?? c.goal : g.angle_b) ?? "", counts: withResult(c.objective, counts(`v:${g.id}:${v}`)) })),
      })),
    };
  });
}

/** The account's totals (the dashboard), from the same lines. */
export const totalCounts = (lines: CampaignLine[]): Counts => lines.reduce((s, l) => addCounts(s, l.counts), zeroCounts());
