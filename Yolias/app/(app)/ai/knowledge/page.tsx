import type { Metadata } from "next";
import { canManageTeam, requireViewer } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { KnowledgeView } from "@/components/app/ws/KnowledgeView";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).ws.ai.knowledge.title} | Yolias` };
}

// Company Knowledge (owner, 2026-10-30, D-269): one page Yolias fills from the
// website: the company, what it sells, the ideal customer, offers and
// competitors, with one Save. Every search, email and reply reads it.
export default async function KnowledgePage() {
  const session = await requireViewer();
  const db = await createClient();
  const k = (await getDictionary()).ws.ai.knowledge;
  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <h2>{k.title}</h2>
          <p>{k.subtitle}</p>
        </div>
      </header>
      <div className="view-content-padding">
        <Company session={session} db={db} />
      </div>
    </div>
  );
}

type Db = Awaited<ReturnType<typeof createClient>>;

async function Company({ session, db }: { session: Awaited<ReturnType<typeof requireViewer>>; db: Db }) {
  const w = session.workspace;
  const [{ data: knowledge }, { data: offers }, { data: competitors }, { data: customers }] = await Promise.all([
    db.from("workspace_knowledge").select("*").eq("workspace_id", w.id).maybeSingle(),
    db.from("business_offers").select("*").eq("workspace_id", w.id).order("created_at"),
    db.from("competitors").select("*").eq("workspace_id", w.id).order("name"),
    db.from("customer_profiles").select("*").eq("workspace_id", w.id).order("is_default", { ascending: false }).order("created_at").limit(1),
  ]);
  return (
    <KnowledgeView
      manage={canManageTeam(session)}
      profile={{ name: w.name ?? "", website: w.website ?? "", industry: w.industry ?? "", offering: w.offering ?? "", ideal_customer: w.ideal_customer ?? "", target_markets: w.target_markets ?? "" }}
      knowledge={knowledge}
      offers={offers ?? []}
      competitors={competitors ?? []}
      customer={customers?.[0] ?? null}
    />
  );
}

