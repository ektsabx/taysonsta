import type { Metadata } from "next";
import { canManageTeam, requireSession } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { KnowledgeView } from "@/components/app/ws/KnowledgeView";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).ws.ai.knowledge.title} — Yolias` };
}

// AI Workspace → Company Knowledge (moved from Settings → Organization,
// D-196): the company profile (same workspaces columns as before), the
// knowledge sections, Business Offers and Competitors.
export default async function KnowledgePage() {
  const session = await requireSession();
  const db = await createClient();
  const [t, { data: knowledge }, { data: offers }, { data: competitors }] = await Promise.all([
    getDictionary(),
    db.from("workspace_knowledge").select("*").eq("workspace_id", session.workspace.id).maybeSingle(),
    db.from("business_offers").select("*").eq("workspace_id", session.workspace.id).order("created_at"),
    db.from("competitors").select("*").eq("workspace_id", session.workspace.id).order("name"),
  ]);
  const k = t.ws.ai.knowledge;
  const w = session.workspace;
  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <h2>{k.title}</h2>
          <p>{k.subtitle}</p>
        </div>
      </header>
      <div className="view-content-padding">
        <KnowledgeView
          manage={canManageTeam(session)}
          profile={{ name: w.name ?? "", website: w.website ?? "", industry: w.industry ?? "", offering: w.offering ?? "", ideal_customer: w.ideal_customer ?? "", target_markets: w.target_markets ?? "" }}
          knowledge={knowledge}
          offers={offers ?? []}
          competitors={competitors ?? []}
        />
      </div>
    </div>
  );
}
