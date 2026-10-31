import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { requireViewer } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayFor } from "@/services/today";
import { campaignActivity, campaignMetrics, prospectRate } from "@/services/campaign-metrics";
import { CampaignDashboard } from "@/components/app/campaigns/CampaignDashboard";
import { StartHere } from "@/components/app/StartHere";
import { startSteps } from "@/services/start-here";
import { tabCounts } from "@/services/prospects";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).camp.dash.title} | Yolias` };
}

/** An ISO time relative to now (outside render, for the lint rule on impure calls). */
function isoFromNow(ms: number) { return new Date(Date.now() + ms).toISOString(); }

// The dashboard (owner, 2026-10-31, D-270 / D-271): the account's home, one
// design only. Start here while it isn't done, then the campaigns: results
// (actual), what needs the member, Yolias's notes, progress to each target
// (actual vs forecast vs target), the comparison and what Yolias did. The old
// analytics overview (Today card, section cards, charts) was removed.
export default async function DashboardPage() {
  const session = await requireViewer();
  const ws = session.workspace.id;
  const admin = createAdminClient();
  const [t, today, metrics, activity, rate, steps, found, approvals, outcomes] = await Promise.all([
    getDictionary(), todayFor(ws, session.profile.timezone ?? null),
    campaignMetrics(ws), campaignActivity(ws), prospectRate(ws), startSteps(ws, session.userId), tabCounts(ws),
    admin.from("agent_pending_actions").select("input").eq("workspace_id", ws).eq("tool", "startOutreachCampaign").eq("status", "pending").gt("expires_at", isoFromNow(0)),
    admin.from("sales_meetings").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("status", "scheduled").lt("starts_at", isoFromNow(-3_600_000)),
  ]);
  const waiting = [...new Set((approvals.data ?? []).map((a) => (a.input as { id?: string } | null)?.id).filter((x): x is string => Boolean(x)))];
  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group"><h2>{t.camp.dash.title}</h2></div>
        <div className="view-actions"><Link className="sdr-btn primary" href="/outreach/new"><Plus />{t.camp.dash.newCampaign}</Link></div>
      </header>
      <div className="view-content-padding analytics-page">
        <StartHere steps={steps} />
        <CampaignDashboard
          found={found.companies + found.people} metrics={metrics} activity={activity} rate={rate} waiting={waiting}
          outcomesWaiting={outcomes.count ?? 0} repliesWaiting={today.replies} meetingsToday={today.meetings.length} tryAgain={today.reengage}
        />
      </div>
    </div>
  );
}
