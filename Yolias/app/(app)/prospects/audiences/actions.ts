"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDictionary } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import { members } from "@/lib/campaigns/audience";
import { targetingSchema } from "@/lib/campaigns/wizard";
import type { Json } from "@/types/database";
import { CUSTOM_SOURCES, type CustomSource } from "@/lib/campaigns/audience-sources";

// Audiences (owner, 2026-10-31, D-272): a saved targeting, or a custom list of
// people built from what the workspace already has (a previous campaign,
// customers, qualified or booked meetings, interested people, imported
// contacts). Building an audience never contacts anyone: a campaign does,
// after its first email is approved.

export type AudienceResult<T = object> = ({ ok: true; message?: string } & T) | { ok: false; error: string };


async function sourceLeads(workspaceId: string, source: CustomSource, campaignId: string | null): Promise<string[]> {
  if (source === "previous_campaign" || source === "customers" || source === "imported") return members(workspaceId, source, { campaignId });
  const db = createAdminClient();
  if (source === "qualified") return [...new Set(((await db.from("sales_meetings").select("lead_id").eq("workspace_id", workspaceId).eq("qualified", true).limit(5000)).data ?? []).map((m) => m.lead_id))];
  if (source === "meetings") return [...new Set(((await db.from("sales_meetings").select("lead_id").eq("workspace_id", workspaceId).neq("status", "canceled").limit(5000)).data ?? []).map((m) => m.lead_id))];
  return ((await db.from("sales_leads").select("id").eq("workspace_id", workspaceId).in("stage", ["interested", "meeting_booked", "meeting_completed", "proposal", "negotiation", "closed"]).limit(5000)).data ?? []).map((l) => l.id);
}

/** Preview before building: how many people, how many can be emailed, how many asked not to be contacted. */
export async function previewCustom(source: CustomSource, campaignId: string | null): Promise<AudienceResult<{ total: number; withEmail: number; doNotContact: number }>> {
  const session = await requireSession();
  if (!(CUSTOM_SOURCES as readonly string[]).includes(source)) return { ok: false, error: (await getDictionary()).camp.aud.errors.source };
  const ids = await sourceLeads(session.workspace.id, source, campaignId);
  const { data } = ids.length ? await createAdminClient().from("sales_leads").select("email, do_not_contact").eq("workspace_id", session.workspace.id).in("id", ids.slice(0, 5000)) : { data: [] };
  return { ok: true, total: ids.length, withEmail: (data ?? []).filter((l) => l.email).length, doNotContact: (data ?? []).filter((l) => l.do_not_contact).length };
}

const saveInput = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(["saved", "custom"]),
  name: z.string().trim().min(1).max(120),
  targeting: targetingSchema.optional(),
  source: z.enum(CUSTOM_SOURCES).optional(),
  campaignId: z.string().uuid().nullable().optional(),
});

export async function saveAudience(input: z.input<typeof saveInput>): Promise<AudienceResult<{ id: string }>> {
  const session = await requireSession();
  const t = await getDictionary();
  const p = saveInput.safeParse(input);
  if (!p.success) return { ok: false, error: t.camp.aud.errors.name };
  const a = p.data;
  const db = await createClient();
  const origin = a.kind === "custom" ? { source: a.source, campaign_id: a.campaignId ?? null } : {};
  const row = { name: a.name, kind: a.kind, targeting: (a.targeting ?? {}) as unknown as Json, origin: origin as Json, updated_at: new Date().toISOString() };
  const { data, error } = a.id
    ? await db.from("audiences").update(row).eq("id", a.id).eq("workspace_id", session.workspace.id).select("id").single()
    : await db.from("audiences").insert({ ...row, workspace_id: session.workspace.id, created_by: session.userId }).select("id").single();
  if (error || !data) return { ok: false, error: t.camp.aud.errors.name };
  if (a.kind === "custom") {
    if (!a.source) return { ok: false, error: t.camp.aud.errors.source };
    const n = await fill(session.workspace.id, data.id, a.source, a.campaignId ?? null);
    revalidatePath("/prospects/audiences");
    return { ok: true, id: data.id, message: fmt(t.camp.aud.built, { n: String(n) }) };
  }
  revalidatePath("/prospects/audiences");
  return { ok: true, id: data.id };
}

/** (Re)builds a custom audience from its source: duplicates can't exist (one row per person). */
async function fill(workspaceId: string, audienceId: string, source: CustomSource, campaignId: string | null): Promise<number> {
  const db = createAdminClient();
  const ids = await sourceLeads(workspaceId, source, campaignId);
  await db.from("audience_members").delete().eq("audience_id", audienceId);
  for (let i = 0; i < ids.length; i += 500) {
    await db.from("audience_members").upsert(ids.slice(i, i + 500).map((lead_id) => ({ audience_id: audienceId, lead_id, workspace_id: workspaceId })), { onConflict: "audience_id,lead_id", ignoreDuplicates: true });
  }
  await db.from("audiences").update({ members: ids.length, updated_at: new Date().toISOString() }).eq("id", audienceId);
  return ids.length;
}

export async function refreshAudience(id: string): Promise<AudienceResult> {
  const session = await requireSession();
  const t = await getDictionary();
  const { data: a } = await (await createClient()).from("audiences").select("id, kind, origin").eq("id", id).eq("workspace_id", session.workspace.id).maybeSingle();
  const o = a?.origin as { source?: CustomSource; campaign_id?: string | null } | null;
  if (!a || a.kind !== "custom" || !o?.source) return { ok: false, error: t.camp.aud.errors.source };
  const n = await fill(session.workspace.id, a.id, o.source, o.campaign_id ?? null);
  revalidatePath("/prospects/audiences");
  return { ok: true, message: fmt(t.camp.aud.built, { n: String(n) }) };
}

export async function deleteAudience(id: string): Promise<AudienceResult> {
  const session = await requireSession();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: (await getDictionary()).camp.aud.errors.name };
  await (await createClient()).from("audiences").delete().eq("id", id).eq("workspace_id", session.workspace.id);
  revalidatePath("/prospects/audiences");
  return { ok: true };
}
