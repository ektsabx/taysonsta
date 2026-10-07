"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { enqueue } from "@/lib/jobs/queue";
import { parseFilters, selectEntities } from "@/services/prospects";
import { getLocale } from "@/lib/i18n/server";
import { gridPerson } from "@/lib/results";
import type { GridPerson } from "@/components/app/PeopleGrid";
import type { ProspectRow } from "@/types/database";

// Prospects workspace actions (final spec phase 5). The browser sends ids or
// "all rows matching these filters"; the server resolves them with the
// member's own client (RLS), so a request can only ever touch its workspace.

export type Target = { ids: string[] } | { all: string };

async function resolve(target: Target, tab?: "people" | "companies" | "local") {
  const session = await requireSession();
  const filters = parseFilters(Object.fromEntries(new URLSearchParams("all" in target ? target.all : "")));
  if (tab) filters.tab = tab;
  const ids = "ids" in target ? target.ids.slice(0, 10_000) : "all";
  const page = await selectEntities(session.workspace.id, filters, ids);
  return { session, page, ids: (page.rows as { id: string }[]).map((r) => r.id) };
}

/**
 * Contact reveal: people's email and phone are shown masked until a member
 * reveals them; the first reveal is recorded (who, when). Revealing costs no
 * prospects — the person was already counted when delivered.
 */
export async function revealContacts(target: Target): Promise<{ ok: true; contacts: { id: string; email: string | null; phone: string | null }[] } | { ok: false }> {
  const { session, page, ids } = await resolve(target, "people");
  if (page.tab !== "people" || !ids.length) return { ok: false };
  const supabase = await createClient();
  await supabase.from("prospects").update({ revealed_at: new Date().toISOString(), revealed_by: session.userId })
    .eq("workspace_id", session.workspace.id).in("id", ids).is("revealed_at", null);
  revalidatePath("/prospects", "layout");
  return { ok: true, contacts: page.rows.map((r) => ({ id: r.id, email: r.email, phone: r.phone })) };
}

/**
 * Decision-maker matching: queues "find the decision makers" for saved
 * companies / local businesses. Each person found is one prospect.
 */
export async function findDecisionMakersAction(target: Target, tab: "companies" | "local"): Promise<{ ok: boolean; queued: number }> {
  const { session, ids } = await resolve(target, tab);
  if (!ids.length) return { ok: false, queued: 0 };
  const supabase = await createClient();
  const { data } = await supabase.from("companies").update({ people_requested_at: new Date().toISOString() })
    .eq("workspace_id", session.workspace.id).in("id", ids).select("id");
  const companyIds = (data ?? []).map((r) => r.id);
  // Batches keep each job inside one worker invocation.
  for (let i = 0; i < companyIds.length; i += 20) {
    await enqueue("company.people", { workspaceId: session.workspace.id, companyIds: companyIds.slice(i, i + 20) });
  }
  revalidatePath("/prospects", "layout");
  return { ok: true, queued: companyIds.length };
}

/** Removes rows from Prospects (they stay in their search's results). */
export async function removeFromProspects(target: Target, tab: "people" | "companies" | "local"): Promise<{ ok: boolean; removed: number }> {
  const { session, ids } = await resolve(target, tab);
  if (!ids.length) return { ok: false, removed: 0 };
  const supabase = await createClient();
  const table = tab === "people" ? "prospects" : "companies";
  const { data } = await supabase.from(table).update({ saved_at: null }).eq("workspace_id", session.workspace.id).in("id", ids).select("id");
  revalidatePath("/prospects", "layout");
  return { ok: true, removed: data?.length ?? 0 };
}

/** Removes rows from Saved (they stay in Prospects). Ids are "person:<id>" / "company:<id>". */
export async function removeFromSaved(target: Target): Promise<{ ok: boolean; removed: number }> {
  const session = await requireSession();
  const filters = parseFilters(Object.fromEntries(new URLSearchParams("all" in target ? target.all : "")));
  filters.tab = "saved";
  const page = await selectEntities(session.workspace.id, filters, "ids" in target ? target.ids.slice(0, 10_000) : "all");
  if (page.tab !== "saved" || !page.rows.length) return { ok: false, removed: 0 };
  const supabase = await createClient();
  const people = page.rows.filter((i) => i.kind === "person").map((i) => i.row.id);
  const companies = page.rows.filter((i) => i.kind !== "person").map((i) => i.row.id);
  const [p, c] = await Promise.all([
    people.length ? supabase.from("prospects").update({ bookmarked_at: null }).eq("workspace_id", session.workspace.id).in("id", people).select("id") : { data: [] },
    companies.length ? supabase.from("companies").update({ bookmarked_at: null }).eq("workspace_id", session.workspace.id).in("id", companies).select("id") : { data: [] },
  ]);
  revalidatePath("/prospects", "layout");
  return { ok: true, removed: (p.data?.length ?? 0) + (c.data?.length ?? 0) };
}

/** The selected people as cards, for the Email / LinkedIn actions on the Prospects table (at most 100). */
export async function peopleForActions(target: Target): Promise<GridPerson[]> {
  const { page } = await resolve("ids" in target ? { ids: target.ids.slice(0, 100) } : target, "people");
  if (page.tab !== "people") return [];
  const locale = await getLocale();
  return page.rows.slice(0, 100).map((p) => gridPerson(p as unknown as ProspectRow, p.company_id && p.company ? { id: p.company_id, name: p.company.name } : null, locale));
}
