import type { Metadata } from "next";
import { requireViewer } from "@/lib/session";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { builderSchema, emptyAdSet, type BuilderState } from "@/lib/campaigns/builder";
import { builderContext, stateFromCampaign } from "@/services/builder";
import { CampaignBuilder } from "@/components/app/campaigns/CampaignBuilder";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).ag.builder.title} | Yolias` };
}

// Create campaign (owner, 2026-10-31, D-273): Campaign → Audiences → Message.
// ?draft=<id> reopens a saved draft where the member left it.
export default async function NewCampaignPage({ searchParams }: { searchParams: Promise<{ draft?: string }> }) {
  const session = await requireViewer();
  const ws = session.workspace.id;
  const { draft } = await searchParams;
  const db = await createClient();
  const [t, locale, saved] = await Promise.all([
    getDictionary(), getLocale(),
    draft && /^[0-9a-f-]{36}$/i.test(draft) ? db.from("outreach_campaigns").select("id, wizard").eq("id", draft).eq("workspace_id", ws).eq("status", "draft").maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const zone = session.profile.timezone ?? "UTC";
  const ctx = await builderContext(ws, session.userId, zone, locale);
  const fresh: BuilderState = builderSchema.parse({
    timezone: zone, senderName: session.profile.full_name ?? "", mailboxId: ctx.mailboxes[0]?.id ?? null,
    adSets: [emptyAdSet(1, `${t.ag.levels.audience} 1`)],
  });
  // A draft saved by this builder reopens as it was; an older draft is read from the campaign itself.
  let resumed = saved.data?.wizard ? builderSchema.safeParse(saved.data.wizard) : null;
  if (saved.data && !resumed?.success) {
    const from = await stateFromCampaign(saved.data.id, ws);
    resumed = from ? builderSchema.safeParse(from.state) : null;
  }
  const initial = resumed?.success ? resumed.data : fresh;
  return (
    <div className="sdr-page cb-page">
      <CampaignBuilder mode="new" campaignId={null} draftId={resumed?.success ? saved.data!.id : null} initial={initial} locked={[]} {...ctx} />
    </div>
  );
}
