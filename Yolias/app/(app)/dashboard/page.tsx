import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/server";
import { canManageTeam, requireViewer } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayFor } from "@/services/today";
import { dashboardData, type DashRange } from "@/services/dashboard";
import { startSteps } from "@/services/start-here";
import { Dashboard } from "@/components/app/campaigns/Dashboard";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).nav.dashboard} | Yolias` };
}

/** An ISO time relative to now (outside render, for the lint rule on impure calls). */
function isoFromNow(ms: number) { return new Date(Date.now() + ms).toISOString(); }

// The dashboard (owner, 2026-10-31, D-273): the account's home, after the
// reference the owner chose. ?range=30d|90d and ?campaign=<id> set the
// performance section; everything is counted on the server from real rows.
export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const session = await requireViewer();
  const ws = session.workspace.id;
  const sp = await searchParams;
  const range: DashRange = sp.range === "30d" || sp.range === "90d" ? sp.range : "7d";
  const campaignId = typeof sp.campaign === "string" && /^[0-9a-f-]{36}$/i.test(sp.campaign) ? sp.campaign : null;
  const admin = createAdminClient();
  const [data, steps, today, outcomes, paused] = await Promise.all([
    dashboardData(ws, range, campaignId), startSteps(ws, session.userId), todayFor(ws, session.profile.timezone ?? null),
    admin.from("sales_meetings").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("status", "scheduled").lt("starts_at", isoFromNow(-3_600_000)),
    admin.from("outreach_campaigns").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("status", "paused").not("failure_reason", "is", null),
  ]);
  return (
    <div className="page-view">
      <div className="view-content-padding db-page">
        <Dashboard
          name={session.workspace.name || session.profile.full_name || "Yolias"} data={data} range={range} campaignId={campaignId} steps={steps} canBudget={canManageTeam(session)}
          needs={{ replies: today.replies, today: today.meetings.length, outcomes: outcomes.count ?? 0, paused: paused.count ?? 0, tryAgain: today.reengage }}
        />
      </div>
    </div>
  );
}
