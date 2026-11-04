import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { RANGE_PRESETS, rangeBounds, type RangePreset } from "@/lib/campaigns/metrics";
import { campaignTable } from "@/services/campaign-table";
import { campaignActivity } from "@/services/campaign-metrics";
import { campaignDetail } from "@/services/campaign-detail";
import { learnedFacts, type Insights } from "@/lib/agent-core/learning";
import { CampaignPage, type CampaignTab } from "@/components/app/campaigns/CampaignPage";
import type { OutreachCampaignRow } from "@/types/database";

export async function generateMetadata({ params }: PageProps<"/campaigns/[id]">): Promise<Metadata> {
  const { id } = await params;
  const t = await getDictionary();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { title: `${t.ag.manager.title} | Yolias` };
  const { data } = await (await createClient()).from("outreach_campaigns").select("name").eq("id", id).maybeSingle();
  return { title: `${data?.name ?? t.ag.manager.title} | Yolias` };
}

/** The period of the same length just before (for "vs the previous period"), or null for all time. */
function previous(b: { from: string | null; to: string | null }): { from: string; to: string } | null {
  if (!b.from) return null;
  const f = Date.parse(b.from), t = b.to ? Date.parse(b.to) : Date.now();
  return { from: new Date(f - (t - f)).toISOString(), to: b.from };
}

const TABS: CampaignTab[] = ["activity", "conversations", "meetings", "settings"];

// A campaign's page (owner, 2026-10-31, D-273), like a campaign in an ads manager (D-274).
export default async function CampaignRoute({ params, searchParams }: PageProps<"/campaigns/[id]">) {
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
  const tab = (TABS.includes(one("tab") as CampaignTab) ? one("tab") : "activity") as CampaignTab;
  const range = (RANGE_PRESETS as string[]).includes(one("range")) ? (one("range") as RangePreset) : "lifetime";
  const bounds = rangeBounds(range, new Date(), { from: one("from"), to: one("to") });
  const prevBounds = previous(bounds);
  const [t, lines, prevLines, activity, detail, { data: mb }, { data: custom }, { data: ins }] = await Promise.all([
    getDictionary(),
    campaignTable(ws, bounds, { ids: [id], includeArchived: true }),
    prevBounds ? campaignTable(ws, prevBounds, { ids: [id], includeArchived: true }) : Promise.resolve([]),
    campaignActivity(ws, id, 20),
    campaignDetail(ws, id, bounds),
    c.mailbox_id ? createAdminClient().from("mailboxes").select("email").eq("id", c.mailbox_id).maybeSingle() : Promise.resolve({ data: null }),
    createAdminClient().from("custom_metrics").select("id, name, a, op, b, format").eq("workspace_id", ws).order("created_at"),
    createAdminClient().from("campaign_insights").select("data").eq("campaign_id", id).eq("workspace_id", ws).maybeSingle(),
  ]);
  // D-275: what this campaign's results taught Yolias (lib/agent-core/learning.ts).
  const learned = learnedFacts((ins?.data as unknown as Insights | null) ?? null);
  const line = lines[0];
  if (!line) notFound();

  // Recommendations, from the numbers only.
  const d = t.ag.page.rec;
  const recs: string[] = [];
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const rated = line.groups.filter((g) => g.counts.contacted >= 30).map((g) => ({ g, rate: g.counts.interested / g.counts.contacted }));
  if (rated.length >= 2) {
    const best = rated.reduce((a, b) => (b.rate > a.rate ? b : a));
    for (const r of rated) if (r !== best && best.rate > 0 && r.rate < best.rate / 2) recs.push(fmt(d.weakGroup, { name: r.g.name, rate: pct(r.rate), best: pct(best.rate), bestName: best.g.name }));
  }
  for (const g of line.groups) {
    const [a, b] = g.openings;
    if (!a || !b || a.counts.contacted < 20 || b.counts.contacted < 20 || !(a.counts.interested || b.counts.interested)) continue;
    const ra = a.counts.interested / a.counts.contacted, rb = b.counts.interested / b.counts.contacted;
    if (Math.max(ra, rb) >= 1.5 * Math.max(Math.min(ra, rb), 0.0001)) recs.push(fmt(d.angleWins, { name: g.name, winner: ra > rb ? "A" : "B", a: pct(Math.max(ra, rb)), b: pct(Math.min(ra, rb)) }));
  }
  if (line.counts.sent >= 20 && line.counts.bounced / line.counts.sent > 0.03) recs.push(fmt(d.bounces, { pct: pct(line.counts.bounced / line.counts.sent) }));
  if (line.counts.contacted >= 50 && line.counts.replies === 0) recs.push(fmt(d.noReplies, { n: String(line.counts.contacted) }));

  return (
    <CampaignPage
      custom={(custom ?? []) as never} tab={tab} range={range} from={one("from")} to={one("to")} refreshedAt={new Date().toISOString()} line={line} prev={prevLines[0]?.counts ?? null} detail={detail} activity={activity} recommendations={recs} learned={learned}
      c={{
        id: c.id, name: c.name, status: c.status, budgetUsd: c.budget_usd == null ? null : Number(c.budget_usd), budgetType: c.budget_type,
        startsAt: c.starts_at ?? c.started_at, endsAt: c.ends_at, mailbox: mb?.email ?? null, targetMeetings: c.target_meetings, dailyLimit: c.daily_limit,
        runDays: c.run_days ?? [], contactFrom: c.contact_from, contactTo: c.contact_to, tone: c.tone, language: c.language, instructions: c.instructions, senderName: c.sender_name,
        approved: Boolean(c.approved_at),
        costCapUsd: c.cost_cap_usd == null ? null : Number(c.cost_cap_usd), trackOpens: c.track_opens !== false, objective: c.objective ?? "meetings",
        optimizingFor: (line.groups.map((g) => g.opt?.event).find(Boolean)) ?? null,
      }}
    />
  );
}
