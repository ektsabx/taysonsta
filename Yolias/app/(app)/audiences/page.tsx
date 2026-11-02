import type { Metadata } from "next";
import { requireViewer } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { monthlyUsage } from "@/services/workspace";
import { AudiencesView, type AudienceItem } from "@/components/app/campaigns/AudiencesView";
import type { Targeting } from "@/lib/campaigns/targeting";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).ag.aud.title} | Yolias` };
}

// Audiences (owner, 2026-10-31, D-273): a section of its own in the sidebar.
export default async function AudiencesPage() {
  const session = await requireViewer();
  const ws = session.workspace.id;
  const db = await createClient();
  const [t, { data: audiences }, { data: campaigns }, { data: groups }, usage] = await Promise.all([
    getDictionary(),
    db.from("audiences").select("id, name, kind, targeting, origin, members, updated_at, expansion, seed_size, confidence").eq("workspace_id", ws).order("updated_at", { ascending: false }),
    db.from("outreach_campaigns").select("id, name").eq("workspace_id", ws).neq("status", "draft").order("created_at", { ascending: false }).limit(100),
    db.from("audience_groups").select("audience_id, campaign_id").eq("workspace_id", ws).not("audience_id", "is", null),
    monthlyUsage(ws),
  ]);
  const used = new Map<string, Set<string>>();
  for (const g of groups ?? []) { if (!used.has(g.audience_id!)) used.set(g.audience_id!, new Set()); used.get(g.audience_id!)!.add(g.campaign_id); }
  const items: AudienceItem[] = (audiences ?? []).map((a) => ({ ...a, targeting: a.targeting as Targeting, origin: (a.origin ?? {}) as Record<string, unknown>, used: used.get(a.id)?.size ?? 0 }));
  return (
    <div className="sdr-page">
      <header className="sdr-head"><div><h2>{t.ag.aud.title}</h2><p>{t.ag.aud.subtitle}</p></div></header>
      <AudiencesView audiences={items} campaigns={campaigns ?? []} importAvailable={Math.max(usage.contacts.limit - usage.contacts.used, 0)} />
    </div>
  );
}
