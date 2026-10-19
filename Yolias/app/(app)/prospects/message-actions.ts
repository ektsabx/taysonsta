"use server";

import { requireSession } from "@/lib/session";
import { capture } from "@/lib/analytics/server";

// Writing and sending emails happens only in Outreach (D-239), from the
// member's connected mailbox. Prospects keeps the CSV export count.

/** Export selected people (CSV) — counted for analytics; the file itself comes from /prospects/export. */
export async function exportedPeople(count: number, source: "results" | "prospects"): Promise<void> {
  const session = await requireSession();
  await capture(session.userId, "prospects_exported", { workspace_id: session.workspace.id, count: Math.max(0, Math.min(count, 100_000)), format: "csv", source });
}
