import type { Metadata } from "next";
import { requireViewer } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { memberMailboxes } from "@/lib/mailbox";
import { leadStatuses, type Bucket } from "@/services/pipeline";
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
  const [statuses, boxes] = await Promise.all([leadStatuses(session.workspace.id), memberMailboxes(session.workspace.id, session.userId)]);
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
    />
  );
}
