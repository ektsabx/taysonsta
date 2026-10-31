import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { memberMailboxes } from "@/lib/mailbox";
import { loadAiSettings } from "@/lib/ai-workspace/server";
import { timeZoneChoices, timeZoneLabel } from "@/lib/regions";
import { RANGE_PRESETS, rangeBounds, type RangePreset } from "@/lib/campaigns/metrics";
import { campaignTable } from "@/services/campaign-table";
import { campaignActivity, campaignMetrics, prospectRate } from "@/services/campaign-metrics";
import { campaignDetail } from "@/services/campaign-detail";
import { campaignWorkspace, launchSummary } from "@/services/outreach-campaigns";
import { CampaignPage, type CampaignTab, type GroupInfo } from "@/components/app/campaigns/CampaignPage";
import type { Targeting } from "@/lib/campaigns/targeting";
import type { OutreachCampaignRow } from "@/types/database";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).camp.manager.title} | Yolias` };
}

/** The period of the same length just before (for "vs the previous period"), or null for all time. */
function previous(b: { from: string | null; to: string | null }): { from: string; to: string } | null {
  if (!b.from) return null;
  const f = Date.parse(b.from), t = b.to ? Date.parse(b.to) : Date.now();
  return { from: new Date(f - (t - f)).toISOString(), to: b.from };
}

const TABS = ["overview", "groups", "sequences", "messages", "prospects", "conversations", "meetings", "performance", "settings"];

/** A local date and time of an instant in a zone, for the settings form. */
function local(iso: string | null, tz: string): { date: string; time: string } {
  if (!iso) return { date: "", time: "09:00" };
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const g = (k: string) => p.find((x) => x.type === k)?.value ?? "";
  return { date: `${g("year")}-${g("month")}-${g("day")}`, time: `${g("hour")}:${g("minute")}` };
}

// A campaign's page (owner, 2026-10-31, D-272): header, the one approval, and nine tabs.
export default async function CampaignRoute({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const session = await requireViewer();
  const ws = session.workspace.id;
  const db = await createClient();
  const { data: row } = await db.from("outreach_campaigns").select("*").eq("id", id).eq("workspace_id", ws).maybeSingle();
  if (!row) notFound();
  const c = row as OutreachCampaignRow;
  // A draft still in the wizard opens there.
  const tab = (TABS.includes(one("tab")) ? one("tab") : "overview") as CampaignTab;
  const range = (RANGE_PRESETS as string[]).includes(one("range")) ? (one("range") as RangePreset) : "lifetime";
  const bounds = rangeBounds(range, new Date(), { from: one("from"), to: one("to") });
  const prevBounds = previous(bounds);
  const [t, locale, lines, prevLines, engine, activity, detail, launch, work, boxes, settings, rate, { data: groups }, { data: steps }, { data: people }] = await Promise.all([
    getDictionary(), getLocale(),
    campaignTable(ws, bounds, { ids: [id], includeArchived: true }),
    prevBounds ? campaignTable(ws, prevBounds, { ids: [id], includeArchived: true }) : Promise.resolve([]),
    campaignMetrics(ws, { ids: [id], includeArchived: true }), campaignActivity(ws, id, 15),
    campaignDetail(ws, id, bounds), launchSummary(ws, id), campaignWorkspace(ws, id),
    memberMailboxes(ws, session.userId), loadAiSettings(ws), prospectRate(ws),
    db.from("audience_groups").select("*").eq("campaign_id", id).order("created_at"),
    db.from("outreach_steps").select("audience_group_id, position, delay_days, objective, instruction").eq("campaign_id", id).order("position"),
    createAdminClient().from("profiles").select("id, full_name, email").eq("workspace_id", ws),
  ]);
  const line = lines[0];
  if (!line || !launch) notFound();
  const d = t.camp.detail.rec;
  // Recommendations, from the numbers only (D-272).
  const recs: string[] = [];
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const rated = line.groups.filter((g) => g.counts.contacted >= 30).map((g) => ({ g, rate: g.counts.interested / g.counts.contacted }));
  if (rated.length >= 2) {
    const best = rated.reduce((a, b) => (b.rate > a.rate ? b : a));
    for (const r of rated) if (r !== best && best.rate > 0 && r.rate < best.rate / 2) recs.push(fmt(d.weakGroup, { name: r.g.name, rate: pct(r.rate), best: pct(best.rate), bestName: best.g.name }));
  }
  const va = detail.breakdowns.variant.find((x) => x.key === "A"), vb = detail.breakdowns.variant.find((x) => x.key === "B");
  if (va && vb && va.contacted >= 20 && vb.contacted >= 20 && (va.interested || vb.interested)) {
    const ra = va.interested / va.contacted, rb = vb.interested / vb.contacted;
    if (Math.max(ra, rb) >= 1.5 * Math.max(Math.min(ra, rb), 0.0001)) recs.push(fmt(d.angleWins, { name: c.name, winner: ra > rb ? "A" : "B", a: pct(Math.max(ra, rb)), b: pct(Math.min(ra, rb)) }));
  }
  if (line.counts.sent >= 20 && line.counts.bounced / line.counts.sent > 0.03) recs.push(fmt(d.bounces, { pct: pct(line.counts.bounced / line.counts.sent) }));
  if (line.counts.contacted >= 50 && line.counts.replies === 0) recs.push(fmt(d.noReplies, { n: String(line.counts.contacted) }));

  const tz = c.timezone ?? session.profile.timezone ?? "UTC";
  const start = local(c.starts_at, tz), end = local(c.ends_at, tz);
  const groupInfo: GroupInfo[] = (groups ?? []).map((g) => ({
    id: g.id, name: g.name, status: g.status, source: g.source, targeting: g.targeting as Targeting, angleA: g.angle_a ?? "", angleB: g.angle_b ?? "",
    steps: (steps ?? []).filter((s) => s.audience_group_id === g.id).map((s) => ({ delayDays: s.delay_days, objective: s.objective === "introduction" ? "introduction" as const : "follow_up" as const, instruction: s.instruction ?? "" })),
  }));
  const connected = boxes.filter((m) => m.status === "connected").map((m) => ({ id: m.id, email: m.email, provider: m.provider }));
  const toWrite = work.leads.filter((l) => l.status === "active" && l.step === 0 && !l.message).length;
  return (
    <CampaignPage
      tab={tab} range={range} from={one("from")} to={one("to")} line={line} prev={prevLines[0]?.counts ?? null} engine={engine[0] ?? null} recommendations={recs}
      c={{
        id: c.id, name: c.name, status: c.status, objective: c.objective ?? "meetings", description: c.description ?? "", ctaUrl: c.cta_url ?? "", channels: c.channels?.length ? c.channels : ["email"],
        budgetUsd: c.budget_usd == null ? null : Number(c.budget_usd), budgetType: c.budget_type, startDate: start.date, startTime: start.time, endDate: end.date, endTime: end.time,
        timezone: tz, runDays: c.run_days ?? [], contactFrom: (c.contact_from ?? "09:00").slice(0, 5), contactTo: (c.contact_to ?? "17:00").slice(0, 5),
        dailyLimit: c.daily_limit ?? 30, targetMeetings: c.target_meetings ?? 0, ownerId: c.owner_id ?? c.created_by, approved: Boolean(c.approved_at), createdAt: c.created_at,
      }}
      groups={groupInfo} detail={detail} activity={activity}
      launch={launch} mailboxes={connected} mailboxName={boxes.find((m) => m.id === c.mailbox_id)?.email ?? null} workspaceDailyLimit={settings.limits.daily_send_limit}
      toWrite={toWrite} totalLeads={work.leads.length}
      members={(people ?? []).map((p) => ({ id: p.id, name: p.full_name || p.email || "" }))}
      zones={timeZoneChoices(tz).map((z) => ({ value: z, label: timeZoneLabel(z, locale) }))} rate={rate} timeZone={session.profile.timezone ?? null}
    />
  );
}
