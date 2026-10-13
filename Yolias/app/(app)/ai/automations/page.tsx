import type { Metadata } from "next";
import { canManageTeam, requireSession } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { AutomationsView } from "@/components/app/ws/AutomationsView";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).ws.ai.automations.title} — Yolias` };
}

// AI Workspace → Automations (D-198): trigger → conditions → actions, with
// the run history (kept when an automation is changed or deleted).
export default async function AutomationsPage() {
  const session = await requireSession();
  const db = await createClient();
  const [t, { data: automations }, { data: runs }] = await Promise.all([
    getDictionary(),
    db.from("automations").select("*").eq("workspace_id", session.workspace.id).order("created_at"),
    db.from("automation_runs").select("*, lead:leads(name)").eq("workspace_id", session.workspace.id).order("created_at", { ascending: false }).limit(100),
  ]);
  const a = t.ws.ai.automations;
  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <h2>{a.title}</h2>
          <p>{a.subtitle}</p>
        </div>
      </header>
      <div className="view-content-padding">
        <AutomationsView
          manage={canManageTeam(session)}
          automations={automations ?? []}
          runs={(runs ?? []).map((r) => ({ ...r, leadName: (r.lead as unknown as { name: string } | null)?.name ?? null }))}
          timeZone={session.profile.timezone}
        />
      </div>
    </div>
  );
}
