import type { Metadata } from "next";
import { canManageTeam, requireSession } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { loadAiSettings } from "@/lib/ai-workspace/server";
import { RulesView } from "@/components/app/ws/RulesView";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).ws.ai.rules.title} — Yolias` };
}

// AI Workspace → Rules & Permissions (D-197). Enforced on the server by
// lib/ai-workspace/settings.ts decide() in every agent, automation and tool.
export default async function RulesPage() {
  const session = await requireSession();
  const [t, settings] = await Promise.all([getDictionary(), loadAiSettings(session.workspace.id)]);
  const r = t.ws.ai.rules;
  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <h2>{r.title}</h2>
          <p>{r.subtitle}</p>
        </div>
      </header>
      <div className="view-content-padding">
        <RulesView settings={settings} manage={canManageTeam(session)} />
      </div>
    </div>
  );
}
