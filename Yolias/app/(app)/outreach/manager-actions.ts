"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDictionary } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import { setCampaignRun } from "@/lib/outreach/execute";
import { logCampaign } from "@/lib/campaigns/activity";
import { cleanColumns } from "@/lib/campaigns/metrics";
import { duplicateCampaign } from "./actions";
import type { Json } from "@/types/database";

// The Campaigns table's actions (owner, 2026-10-31, D-272): one or many
// campaigns at once, rename, edit shared fields, and saved views. Everything
// as the member (RLS); running state changes go through setCampaignRun, so a
// bulk pause is exactly a pause, logged per campaign.

export type ManagerResult<T = object> = ({ ok: true; message?: string } & T) | { ok: false; error: string };
const ids = z.array(z.string().uuid()).min(1).max(200);

/** Pause / resume / archive / delete / duplicate several campaigns. Delete removes drafts that never sent; the rest is archived instead. */
export async function bulkCampaigns(campaignIds: string[], action: "pause" | "resume" | "archive" | "delete" | "duplicate"): Promise<ManagerResult<{ done: number; skipped: number }>> {
  const session = await requireSession();
  const t = await getDictionary();
  const m = t.camp.manager;
  const p = ids.safeParse(campaignIds);
  if (!p.success || !["pause", "resume", "archive", "delete", "duplicate"].includes(action)) return { ok: false, error: m.errors.select };
  const db = await createClient();
  const { data: rows } = await db.from("outreach_campaigns").select("id, status").eq("workspace_id", session.workspace.id).in("id", p.data);
  let done = 0, skipped = 0;
  for (const c of rows ?? []) {
    let ok = false;
    if (action === "pause" || action === "resume") ok = await setCampaignRun(session.workspace.id, c.id, action);
    else if (action === "archive") ok = await setCampaignRun(session.workspace.id, c.id, "cancel");
    else if (action === "duplicate") ok = (await duplicateCampaign(c.id)).ok;
    else {
      // Delete (D-272): only a draft that never sent anything; a campaign with history is archived, never erased.
      const { count } = await db.from("outreach_messages").select("id", { count: "exact", head: true }).eq("outreach_campaign_id", c.id).eq("status", "sent");
      if (c.status === "draft" && !count) ok = !(await db.from("outreach_campaigns").delete().eq("id", c.id)).error;
    }
    if (ok) done++; else skipped++;
  }
  revalidatePath("/outreach", "layout");
  revalidatePath("/dashboard");
  const msg = action === "delete" && skipped ? fmt(m.deletedSome, { done: String(done), skipped: String(skipped) }) : fmt(m.done, { n: String(done) });
  return { ok: true, done, skipped, message: msg };
}

export async function renameCampaign(id: string, name: string): Promise<ManagerResult> {
  const session = await requireSession();
  const t = await getDictionary();
  const n = name.trim().slice(0, 160);
  if (!z.string().uuid().safeParse(id).success || !n) return { ok: false, error: t.ws.outreach.errors.name };
  const db = await createClient();
  const { data, error } = await db.from("outreach_campaigns").update({ name: n }).eq("id", id).eq("workspace_id", session.workspace.id).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: t.ws.outreach.errors.notFound };
  revalidatePath("/outreach", "layout");
  return { ok: true };
}

const sharedEdit = z.object({
  ownerId: z.string().uuid().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  dailyLimit: z.number().int().min(1).max(500).nullable().optional(),
  budgetUsd: z.number().min(0).max(1_000_000).nullable().optional(),
}).strict();

/** Edit the same fields on several campaigns; fields left out keep each campaign's own value. */
export async function bulkEdit(campaignIds: string[], patch: z.input<typeof sharedEdit>): Promise<ManagerResult<{ done: number }>> {
  const session = await requireSession();
  const t = await getDictionary();
  const p = ids.safeParse(campaignIds), q = sharedEdit.safeParse(patch);
  if (!p.success || !q.success) return { ok: false, error: t.camp.manager.errors.select };
  const v = q.data;
  if (v.endsAt && Date.parse(v.endsAt) <= Date.now()) return { ok: false, error: t.camp.wizard.errors.dates };
  if (v.ownerId) {
    const { data: member } = await createAdminClient().from("workspace_members").select("user_id").eq("workspace_id", session.workspace.id).eq("user_id", v.ownerId).maybeSingle();
    if (!member) return { ok: false, error: t.camp.manager.errors.owner };
  }
  const row: Record<string, unknown> = {};
  if (v.ownerId !== undefined) row.owner_id = v.ownerId;
  if (v.endsAt !== undefined) row.ends_at = v.endsAt;
  if (v.dailyLimit !== undefined) row.daily_limit = v.dailyLimit;
  if (v.budgetUsd !== undefined) row.budget_usd = v.budgetUsd;
  if (!Object.keys(row).length) return { ok: false, error: t.camp.manager.errors.nothing };
  const db = await createClient();
  const { data, error } = await db.from("outreach_campaigns").update(row as never).eq("workspace_id", session.workspace.id).in("id", p.data).not("status", "in", "(archived,completed)").select("id");
  if (error) return { ok: false, error: t.camp.wizard.errors.settings };
  const admin = createAdminClient();
  for (const c of data ?? []) await logCampaign(admin, session.workspace.id, c.id, "note", "Settings changed (bulk edit).", { by: session.userId, fields: Object.keys(row) });
  revalidatePath("/outreach", "layout");
  return { ok: true, done: data?.length ?? 0, message: fmt(t.camp.manager.done, { n: String(data?.length ?? 0) }) };
}

const viewConfig = z.object({
  columns: z.array(z.string()).max(40),
  pinned: z.array(z.string()).max(10).default([]),
  filters: z.record(z.string(), z.unknown()).default({}),
  range: z.string().max(20).default("lifetime"),
  from: z.string().max(10).optional(),
  to: z.string().max(10).optional(),
  sort: z.string().max(40).optional(),
  breakdown: z.enum(["none", "audience"]).default("none"),
});

export async function saveView(name: string, config: z.input<typeof viewConfig>): Promise<ManagerResult<{ id: string }>> {
  const session = await requireSession();
  const t = await getDictionary();
  const n = name.trim().slice(0, 80), c = viewConfig.safeParse(config);
  if (!n || !c.success) return { ok: false, error: t.camp.manager.errors.view };
  const db = await createClient();
  const { data, error } = await db.from("campaign_views").insert({
    workspace_id: session.workspace.id, user_id: session.userId, scope: "campaigns", name: n,
    config: { ...c.data, columns: cleanColumns(c.data.columns), pinned: cleanColumns(c.data.pinned) } as unknown as Json,
  }).select("id").single();
  if (error || !data) return { ok: false, error: t.camp.manager.errors.view };
  revalidatePath("/outreach");
  return { ok: true, id: data.id, message: t.camp.manager.viewSaved };
}

export async function deleteView(id: string): Promise<ManagerResult> {
  const session = await requireSession();
  const t = await getDictionary();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: t.camp.manager.errors.view };
  const db = await createClient();
  await db.from("campaign_views").delete().eq("id", id).eq("user_id", session.userId);
  revalidatePath("/outreach");
  return { ok: true };
}
