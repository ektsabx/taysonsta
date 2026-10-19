import type { Metadata } from "next";
import { canManageTeam, requireViewer } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { loadAiSettings } from "@/lib/ai-workspace/server";
import { routesFor } from "@/lib/ai/llm";
import { tasks } from "@/lib/ai/orchestrator";
import { AgentSettingsView } from "@/components/app/ws/AgentSettings";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).ws.ai.agents.title} — Yolias` };
}

// AI Workspace → AI Agent (D-205): one agent with a goal; its capabilities,
// permissions, limits and escalation rules are its settings.
export default async function AgentsPage() {
  const session = await requireViewer();
  const [t, settings, writing, approvals] = await Promise.all([
    getDictionary(),
    loadAiSettings(session.workspace.id),
    routesFor(tasks.writing).then((r) => r.length > 0).catch(() => false),
    (await createClient()).from("agent_pending_actions").select("id, lead_id, agent, tool, input, summary, created_at, lead:sales_leads(name)")
      .eq("workspace_id", session.workspace.id).eq("status", "pending").not("lead_id", "is", null).order("created_at", { ascending: false }).limit(50),
  ]);
  const a = t.ws.ai.agents;
  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <h2>{a.title}</h2>
          <p>{a.subtitle}</p>
        </div>
      </header>
      <div className="view-content-padding">
        <AgentSettingsView
          settings={settings}
          manage={canManageTeam(session)}
          aiConnected={writing}
          approvals={(approvals.data ?? []).map((x) => ({ id: x.id, leadId: x.lead_id!, leadName: (x.lead as unknown as { name: string } | null)?.name ?? "—", tool: x.tool, input: x.input, summary: x.summary, createdAt: x.created_at }))}
          timeZone={session.profile.timezone}
        />
      </div>
    </div>
  );
}
