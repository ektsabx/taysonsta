"use server";
import { planLapsed } from "@/lib/plans";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireMember, canEdit, viewOnly } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { setCampaignRun } from "@/lib/outreach/execute";
import { stateFromCampaign } from "@/services/builder";
import type { Json } from "@/types/database";

// A campaign's controls (D-273): pause / resume / end / archive (one place:
// lib/outreach/execute.ts setCampaignRun), duplicate as a new draft in the
// builder, delete a draft that never sent anything. Creating and editing a
// campaign live in the builder (app/(app)/outreach/new/actions.ts).

export type OutreachResult<T = object> = ({ ok: true; message?: string } & T) | { ok: false; error: string };
const uuid = z.string().uuid();

export async function runOutreach(campaignId: string, action: "pause" | "resume" | "cancel" | "end"): Promise<OutreachResult> {
  const session = await requireMember();
  if (!canEdit(session)) return await viewOnly() as never;
  const t = (await getDictionary()).ws.outreach;
  if (!uuid.safeParse(campaignId).success || !["pause", "resume", "cancel", "end"].includes(action)) return { ok: false, error: t.errors.notFound };
  // The plan ended with no credit (owner, 2026-11-10): nothing resumes until it is renewed.
  if (action === "resume" && planLapsed(session.workspace)) return { ok: false, error: (await getDictionary()).planGate.lapsed };
  if (!(await setCampaignRun(session.workspace.id, campaignId, action))) return { ok: false, error: t.errors.notFound };
  revalidatePath("/campaigns", "layout");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** A copy of the campaign as a new draft in the builder (its settings, audiences and message), without its people or results. */
export async function duplicateCampaign(id: string): Promise<OutreachResult<{ id: string }>> {
  const session = await requireMember();
  if (!canEdit(session)) return await viewOnly() as never;
  const t = await getDictionary();
  if (!uuid.safeParse(id).success) return { ok: false, error: t.ws.outreach.errors.notFound };
  const from = await stateFromCampaign(id, session.workspace.id);
  if (!from) return { ok: false, error: t.ws.outreach.errors.notFound };
  const db = await createClient();
  const { data: src } = await db.from("outreach_campaigns").select("*").eq("id", id).eq("workspace_id", session.workspace.id).single();
  const state = { ...from.state, name: `${String(from.state.name)} (2)`.slice(0, 160), startDate: "", endDate: "", adSets: (from.state.adSets as { angleA?: string }[]).map((a, i) => ({ ...a, key: `d${i}${Date.now().toString(36)}` })) };
  const { data: copy, error } = await db.from("outreach_campaigns").insert({
    workspace_id: session.workspace.id, created_by: session.userId, owner_id: session.userId, name: String(state.name), description: src?.description ?? null,
    channel: "email" as never, channels: ["email"], language: src?.language ?? "mul", tone: src?.tone ?? "direct", offer_id: src?.offer_id ?? null, objective: src?.objective ?? "meetings", aim: src?.aim ?? "meeting", cta_url: src?.cta_url ?? null, conversion_event: src?.conversion_event ?? null, attribution_days: src?.attribution_days ?? 7,
    target_meetings: src?.target_meetings ?? null, daily_limit: src?.daily_limit ?? null, budget_type: src?.budget_type ?? "total", budget_usd: src?.budget_usd ?? null,
    timezone: src?.timezone ?? null, run_days: src?.run_days, contact_from: src?.contact_from ?? null, contact_to: src?.contact_to ?? null,
    sender_name: src?.sender_name ?? null, instructions: src?.instructions ?? null, wizard: { ...state, mailboxId: src?.mailbox_id ?? null } as unknown as Json,
  }).select("id").single();
  if (error || !copy) return { ok: false, error: t.ws.outreach.errors.name };
  revalidatePath("/campaigns", "layout");
  return { ok: true, id: copy.id, message: t.ag.page.duplicated };
}

/** Deletes a draft that never sent anything. */
export async function deleteDraft(id: string): Promise<OutreachResult> {
  const session = await requireMember();
  if (!canEdit(session)) return await viewOnly() as never;
  const t = await getDictionary();
  if (!uuid.safeParse(id).success) return { ok: false, error: t.ws.outreach.errors.notFound };
  const db = await createClient();
  const { count } = await db.from("outreach_messages").select("id", { count: "exact", head: true }).eq("outreach_campaign_id", id).eq("status", "sent");
  if (count) return { ok: false, error: t.ws.outreach.errors.notFound };
  const { data } = await db.from("outreach_campaigns").delete().eq("id", id).eq("workspace_id", session.workspace.id).eq("status", "draft").select("id");
  if (!data?.length) return { ok: false, error: t.ws.outreach.errors.notFound };
  revalidatePath("/campaigns", "layout");
  return { ok: true };
}
