import type { Metadata } from "next";
import Link from "next/link";
import { canManageTeam, requireViewer } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { KnowledgeView } from "@/components/app/ws/KnowledgeView";
import { ProfilesView } from "@/components/app/ws/ProfilesView";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).ws.ai.knowledge.title} — Yolias` };
}

// AI Workspace → Company Knowledge (moved from Settings → Organization,
// D-196): the company profile, the knowledge sections, Business Offers and
// Competitors; Customer Profiles (D-195) is its second tab (owner brief
// 2026-10-19, was its own page).
export default async function KnowledgePage({ searchParams }: PageProps<"/ai/knowledge">) {
  const session = await requireViewer();
  const tab = (await searchParams).tab === "profiles" ? "profiles" : "company";
  const db = await createClient();
  const t = await getDictionary();
  const k = t.ws.ai.knowledge;
  const p = t.ws.ai.profiles;
  const w = session.workspace;
  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <h2>{k.title}</h2>
          <p>{tab === "profiles" ? p.subtitle : k.subtitle}</p>
        </div>
      </header>
      <nav className="ws-tabs knowledge-tabs" aria-label={k.title}>
        <Link href="/ai/knowledge" className={tab === "company" ? "active" : ""} aria-current={tab === "company" ? "page" : undefined}>{k.tabCompany}</Link>
        <Link href="/ai/knowledge?tab=profiles" className={tab === "profiles" ? "active" : ""} aria-current={tab === "profiles" ? "page" : undefined}>{p.title}</Link>
      </nav>
      <div className="view-content-padding">
        {tab === "profiles" ? <Profiles workspaceId={w.id} db={db} /> : <Company session={session} db={db} />}
      </div>
    </div>
  );
}

type Db = Awaited<ReturnType<typeof createClient>>;

async function Company({ session, db }: { session: Awaited<ReturnType<typeof requireViewer>>; db: Db }) {
  const w = session.workspace;
  const [{ data: knowledge }, { data: offers }, { data: competitors }] = await Promise.all([
    db.from("workspace_knowledge").select("*").eq("workspace_id", w.id).maybeSingle(),
    db.from("business_offers").select("*").eq("workspace_id", w.id).order("created_at"),
    db.from("competitors").select("*").eq("workspace_id", w.id).order("name"),
  ]);
  return (
    <KnowledgeView
      manage={canManageTeam(session)}
      profile={{ name: w.name ?? "", website: w.website ?? "", industry: w.industry ?? "", offering: w.offering ?? "", ideal_customer: w.ideal_customer ?? "", target_markets: w.target_markets ?? "" }}
      knowledge={knowledge}
      offers={offers ?? []}
      competitors={competitors ?? []}
    />
  );
}

async function Profiles({ workspaceId, db }: { workspaceId: string; db: Db }) {
  const { data: profiles } = await db.from("customer_profiles").select("*").eq("workspace_id", workspaceId).order("is_default", { ascending: false }).order("name");
  return <ProfilesView profiles={profiles ?? []} />;
}
