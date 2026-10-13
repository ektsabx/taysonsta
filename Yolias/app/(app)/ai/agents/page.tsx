import type { Metadata } from "next";
import { canManageTeam, requireSession } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { loadAiSettings } from "@/lib/ai-workspace/server";
import { routesFor } from "@/lib/ai/llm";
import { tasks } from "@/lib/ai/orchestrator";
import { AgentsView } from "@/components/app/ws/AgentsView";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).ws.ai.agents.title} — Yolias` };
}

// AI Workspace → AI Agents (D-197): six agents built on Yolias's existing AI
// (search understanding, message writing, the LLM router) and plain code
// (fit checks, follow-up schedule). Each shows what it uses, produces and may do.
export default async function AgentsPage() {
  const session = await requireSession();
  const [t, settings, writing, approvals] = await Promise.all([
    getDictionary(),
    loadAiSettings(session.workspace.id),
    routesFor(tasks.writing).then((r) => r.length > 0).catch(() => false),
    (await createClient()).from("agent_pending_actions").select("id, lead_id, agent, tool, input, summary, created_at, lead:leads(name)")
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
        <AgentsView
          settings={settings}
          manage={canManageTeam(session)}
          aiConnected={writing}
          approvals={(approvals.data ?? []).map((x) => ({ id: x.id, leadId: x.lead_id!, leadName: (x.lead as unknown as { name: string } | null)?.name ?? "—", agent: x.agent, tool: x.tool, input: x.input, summary: x.summary, createdAt: x.created_at }))}
          timeZone={session.profile.timezone}
        />
      </div>
    </div>
  );
}
