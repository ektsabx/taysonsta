import type { Metadata } from "next";
import { requireViewer } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { memberMailboxes } from "@/lib/mailbox";
import { leadStatuses, type Bucket } from "@/services/pipeline";
import { createClient } from "@/lib/supabase/server";
import { PipelineView } from "@/components/app/crm/PipelineView";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).sdr.pipeline.title} | Yolias` };
}

// The CRM (D-256): AgentSDR's Pipeline, deals only (owner, 2026-10-28, like
// D-252): leads that showed interest or were moved to the CRM by hand (stage
// past New), by where they stand: needs action, waiting on them, follow-ups
// exhausted. Every other conversation stays in the Inbox. ?view=list for the list, ?show=all to include the
// leads who said no. Each lead's record stays at /crm/[id].
export default async function CrmPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireViewer();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const view = one(sp.view) === "list" ? "list" : "board";
  const potential = one(sp.show) !== "all";
  const ws = session.workspace.id;
  const db = await createClient();
  const [statuses, boxes, approvals, tasks] = await Promise.all([
    leadStatuses(ws), memberMailboxes(ws, session.userId),
    db.from("agent_pending_actions").select("id, lead_id, tool, input, summary, created_at, lead:sales_leads(name)").eq("workspace_id", ws).eq("status", "pending").not("lead_id", "is", null).order("created_at", { ascending: false }).limit(50),
    db.from("lead_tasks").select("id, title, lead_id, due_at, lead:sales_leads(name)").eq("workspace_id", ws).is("done_at", null).order("due_at", { nullsFirst: false }).limit(50),
  ]);
  const all = statuses.filter((l) => l.stage !== "new");
  const open = all.filter((l) => l.bucket && l.potential);
  const leads = (potential ? open : all.filter((l) => l.bucket))
    .sort((a, b) => Date.parse(b.lastInbound?.at ?? b.lastActivityAt) - Date.parse(a.lastInbound?.at ?? a.lastActivityAt));
  const count = (b: Bucket) => open.filter((l) => l.bucket === b).length;
  return (
    <PipelineView
      leads={leads} view={view} potential={potential}
      total={{ open: open.length, needs_action: count("needs_action"), waiting: count("waiting"), exhausted: count("exhausted") }}
      hasMailbox={boxes.some((m) => m.status === "connected")}
      timeZone={session.profile.timezone ?? null}
      approvals={(approvals.data ?? []).map((x) => ({ id: x.id, leadId: x.lead_id!, leadName: (x.lead as unknown as { name: string } | null)?.name ?? "-", tool: x.tool, input: x.input, summary: x.summary, createdAt: x.created_at }))}
      tasks={(tasks.data ?? []).map((k) => ({ id: k.id, title: k.title, leadId: k.lead_id, leadName: (k.lead as unknown as { name: string } | null)?.name ?? "-", dueAt: k.due_at }))}
    />
  );
}
