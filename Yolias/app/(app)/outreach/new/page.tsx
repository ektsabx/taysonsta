import type { Metadata } from "next";
import { requireViewer } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CampaignWizard } from "@/components/app/campaigns/CampaignWizard";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).camp.wizard.title} | Yolias` };
}

// New campaign (owner, 2026-10-31, D-270): the guided way to make a campaign.
export default async function NewCampaignPage() {
  const session = await requireViewer();
  const [t, { data }] = await Promise.all([getDictionary(), createAdminClient().rpc("usage_summary", { p_ws: session.workspace.id })]);
  return (
    <div className="sdr-page">
      <header className="sdr-head"><div><h2>{t.camp.wizard.title}</h2><p>{t.camp.wizard.subtitle}</p></div></header>
      <CampaignWizard available={Number(data?.[0]?.available ?? 0)} />
    </div>
  );
}
