"use server";

import type { CampaignAim } from "@/types/acquisition";
import { hasProviderFor } from "@/lib/intel/registry";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { enqueue } from "@/lib/jobs/queue";
import { parseFilters, selectItems } from "@/services/prospects";
import { addProspectsToCampaign, quickCampaign } from "@/app/(app)/outreach/actions";

// Prospects workspace actions. The browser sends row keys ("person:<id>" /
// "company:<id>") or "all rows matching these filters"; the server resolves
// them with the member's own client (RLS), so a request can only ever touch
// its workspace. One table holds companies, local businesses and people, so
// each action takes the kinds it applies to and ignores the rest.

export type Target = { ids: string[] } | { all: string };

async function resolve(target: Target) {
  const session = await requireSession();
  const filters = parseFilters(Object.fromEntries(new URLSearchParams("all" in target ? target.all : "")));
  const keys = "ids" in target ? target.ids.slice(0, 10_000) : "all";
  const { rows } = await selectItems(session.workspace.id, filters, keys);
  const people = rows.flatMap((i) => (i.kind === "person" ? [i.row] : []));
  const companies = rows.flatMap((i) => (i.kind === "person" ? [] : [i.row]));
  return { session, filters, people, companies };
}

/**
 * Contact reveal: people's email and phone are shown masked until a member
 * reveals them; the first reveal is recorded (who, when). Revealing costs no
 * prospects — the person was already counted when delivered.
 */
/** Decision-maker matching: queues "find the decision makers" for the selected companies / local businesses. */
export async function findDecisionMakersAction(target: Target): Promise<{ ok: boolean; queued: number }> {
  const { session, companies } = await resolve(target);
  if (!companies.length) return { ok: false, queued: 0 };
  if (!(await hasProviderFor("person.search"))) return { ok: false, queued: 0 };
  const supabase = await createClient();
  const { data } = await supabase.from("companies").update({ people_requested_at: new Date().toISOString(), people_status: "queued" })
    .eq("workspace_id", session.workspace.id).in("id", companies.map((c) => c.id))
    .or("people_status.is.null,people_status.in.(no_source,failed,no_quota)").select("id");
  const companyIds = (data ?? []).map((r) => r.id);
  // Batches keep each job inside one worker invocation.
  for (let i = 0; i < companyIds.length; i += 20) {
    await enqueue("company.people", { workspaceId: session.workspace.id, companyIds: companyIds.slice(i, i + 20) });
  }
  revalidatePath("/prospects", "layout");
  return { ok: true, queued: companyIds.length };
}

/** Removes rows from Prospects (they stay in their search's results). */
export async function removeFromProspects(target: Target): Promise<{ ok: boolean; removed: number }> {
  const { session, people, companies } = await resolve(target);
  if (!people.length && !companies.length) return { ok: false, removed: 0 };
  const supabase = await createClient();
  const [p, c] = await Promise.all([
    people.length ? supabase.from("prospects").update({ saved_at: null }).eq("workspace_id", session.workspace.id).in("id", people.map((r) => r.id)).select("id") : { data: [] },
    companies.length ? supabase.from("companies").update({ saved_at: null }).eq("workspace_id", session.workspace.id).in("id", companies.map((r) => r.id)).select("id") : { data: [] },
  ]);
  revalidatePath("/prospects", "layout");
  return { ok: true, removed: (p.data?.length ?? 0) + (c.data?.length ?? 0) };
}

/** Removes rows from Saved (they stay in Prospects). */
export async function removeFromSaved(target: Target): Promise<{ ok: boolean; removed: number }> {
  const { session, people, companies } = await resolve(target);
  if (!people.length && !companies.length) return { ok: false, removed: 0 };
  const supabase = await createClient();
  const [p, c] = await Promise.all([
    people.length ? supabase.from("prospects").update({ bookmarked_at: null }).eq("workspace_id", session.workspace.id).in("id", people.map((r) => r.id)).select("id") : { data: [] },
    companies.length ? supabase.from("companies").update({ bookmarked_at: null }).eq("workspace_id", session.workspace.id).in("id", companies.map((r) => r.id)).select("id") : { data: [] },
  ]);
  revalidatePath("/prospects", "layout");
  return { ok: true, removed: (p.data?.length ?? 0) + (c.data?.length ?? 0) };
}

/** Selected results → CRM → an Outreach campaign. */
export async function addSelectionToCampaign(campaignId: string, target: Target) {
  const { people, companies } = await resolve(target);
  return addProspectsToCampaign(campaignId, [...people.map((p) => ({ kind: "person" as const, id: p.id })), ...companies.map((c) => ({ kind: "company" as const, id: c.id }))]);
}

/** Selected results → a new outreach campaign, started with drafts ready (Prospects → Send, owner brief 2026-10-19). */
export async function sendSelectionAsCampaign(target: Target, input: { name: string; channel: string; aim?: CampaignAim; ctaUrl?: string | null }) {
  const { people, companies } = await resolve(target);
  return quickCampaign({ ...input, targets: [...people.map((p) => ({ kind: "person" as const, id: p.id })), ...companies.map((c) => ({ kind: "company" as const, id: c.id }))].slice(0, 500) });
}

/** Campaigns the selection can join (draft / active / paused). */
export async function openOutreachCampaigns(): Promise<{ id: string; name: string; status: string }[]> {
  const session = await requireSession();
  const { data } = await (await createClient()).from("outreach_campaigns").select("id, name, status").eq("workspace_id", session.workspace.id).in("status", ["draft", "active", "paused"]).order("updated_at", { ascending: false }).limit(50);
  return data ?? [];
}

/** A person or company page → a new outreach campaign with them; the campaign page writes the email (D-239). */
export async function startCampaignFor(targets: { kind: "person" | "company"; id: string }[], name: string) {
  return quickCampaign({ name: name.trim().slice(0, 160) || "Campaign", channel: "email", targets: targets.slice(0, 500) });
}
