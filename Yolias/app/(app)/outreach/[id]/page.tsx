import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { campaignWorkspace, getOutreachCampaign, launchSummary, outreachOptions } from "@/services/outreach-campaigns";
import { memberMailboxes } from "@/lib/mailbox";
import { loadAiSettings } from "@/lib/ai-workspace/server";
import { CampaignWorkspaceView } from "@/components/app/ws/CampaignWorkspace";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).ws.outreach.title} — Yolias` };
}

export default async function OutreachCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireViewer();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [detail, options, settings, launch, boxes, work] = await Promise.all([getOutreachCampaign(session.workspace.id, id), outreachOptions(session.workspace.id), loadAiSettings(session.workspace.id), launchSummary(session.workspace.id, id), memberMailboxes(session.workspace.id, session.userId), campaignWorkspace(session.workspace.id, id)]);
  if (!detail || !launch) notFound();
  const connected = boxes.filter((m) => m.status === "connected");
  const sendingFrom = launch.campaign.mailbox_id ? boxes.find((m) => m.id === launch.campaign.mailbox_id)?.email ?? null : null;
  // CRM leads that can still be added (not in this campaign yet).
  const enrolled = new Set(detail.enrollments.map((e) => e.lead_id));
  const { data: leads } = await (await createClient()).from("sales_leads").select("id, name, company_name, stage, do_not_contact")
    .eq("workspace_id", session.workspace.id).order("last_activity_at", { ascending: false }).limit(500);
  return (
    <CampaignWorkspaceView
      detail={detail}
      work={work}
      options={options}
      maxSteps={settings.limits.max_messages_per_lead}
      candidates={(leads ?? []).filter((l) => !enrolled.has(l.id))}
      timeZone={session.profile.timezone}
      launch={launch}
      mailboxes={connected.map((m) => ({ id: m.id, email: m.email, provider: m.provider }))}
      mailboxName={sendingFrom}
      dailyLimit={Math.min(settings.limits.daily_send_limit, connected[0]?.daily_limit ?? settings.limits.daily_send_limit)}
    />
  );
}
