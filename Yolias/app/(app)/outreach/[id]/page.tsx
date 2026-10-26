import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { memberMailboxes } from "@/lib/mailbox";
import { loadAiSettings } from "@/lib/ai-workspace/server";
import { campaignPage } from "@/services/campaigns";
import { campaignWorkspace, getOutreachCampaign, launchSummary, outreachOptions } from "@/services/outreach-campaigns";
import { CampaignDetail, type CampaignTab } from "@/components/app/campaigns/CampaignDetail";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).sdr.campaigns.title} | Yolias` };
}

// A campaign's own page again (D-256, after AgentSDR): Analytics, Leads and
// Sequence, with the approval panel while it's a draft.
export default async function CampaignPageRoute({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const session = await requireViewer();
  const ws = session.workspace.id;
  const tz = session.profile.timezone ?? null;
  const [page, detail, launch, options, work, boxes, settings, leads] = await Promise.all([
    campaignPage(ws, id, tz), getOutreachCampaign(ws, id), launchSummary(ws, id), outreachOptions(ws), campaignWorkspace(ws, id),
    memberMailboxes(ws, session.userId), loadAiSettings(ws),
    (await createClient()).from("sales_leads").select("id, name, company_name, stage, do_not_contact").eq("workspace_id", ws).order("last_activity_at", { ascending: false }).limit(500),
  ]);
  if (!page || !detail || !launch) notFound();
  // Old links: ?view=emails / ?view=sequence (one place per campaign, D-254).
  const asked = one(sp.tab) || (one(sp.view) === "emails" ? "leads" : one(sp.view));
  const tab: CampaignTab = asked === "leads" || asked === "sequence" ? asked : "analytics";
  const connected = boxes.filter((m) => m.status === "connected").map((m) => ({ id: m.id, email: m.email, provider: m.provider }));
  return (
    <CampaignDetail
      page={page} detail={detail} work={work} launch={launch} options={options} maxSteps={settings.limits.max_messages_per_lead}
      candidates={leads.data ?? []} mailboxes={connected} mailboxName={boxes.find((m) => m.id === page.campaign.mailbox_id)?.email ?? null}
      dailyLimit={settings.limits.daily_send_limit} tab={tab} timeZone={tz}
    />
  );
}
