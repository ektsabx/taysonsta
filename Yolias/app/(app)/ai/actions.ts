"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { canManageTeam, requireSession } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { loadAiSettings } from "@/lib/ai-workspace/server";
import { mergeSettings, settingsInput, type SettingsInput } from "@/lib/ai-workspace/settings";
import type { Json } from "@/types/database";

// AI Workspace (D-196..D-198). Company Knowledge, offers, competitors, the
// agents' settings, Rules & Permissions and Automations are changed by owners
// and admins (checked here and by RLS); Customer Profiles by any member.

export type AiResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const uuid = z.string().uuid();
const text = (max: number) => z.string().trim().max(max).transform((v) => v || null);

async function manager() {
  const session = await requireSession();
  const t = (await getDictionary()).ws;
  return { session, t, allowed: canManageTeam(session) };
}
const dup = (e: { code?: string; message?: string } | null) => e?.code === "23505" || /duplicate key/.test(e?.message ?? "");

// ── Company Knowledge ──
const knowledgeInput = z.object({
  about: text(4000), services: text(4000), products: text(4000), pricing: text(4000), differentiators: text(4000),
  case_studies: text(6000), faqs: text(6000), reply_policy: text(4000),
});
export async function saveKnowledge(input: z.input<typeof knowledgeInput>): Promise<AiResult> {
  const { session, t, allowed } = await manager();
  if (!allowed) return { ok: false, error: t.common.onlyManagers };
  const p = knowledgeInput.safeParse(input);
  if (!p.success) return { ok: false, error: t.common.error };
  const { error } = await (await createClient()).from("workspace_knowledge").upsert({ workspace_id: session.workspace.id, ...p.data, updated_by: session.userId, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: t.common.error };
  revalidatePath("/ai/knowledge");
  return { ok: true };
}

const offerInput = z.object({
  id: z.string().uuid().optional(), name: z.string().trim().min(1).max(160), description: text(3000), problem: text(2000), audience: text(2000),
  benefits: text(2000), price: text(300), terms: text(2000), active: z.boolean().default(true),
});
export async function saveOffer(input: z.input<typeof offerInput>): Promise<AiResult> {
  const { session, t, allowed } = await manager();
  if (!allowed) return { ok: false, error: t.common.onlyManagers };
  const p = offerInput.safeParse(input);
  if (!p.success) return { ok: false, error: t.ai.knowledge.errors.name };
  const { id, ...row } = p.data;
  const db = await createClient();
  const { error } = id
    ? await db.from("business_offers").update(row).eq("id", id).eq("workspace_id", session.workspace.id)
    : await db.from("business_offers").insert({ ...row, workspace_id: session.workspace.id, created_by: session.userId });
  if (error) return { ok: false, error: dup(error) ? t.ai.knowledge.errors.duplicate : t.common.error };
  revalidatePath("/ai/knowledge");
  return { ok: true };
}

const competitorInput = z.object({
  id: z.string().uuid().optional(), name: z.string().trim().min(1).max(160), website: text(300), description: text(3000), strengths: text(3000),
  weaknesses: text(3000), differences: text(3000), notes: text(3000),
});
export async function saveCompetitor(input: z.input<typeof competitorInput>): Promise<AiResult> {
  const { session, t, allowed } = await manager();
  if (!allowed) return { ok: false, error: t.common.onlyManagers };
  const p = competitorInput.safeParse(input);
  if (!p.success) return { ok: false, error: t.ai.knowledge.errors.name };
  const { id, ...row } = p.data;
  const db = await createClient();
  const { error } = id
    ? await db.from("competitors").update(row).eq("id", id).eq("workspace_id", session.workspace.id)
    : await db.from("competitors").insert({ ...row, workspace_id: session.workspace.id, created_by: session.userId });
  if (error) return { ok: false, error: dup(error) ? t.ai.knowledge.errors.duplicate : t.common.error };
  revalidatePath("/ai/knowledge");
  return { ok: true };
}

export async function deleteKnowledgeItem(kind: "offer" | "competitor", id: string): Promise<AiResult> {
  const { session, t, allowed } = await manager();
  if (!allowed) return { ok: false, error: t.common.onlyManagers };
  if (!uuid.safeParse(id).success) return { ok: false, error: t.common.notFound };
  const { error } = await (await createClient()).from(kind === "offer" ? "business_offers" : "competitors").delete().eq("id", id).eq("workspace_id", session.workspace.id);
  if (error) return { ok: false, error: t.common.error };
  revalidatePath("/ai/knowledge");
  return { ok: true };
}

// ── Customer Profiles ──
const list = (max: number) => z.array(z.string().trim().min(1).max(120)).max(max).transform((a) => [...new Set(a)]);
const profileInput = z.object({
  id: z.string().uuid().optional(), name: z.string().trim().min(1).max(120),
  problems: text(3000), benefits: text(3000), usp: text(2000), goals: text(3000), success_stories: text(4000),
  include_keywords: list(50), exclude_keywords: list(50), industries: list(30), job_titles: list(30),
  countries: z.array(z.string().trim().min(2).max(60)).max(50).transform((a) => [...new Set(a.map((c) => (/^[a-z]{2}$/i.test(c) ? c.toUpperCase() : c)))]),
  company_size_min: z.number().int().min(0).max(10_000_000).nullable(), company_size_max: z.number().int().min(0).max(10_000_000).nullable(),
  regions: text(300), budget: text(300), customer_type: z.enum(["b2b", "b2c", "both"]), extra_criteria: text(2000),
});
export async function saveProfile(input: z.input<typeof profileInput>): Promise<AiResult<{ id: string }>> {
  const session = await requireSession();
  const t = (await getDictionary()).ws.ai.profiles.errors;
  const p = profileInput.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.path[0] === "name" ? t.name : (await getDictionary()).ws.common.error };
  if (p.data.company_size_min != null && p.data.company_size_max != null && p.data.company_size_min > p.data.company_size_max) return { ok: false, error: t.size };
  const { id, ...row } = p.data;
  const db = await createClient();
  // The first profile becomes the default.
  const { count } = await db.from("customer_profiles").select("id", { count: "exact", head: true }).eq("workspace_id", session.workspace.id);
  const res = id
    ? await db.from("customer_profiles").update(row).eq("id", id).eq("workspace_id", session.workspace.id).select("id").maybeSingle()
    : await db.from("customer_profiles").insert({ ...row, workspace_id: session.workspace.id, created_by: session.userId, is_default: !count }).select("id").single();
  if (res.error || !res.data) return { ok: false, error: dup(res.error) ? t.duplicate : (await getDictionary()).ws.common.error };
  revalidatePath("/ai/knowledge");
  return { ok: true, id: res.data.id };
}

export async function setDefaultProfile(id: string): Promise<AiResult> {
  const session = await requireSession();
  const t = (await getDictionary()).ws;
  if (!uuid.safeParse(id).success) return { ok: false, error: t.common.notFound };
  const db = await createClient();
  await db.from("customer_profiles").update({ is_default: false }).eq("workspace_id", session.workspace.id).eq("is_default", true);
  const { error } = await db.from("customer_profiles").update({ is_default: true }).eq("id", id).eq("workspace_id", session.workspace.id);
  if (error) return { ok: false, error: t.common.error };
  revalidatePath("/ai/knowledge");
  return { ok: true };
}

export async function deleteProfile(id: string): Promise<AiResult> {
  const session = await requireSession();
  const t = (await getDictionary()).ws;
  if (!uuid.safeParse(id).success) return { ok: false, error: t.common.notFound };
  const { error } = await (await createClient()).from("customer_profiles").delete().eq("id", id).eq("workspace_id", session.workspace.id);
  if (error) return { ok: false, error: t.common.error };
  revalidatePath("/ai/knowledge");
  return { ok: true };
}

// ── AI Agents + Rules & Permissions ──
export async function saveAiSettings(input: SettingsInput): Promise<AiResult> {
  const { session, t, allowed } = await manager();
  if (!allowed) return { ok: false, error: t.common.onlyManagers };
  const p = settingsInput.safeParse(input);
  if (!p.success) return { ok: false, error: t.common.error };
  const next = mergeSettings(await loadAiSettings(session.workspace.id), p.data);
  const { error } = await (await createClient()).from("workspace_ai_settings").upsert({
    workspace_id: session.workspace.id, agents: next.agents as unknown as Json, permissions: next.permissions as unknown as Json,
    limits: next.limits as unknown as Json, escalation: next.escalation as unknown as Json, guidelines: next.guidelines || null, goal: next.goal || null,
    updated_by: session.userId, updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: t.common.error };
  revalidatePath("/ai", "layout");
  return { ok: true };
}
