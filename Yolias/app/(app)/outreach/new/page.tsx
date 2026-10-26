import type { Metadata } from "next";
import { requireViewer } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { getOutreachCampaign, launchSummary, outreachOptions } from "@/services/outreach-campaigns";
import { loadAiSettings } from "@/lib/ai-workspace/server";
import { memberMailboxes } from "@/lib/mailbox";
import { CampaignWizard, type WizardDraft } from "@/components/app/campaigns/CampaignWizard";
import { createClient } from "@/lib/supabase/server";
import type { CampaignAim } from "@/types/acquisition";
import type { MessageObjective, MessageTone } from "@/types/database";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).sdr.campaigns.w.title} | Yolias` };
}

// Create a campaign (D-256): a four-step wizard after AgentSDR. ?draft=<id>
// is the campaign the wizard saved at step 1 (going back edits it);
// ?from=<search id> starts from a search's prospects.
export default async function NewOutreachPage({ searchParams }: PageProps<"/outreach/new">) {
  const session = await requireViewer();
  const ws = session.workspace.id;
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const draftId = /^[0-9a-f-]{36}$/i.test(one(sp.draft)) ? one(sp.draft) : null;
  const db = await createClient();
  const [options, settings, { data: searches }, { data: items }, boxes, detail, launch] = await Promise.all([
    outreachOptions(ws), loadAiSettings(ws),
    db.from("campaigns").select("id, name").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(100),
    db.from("prospect_items").select("key, item_type, id, name, title, company_name, domain").eq("workspace_id", ws).not("saved_at", "is", null).order("created_at", { ascending: false }).limit(1000),
    memberMailboxes(ws, session.userId),
    draftId ? getOutreachCampaign(ws, draftId) : Promise.resolve(null),
    draftId ? launchSummary(ws, draftId) : Promise.resolve(null),
  ]);
  const c = detail?.campaign;
  const draft: WizardDraft | null = c && c.status !== "archived" ? {
    id: c.id, name: c.name, aim: (c.aim as CampaignAim | undefined) ?? "meeting", cta: c.cta_url ?? "", language: c.language, tone: c.tone as MessageTone,
    profile: c.customer_profile_id, offer: c.offer_id, leads: detail!.enrollments.length,
    steps: detail!.steps.map((s) => ({ delay_days: s.delay_days, objective: s.objective as MessageObjective, instruction: s.instruction ?? "" })),
  } : null;
  const from = one(sp.from);
  return (
    <CampaignWizard
      draft={draft} launch={launch} searches={searches ?? []}
      people={(items ?? []).map((i) => ({ key: i.key, kind: i.item_type === "person" ? "person" as const : "company" as const, id: i.id, name: i.name, sub: [i.title, i.company_name !== i.name ? i.company_name : null, i.domain].filter(Boolean).join(" · ") || null }))}
      profiles={options.profiles} offers={options.offers}
      mailboxes={boxes.filter((m) => m.status === "connected").map((m) => ({ id: m.id, email: m.email, provider: m.provider }))}
      maxSteps={settings.limits.max_messages_per_lead} dailyLimit={settings.limits.daily_send_limit}
      language={session.profile.language === "ar" ? "ar" : "en"}
      from={(searches ?? []).some((s) => s.id === from) ? from : null}
    />
  );
}
