"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireMember, canEdit, viewOnly } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDictionary } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import { addLeads, type LeadTarget } from "@/lib/crm";
import { lookalike, members, type Lookalike, type SeedKind } from "@/lib/campaigns/audience";
import { targetingSchema } from "@/lib/campaigns/builder";
import { importFields, MAX_IMPORT_ROWS, toImportRow, type ImportField, type ImportKind } from "@/lib/csv-import";
import { CUSTOM_SOURCES, type CustomSource } from "@/lib/campaigns/audience-sources";
import type { Json } from "@/types/database";

// Audiences (owner, 2026-10-31, D-273), a section of its own in the sidebar:
//  - custom: people the workspace already has (a previous campaign, customers,
//    people who booked a meeting, interested people) or a CSV file;
//  - lookalike: the traits a base shares, at an expansion level, with its
//    seed size and confidence; campaigns find companies like these;
//  - saved: a targeting reused in campaigns.
// Building an audience never contacts anyone: a campaign does.

export type AudienceResult<T = object> = ({ ok: true; message?: string } & T) | { ok: false; error: string };
const PATH = "/audiences";

async function sourceLeads(workspaceId: string, source: CustomSource, campaignId: string | null): Promise<string[]> {
  if (source === "previous_campaign" || source === "customers" || source === "imported") return members(workspaceId, source, { campaignId });
  const db = createAdminClient();
  if (source === "meetings") return [...new Set(((await db.from("sales_meetings").select("lead_id").eq("workspace_id", workspaceId).neq("status", "canceled").limit(5000)).data ?? []).map((m) => m.lead_id))];
  if (source === "interested") return ((await db.from("sales_leads").select("id").eq("workspace_id", workspaceId).in("stage", ["interested", "meeting_booked", "meeting_completed", "proposal", "negotiation", "closed"]).limit(5000)).data ?? []).map((l) => l.id);
  return [];
}

/** Preview before building: how many people, how many can be emailed, how many asked not to be contacted. */
export async function previewCustom(source: CustomSource, campaignId: string | null): Promise<AudienceResult<{ total: number; withEmail: number; doNotContact: number }>> {
  const session = await requireMember();
  if (!(CUSTOM_SOURCES as readonly string[]).includes(source)) return { ok: false, error: (await getDictionary()).ag.aud.errors.source };
  const ids = await sourceLeads(session.workspace.id, source, campaignId);
  const { data } = ids.length ? await createAdminClient().from("sales_leads").select("email, do_not_contact").eq("workspace_id", session.workspace.id).in("id", ids.slice(0, 5000)) : { data: [] };
  return { ok: true, total: ids.length, withEmail: (data ?? []).filter((l) => l.email).length, doNotContact: (data ?? []).filter((l) => l.do_not_contact).length };
}

/** (Re)fills a custom audience: one row per person. */
async function fill(workspaceId: string, audienceId: string, ids: string[]): Promise<number> {
  const db = createAdminClient();
  await db.from("audience_members").delete().eq("audience_id", audienceId);
  for (let i = 0; i < ids.length; i += 500) {
    await db.from("audience_members").upsert(ids.slice(i, i + 500).map((lead_id) => ({ audience_id: audienceId, lead_id, workspace_id: workspaceId })), { onConflict: "audience_id,lead_id", ignoreDuplicates: true });
  }
  await db.from("audiences").update({ members: ids.length, updated_at: new Date().toISOString() }).eq("id", audienceId);
  return ids.length;
}

const customInput = z.object({ name: z.string().trim().min(1).max(120), source: z.enum(CUSTOM_SOURCES), campaignId: z.string().uuid().nullable().optional() });

export async function createCustom(input: z.input<typeof customInput>): Promise<AudienceResult<{ id: string }>> {
  const session = await requireMember();
  if (!canEdit(session)) return await viewOnly() as never;
  const t = await getDictionary();
  const p = customInput.safeParse(input);
  if (!p.success) return { ok: false, error: t.ag.aud.errors.name };
  const ids = await sourceLeads(session.workspace.id, p.data.source, p.data.campaignId ?? null);
  if (!ids.length) return { ok: false, error: t.ag.aud.errors.empty };
  const db = await createClient();
  const { data, error } = await db.from("audiences").insert({
    workspace_id: session.workspace.id, created_by: session.userId, kind: "custom", name: p.data.name, targeting: {} as Json,
    origin: { source: p.data.source, campaign_id: p.data.campaignId ?? null } as Json,
  }).select("id").single();
  if (error || !data) return { ok: false, error: t.ag.aud.errors.name };
  const n = await fill(session.workspace.id, data.id, ids);
  revalidatePath(PATH);
  return { ok: true, id: data.id, message: fmt(t.ag.aud.custom.built, { n: String(n) }) };
}

/** A custom audience from a CSV file: the contacts are imported (plan limits apply), then become the audience. */
export async function importAudience(input: { name: string; fileName: string; kind: ImportKind; mapping: Record<ImportField, number>; rows: string[][] }): Promise<AudienceResult<{ id: string }>> {
  const session = await requireMember();
  if (!canEdit(session)) return await viewOnly() as never;
  const t = await getDictionary();
  const e = t.prospects.import.errors;
  const name = String(input.name ?? "").trim().slice(0, 120);
  if (!name) return { ok: false, error: t.ag.aud.errors.name };
  if (!["person", "company", "local_business"].includes(input.kind) || !Array.isArray(input.rows)) return { ok: false, error: t.ag.aud.errors.file };
  if (input.rows.length > MAX_IMPORT_ROWS) return { ok: false, error: e.tooMany };
  const mapping = Object.fromEntries(importFields.map((f) => {
    const v = Number(input.mapping?.[f]);
    return [f, Number.isInteger(v) && v >= 0 && v < 200 ? v : -1];
  })) as Record<ImportField, number>;
  if (mapping.name < 0) return { ok: false, error: e.name };
  const rows = input.rows.filter((r) => Array.isArray(r)).map((r) => toImportRow(r.slice(0, 200).map((c) => String(c ?? "").slice(0, 2000)), mapping, input.kind)).filter((r): r is NonNullable<typeof r> => r !== null);
  if (!rows.length) return { ok: false, error: e.empty };
  const db = await createClient();
  const { data: res, error } = await db.rpc("import_contacts", { p_ws: session.workspace.id, p_name: String(input.fileName ?? "").slice(0, 200) || name, p_rows: rows as unknown as Json });
  const r = (res ?? null) as { ok?: boolean; error?: string; available?: number; campaign_id?: string } | null;
  if (error || !r?.ok || !r.campaign_id) {
    if (r?.error === "limit") return { ok: false, error: fmt(e.limit, { count: String(r.available ?? 0) }) };
    return { ok: false, error: e.failed };
  }
  // The imported people and companies become contacts, then the audience.
  const admin = createAdminClient();
  const [{ data: people }, { data: companies }] = await Promise.all([
    admin.from("prospects").select("id, company_id").eq("workspace_id", session.workspace.id).eq("campaign_id", r.campaign_id).limit(MAX_IMPORT_ROWS),
    admin.from("companies").select("id").eq("workspace_id", session.workspace.id).eq("campaign_id", r.campaign_id).limit(MAX_IMPORT_ROWS),
  ]);
  const withPerson = new Set((people ?? []).map((x) => x.company_id).filter(Boolean));
  const targets: LeadTarget[] = [...(people ?? []).map((x) => ({ kind: "person" as const, id: x.id })), ...(companies ?? []).filter((c) => !withPerson.has(c.id)).map((c) => ({ kind: "company" as const, id: c.id }))];
  const { ids } = await addLeads(db as never, targets, "import");
  const { data: aud, error: ae } = await db.from("audiences").insert({
    workspace_id: session.workspace.id, created_by: session.userId, kind: "custom", name, targeting: {} as Json, origin: { source: "file", file: String(input.fileName ?? "").slice(0, 200), import_id: r.campaign_id } as Json,
  }).select("id").single();
  if (ae || !aud) return { ok: false, error: t.ag.aud.errors.name };
  const n = await fill(session.workspace.id, aud.id, ids);
  revalidatePath(PATH);
  return { ok: true, id: aud.id, message: fmt(t.ag.aud.custom.built, { n: String(n) }) };
}

const lookInput = z.object({ base: z.enum(["customers", "meetings", "interested", "audience"]), audienceId: z.string().uuid().nullable().optional(), expansion: z.number().int().min(1).max(10) });

export async function analyzeLookalike(input: z.input<typeof lookInput>): Promise<AudienceResult<{ lookalike: Lookalike }>> {
  const session = await requireMember();
  const p = lookInput.safeParse(input);
  if (!p.success) return { ok: false, error: (await getDictionary()).ag.aud.errors.source };
  return { ok: true, lookalike: await lookalike(session.workspace.id, p.data.base as SeedKind, p.data.audienceId ?? undefined, p.data.expansion) };
}

export async function createLookalike(input: z.input<typeof lookInput> & { name: string }): Promise<AudienceResult<{ id: string }>> {
  const session = await requireMember();
  if (!canEdit(session)) return await viewOnly() as never;
  const t = await getDictionary();
  const p = lookInput.safeParse(input);
  const name = String(input.name ?? "").trim().slice(0, 120);
  if (!p.success || !name) return { ok: false, error: t.ag.aud.errors.name };
  const l = await lookalike(session.workspace.id, p.data.base as SeedKind, p.data.audienceId ?? undefined, p.data.expansion);
  if (!l.seedSize) return { ok: false, error: t.ag.aud.lookalike.empty };
  const { data, error } = await (await createClient()).from("audiences").insert({
    workspace_id: session.workspace.id, created_by: session.userId, kind: "lookalike", name, targeting: l.targeting as unknown as Json,
    origin: { base: p.data.base, audience_id: p.data.audienceId ?? null, seeds: l.seeds, traits: l.traits } as unknown as Json,
    expansion: p.data.expansion, seed_size: l.seedSize, confidence: l.confidence, members: 0,
  }).select("id").single();
  if (error || !data) return { ok: false, error: t.ag.aud.errors.name };
  revalidatePath(PATH);
  return { ok: true, id: data.id, message: t.ag.aud.saved_ };
}

const savedInput = z.object({ id: z.string().uuid().optional(), kind: z.literal("saved"), name: z.string().trim().min(1).max(120), targeting: targetingSchema.optional() });

/** A saved targeting (from Audiences or from an audience in the campaign builder). */
export async function saveAudience(input: z.input<typeof savedInput>): Promise<AudienceResult<{ id: string }>> {
  const session = await requireMember();
  if (!canEdit(session)) return await viewOnly() as never;
  const t = await getDictionary();
  const p = savedInput.safeParse(input);
  if (!p.success) return { ok: false, error: t.ag.aud.errors.name };
  const db = await createClient();
  const row = { name: p.data.name, kind: "saved" as const, targeting: (p.data.targeting ?? {}) as unknown as Json, origin: {} as Json, updated_at: new Date().toISOString() };
  const { data, error } = p.data.id
    ? await db.from("audiences").update(row).eq("id", p.data.id).eq("workspace_id", session.workspace.id).select("id").single()
    : await db.from("audiences").insert({ ...row, workspace_id: session.workspace.id, created_by: session.userId }).select("id").single();
  if (error || !data) return { ok: false, error: t.ag.aud.errors.name };
  revalidatePath(PATH);
  return { ok: true, id: data.id, message: t.ag.aud.saved_ };
}

export async function renameAudience(id: string, name: string): Promise<AudienceResult> {
  const session = await requireMember();
  if (!canEdit(session)) return await viewOnly() as never;
  const t = await getDictionary();
  const n = name.trim().slice(0, 120);
  if (!z.string().uuid().safeParse(id).success || !n) return { ok: false, error: t.ag.aud.errors.name };
  await (await createClient()).from("audiences").update({ name: n, updated_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", session.workspace.id);
  revalidatePath(PATH);
  return { ok: true, message: t.ag.aud.saved_ };
}

/** Custom: rebuilt from its source. Lookalike: re-learned from its base (same expansion). */
export async function refreshAudience(id: string): Promise<AudienceResult> {
  const session = await requireMember();
  if (!canEdit(session)) return await viewOnly() as never;
  const t = await getDictionary();
  const db = await createClient();
  const { data: a } = await db.from("audiences").select("id, kind, origin, expansion").eq("id", id).eq("workspace_id", session.workspace.id).maybeSingle();
  if (!a) return { ok: false, error: t.ag.aud.errors.source };
  const o = (a.origin ?? {}) as { source?: string; campaign_id?: string | null; base?: SeedKind; audience_id?: string | null };
  if (a.kind === "lookalike" && o.base) {
    const l = await lookalike(session.workspace.id, o.base, o.audience_id ?? undefined, a.expansion ?? 3);
    await db.from("audiences").update({ targeting: l.targeting as unknown as Json, origin: { ...o, seeds: l.seeds, traits: l.traits } as unknown as Json, seed_size: l.seedSize, confidence: l.confidence, updated_at: new Date().toISOString() }).eq("id", a.id);
    revalidatePath(PATH);
    return { ok: true, message: t.ag.aud.saved_ };
  }
  if (a.kind !== "custom" || !o.source || o.source === "file") return { ok: false, error: t.ag.aud.errors.source };
  const n = await fill(session.workspace.id, a.id, await sourceLeads(session.workspace.id, o.source as CustomSource, o.campaign_id ?? null));
  revalidatePath(PATH);
  return { ok: true, message: fmt(t.ag.aud.custom.built, { n: String(n) }) };
}

export async function deleteAudience(id: string): Promise<AudienceResult> {
  const session = await requireMember();
  if (!canEdit(session)) return await viewOnly() as never;
  const t = await getDictionary();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: t.ag.aud.errors.name };
  await (await createClient()).from("audiences").delete().eq("id", id).eq("workspace_id", session.workspace.id);
  revalidatePath(PATH);
  return { ok: true, message: t.ag.aud.deleted };
}
