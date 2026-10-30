"use server";
import { hasProviderFor } from "@/lib/intel/registry";
import { capture } from "@/lib/analytics/server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { enqueue } from "@/lib/jobs/queue";

// Result cards (D-147): reveal decision makers' contacts, bookmark a company
// and collect its decision makers. Every read and change goes through the
// member's own client (RLS). Email / LinkedIn / export: message-actions.ts.

const uuid = /^[0-9a-f-]{36}$/i;
const ids = (v: string[]) => [...new Set(v.filter((i) => uuid.test(i)))].slice(0, 100);

/** Bookmark: a company in / out of the Prospects list. */
/**
 * Save / unsave a person, company or local business (Prospects → Saved,
 * D-159). Saving also puts it in Prospects; unsaving keeps it there.
 */
export async function setSaved(kind: "person" | "company", id: string, saved: boolean): Promise<{ ok: boolean }> {
  const session = await requireSession();
  if (!uuid.test(id)) return { ok: false };
  const db = await createClient();
  const now = new Date().toISOString();
  const table = kind === "person" ? "prospects" : "companies";
  const { data, error } = await db.from(table).update({ bookmarked_at: saved ? now : null }).eq("id", id).eq("workspace_id", session.workspace.id).select("id");
  if (saved && data?.length) await db.from(table).update({ saved_at: now }).eq("id", id).is("saved_at", null);
  revalidatePath("/prospects", "layout");
  return { ok: !error && Boolean(data?.length) };
}

/** "Collect decision makers" for delivered companies (saved or not). Free: the company was the result (D-146). */
export async function collectDecisionMakers(companyIds: string[]): Promise<{ ok: boolean; queued: number }> {
  const session = await requireSession();
  const list = ids(companyIds);
  if (!list.length) return { ok: false, queued: 0 };
  // Without a source for people nothing would run: say so instead of spinning.
  if (!(await hasProviderFor("person.search"))) return { ok: false, queued: 0 };
  const db = await createClient();
  const { data } = await db.from("companies").update({ people_requested_at: new Date().toISOString(), people_status: "queued" })
    .eq("workspace_id", session.workspace.id).in("id", list)
    .or("people_status.is.null,people_status.in.(no_source,failed,no_quota)").select("id");
  const queued = (data ?? []).map((r) => r.id);
  for (let i = 0; i < queued.length; i += 20) {
    await enqueue("company.people", { workspaceId: session.workspace.id, companyIds: queued.slice(i, i + 20) });
  }
  await capture(session.userId, "decision_makers_requested", { workspace_id: session.workspace.id, companies: queued.length });
  revalidatePath("/prospects", "layout");
  revalidatePath("/search", "layout");
  return { ok: true, queued: queued.length };
}
