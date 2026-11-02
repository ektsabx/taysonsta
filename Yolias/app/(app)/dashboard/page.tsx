import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/server";
import { requireViewer } from "@/lib/session";
import { dashboardData, type DashRange } from "@/services/dashboard";
import { startSteps } from "@/services/start-here";
import { Dashboard } from "@/components/app/campaigns/Dashboard";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).nav.dashboard} | Yolias` };
}

// The dashboard (owner, 2026-10-31, D-273; D-274): the account's home, after
// the reference the owner chose. ?range=30d|90d and ?campaign=<id> set the
// performance section; everything is counted on the server from real rows.
export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const session = await requireViewer();
  const ws = session.workspace.id;
  const sp = await searchParams;
  const range: DashRange = sp.range === "30d" || sp.range === "90d" ? sp.range : "7d";
  const campaignId = typeof sp.campaign === "string" && /^[0-9a-f-]{36}$/i.test(sp.campaign) ? sp.campaign : null;
  const [data, steps] = await Promise.all([dashboardData(ws, range, campaignId), startSteps(ws, session.userId)]);
  return (
    <div className="page-view">
      <div className="view-content-padding db-page">
        <Dashboard name={(session.profile.full_name ?? "").trim().split(/\s+/)[0] || null} data={data} range={range} campaignId={campaignId} steps={steps} />
      </div>
    </div>
  );
}
