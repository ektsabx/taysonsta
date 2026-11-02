import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { builderSchema } from "@/lib/campaigns/builder";
import { builderContext, stateFromCampaign } from "@/services/builder";
import { CampaignBuilder } from "@/components/app/campaigns/CampaignBuilder";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).ag.builder.editTitle} | Yolias` };
}

// Edit a campaign (D-273): the same three levels. A draft continues in the
// builder; a launched campaign changes its settings and message and can add
// audiences, while its running audiences keep their targeting.
export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireViewer();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: c } = await createAdminClient().from("outreach_campaigns").select("status").eq("id", id).eq("workspace_id", session.workspace.id).maybeSingle();
  if (!c) notFound();
  if (c.status === "draft") redirect(`/outreach/new?draft=${id}`);
  if (c.status === "archived" || c.status === "completed") redirect(`/outreach/${id}`);
  const from = await stateFromCampaign(id, session.workspace.id);
  const parsed = from ? builderSchema.safeParse(from.state) : null;
  if (!from || !parsed?.success) notFound();
  const locale = await getLocale();
  const ctx = await builderContext(session.workspace.id, session.userId, parsed.data.timezone, locale);
  return (
    <div className="sdr-page cb-page">
      <CampaignBuilder mode="edit" campaignId={id} draftId={null} initial={parsed.data} locked={from.locked} {...ctx} />
    </div>
  );
}
