import type { Metadata } from "next";
import { requireViewer } from "@/lib/session";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { memberMailboxes } from "@/lib/mailbox";
import { timeZoneChoices, timeZoneLabel } from "@/lib/regions";
import { prospectRate } from "@/services/campaign-metrics";
import { emptyGroup, wizardSchema, type WizardState } from "@/lib/campaigns/wizard";
import { CampaignWizard } from "@/components/app/campaigns/CampaignWizard";
import type { Targeting } from "@/lib/campaigns/targeting";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).camp.wiz.title} | Yolias` };
}

// Create campaign (owner, 2026-10-31, D-272). ?draft=<id> reopens a saved draft at its step.
export default async function NewCampaignPage({ searchParams }: { searchParams: Promise<{ draft?: string }> }) {
  const session = await requireViewer();
  const ws = session.workspace.id;
  const { draft } = await searchParams;
  const db = await createClient();
  const admin = createAdminClient();
  const [t, locale, rate, usage, { data: people }, { data: audiences }, { data: campaigns }, boxes, saved] = await Promise.all([
    getDictionary(), getLocale(), prospectRate(ws), admin.rpc("usage_summary", { p_ws: ws }),
    admin.from("profiles").select("id, full_name, email").eq("workspace_id", ws),
    db.from("audiences").select("id, name, kind, targeting, members").eq("workspace_id", ws).order("created_at", { ascending: false }),
    db.from("outreach_campaigns").select("id, name").eq("workspace_id", ws).neq("status", "draft").order("created_at", { ascending: false }).limit(100),
    memberMailboxes(ws, session.userId),
    draft && /^[0-9a-f-]{36}$/i.test(draft) ? db.from("outreach_campaigns").select("id, wizard, status").eq("id", draft).eq("workspace_id", ws).eq("status", "draft").maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const zone = session.profile.timezone ?? "UTC";
  const fresh: WizardState = wizardSchema.parse({ timezone: zone, ownerId: session.userId, groups: [emptyGroup(0, t.camp.groups.main)] });
  const resumed = saved.data?.wizard ? wizardSchema.safeParse(saved.data.wizard) : null;
  const initial = resumed?.success ? resumed.data : fresh;
  return (
    <div className="sdr-page">
      <header className="sdr-head"><div><h2>{t.camp.wiz.title}</h2><p>{t.camp.wizard.subtitle}</p></div></header>
      <CampaignWizard
        draftId={resumed?.success ? saved.data!.id : null} initial={initial} rate={rate} balance={Number(usage.data?.[0]?.available ?? 0)}
        members={(people ?? []).map((p) => ({ id: p.id, name: p.full_name || p.email || "" }))}
        zones={timeZoneChoices(initial.timezone).map((z) => ({ value: z, label: timeZoneLabel(z, locale) }))}
        audiences={(audiences ?? []).map((a) => ({ id: a.id, name: a.name, kind: a.kind, targeting: a.targeting as Targeting, members: a.members }))}
        campaigns={campaigns ?? []} mailbox={boxes.find((b) => b.status === "connected")?.email ?? null} today={new Date().toISOString().slice(0, 10)}
      />
    </div>
  );
}
