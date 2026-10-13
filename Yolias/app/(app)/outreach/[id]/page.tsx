import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { getOutreachCampaign, outreachOptions } from "@/services/outreach-campaigns";
import { loadAiSettings } from "@/lib/ai-workspace/server";
import { CampaignDetailView } from "@/components/app/ws/CampaignDetail";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).ws.outreach.title} — Yolias` };
}

export default async function OutreachCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [detail, options, settings] = await Promise.all([getOutreachCampaign(session.workspace.id, id), outreachOptions(session.workspace.id), loadAiSettings(session.workspace.id)]);
  if (!detail) notFound();
  // CRM leads that can still be added (not in this campaign yet).
  const enrolled = new Set(detail.enrollments.map((e) => e.lead_id));
  const { data: leads } = await (await createClient()).from("sales_leads").select("id, name, company_name, stage, do_not_contact")
    .eq("workspace_id", session.workspace.id).order("last_activity_at", { ascending: false }).limit(500);
  return (
    <CampaignDetailView
      detail={detail}
      options={options}
      maxSteps={settings.limits.max_messages_per_lead}
      candidates={(leads ?? []).filter((l) => !enrolled.has(l.id))}
      timeZone={session.profile.timezone}
    />
  );
}
