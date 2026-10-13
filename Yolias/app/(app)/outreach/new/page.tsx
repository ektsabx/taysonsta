import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { outreachOptions } from "@/services/outreach-campaigns";
import { loadAiSettings } from "@/lib/ai-workspace/server";
import { CampaignForm } from "@/components/app/ws/CampaignForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).ws.outreach.newCampaign} — Yolias` };
}

export default async function NewOutreachPage() {
  const session = await requireSession();
  const [t, options, settings] = await Promise.all([getDictionary(), outreachOptions(session.workspace.id), loadAiSettings(session.workspace.id)]);
  const lang = session.profile.language === "ar" ? "ar" : "en";
  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <Link className="detail-back" href="/outreach"><ArrowLeft className="flip-rtl" /> {t.ws.outreach.title}</Link>
          <h2>{t.ws.outreach.newCampaign}</h2>
        </div>
      </header>
      <div className="view-content-padding">
        <CampaignForm profiles={options.profiles} offers={options.offers} maxSteps={settings.limits.max_messages_per_lead}
          initial={{ name: "", goal: "", description: "", channel: "email", language: lang, tone: "direct", customer_profile_id: null, offer_id: null,
            steps: [{ delay_days: 0, objective: "introduction", instruction: "" }, { delay_days: 3, objective: "follow_up", instruction: "" }] }} />
      </div>
    </div>
  );
}
