import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireViewer } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { outreachOptions } from "@/services/outreach-campaigns";
import { loadAiSettings } from "@/lib/ai-workspace/server";
import { CampaignForm } from "@/components/app/ws/CampaignForm";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).ws.outreach.newCampaign} | Yolias` };
}

export default async function NewOutreachPage({ searchParams }: PageProps<"/outreach/new">) {
  const session = await requireViewer();
  const [t, options, settings, { data: searches }] = await Promise.all([getDictionary(), outreachOptions(session.workspace.id), loadAiSettings(session.workspace.id),
    // Search (discovery) campaigns to start from (owner brief 2026-10-19).
    (await createClient()).from("campaigns").select("id, name").eq("workspace_id", session.workspace.id).order("created_at", { ascending: false }).limit(100)]);
  const { from } = await searchParams;
  const lang = session.profile.language === "ar" ? "ar" : "en";
  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <Link className="detail-back" href="/conversations?tab=campaigns"><ArrowLeft className="flip-rtl" /> {t.ws.outreach.title}</Link>
          <h2>{t.ws.outreach.newCampaign}</h2>
        </div>
      </header>
      <div className="view-content-padding">
        <CampaignForm profiles={options.profiles} offers={options.offers} maxSteps={settings.limits.max_messages_per_lead} searchCampaigns={searches ?? []}
          initial={{ name: "", goal: "", description: "", channel: "email", language: lang, tone: "direct", customer_profile_id: null, offer_id: null, source_campaign_id: typeof from === "string" && (searches ?? []).some((s) => s.id === from) ? from : null,
            steps: [{ delay_days: 0, objective: "introduction", instruction: "" }, { delay_days: 3, objective: "follow_up", instruction: "" }] }} />
      </div>
    </div>
  );
}
