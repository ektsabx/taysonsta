import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueue } from "@/lib/jobs/queue";
import { isActive, isFinished } from "@/lib/discovery/states";
import type { CampaignRow, Database } from "@/types/database";

// Campaign controls (final spec phase 6), shared by the app's server actions
// and the Yolias AI tools so both follow the same rules. Always called with
// the member's own client: RLS limits it to their workspace.

export type ControlError = "notFound" | "goal" | "deadline" | "schedule" | "failed" | "notRunning" | "notPaused" | "notScheduled" | "alreadyEnded";
export type ControlResult = { ok: true } | { ok: false; error: ControlError };
type Db = SupabaseClient<Database>;

const uuid = /^[0-9a-f-]{36}$/i;

async function load(db: Db, id: string): Promise<CampaignRow | null> {
  if (!uuid.test(id)) return null;
  const { data } = await db.from("campaigns").select("*").eq("id", id).maybeSingle();
  return data;
}

export async function updateSettings(db: Db, id: string, input: { goal: number; deadline: string | null; continuous: boolean; everyHours: number }): Promise<ControlResult> {
  const c = await load(db, id);
  if (!c) return { ok: false, error: "notFound" };
  if (!Number.isInteger(input.goal) || input.goal < 1 || input.goal > 10_000) return { ok: false, error: "goal" };
  const deadline = input.deadline ? new Date(input.deadline) : null;
  if (deadline && (Number.isNaN(deadline.getTime()) || deadline.getTime() < Date.now())) return { ok: false, error: "deadline" };
  if (input.everyHours !== 24 && input.everyHours !== 168) return { ok: false, error: "schedule" };
  const patch: Partial<CampaignRow> = { quota: input.goal, deadline: deadline?.toISOString() ?? null, continuous: input.continuous, run_every_hours: input.everyHours as 24 | 168 };
  // A finished campaign with a new, higher goal (or now continuous) starts again.
  const reopen = isFinished(c.status) && c.status !== "failed" && input.goal > c.prospects_found && (input.continuous || input.goal > c.quota);
  if (reopen) Object.assign(patch, { status: "scheduled", next_run_at: new Date().toISOString(), completed_at: null, partial_reason: null, stopped_at: null });
  const { error } = await db.from("campaigns").update(patch).eq("id", id);
  return error ? { ok: false, error: "failed" } : { ok: true };
}

export async function pause(db: Db, id: string): Promise<ControlResult> {
  const c = await load(db, id);
  if (!c) return { ok: false, error: "notFound" };
  if (!isActive(c.status) && c.status !== "scheduled" && c.status !== "awaiting_source") return { ok: false, error: "notRunning" };
  // A run in progress notices the pause and stops after the current result.
  await db.from("campaigns").update({ status: "paused", next_run_at: null }).eq("id", id);
  return { ok: true };
}

export async function resume(db: Db, id: string): Promise<ControlResult> {
  const c = await load(db, id);
  if (!c) return { ok: false, error: "notFound" };
  if (c.status !== "paused") return { ok: false, error: "notPaused" };
  await db.from("campaigns").update({ status: "queued" }).eq("id", id);
  await enqueue("campaign.discover", { campaignId: id });
  return { ok: true };
}

/** Runs a scheduled (or waiting) campaign now instead of at its next slot. */
export async function runNow(db: Db, id: string): Promise<ControlResult> {
  const c = await load(db, id);
  if (!c) return { ok: false, error: "notFound" };
  if (!["scheduled", "awaiting_source"].includes(c.status)) return { ok: false, error: "notScheduled" };
  const { data } = await db.from("campaigns").update({ status: "queued", next_run_at: null }).eq("id", id).eq("status", c.status).select("id").maybeSingle();
  if (data) await enqueue("campaign.discover", { campaignId: id });
  return { ok: true };
}

/** Ends the campaign for good: results so far stay; nothing more runs. */
export async function stop(db: Db, id: string): Promise<ControlResult> {
  const c = await load(db, id);
  if (!c) return { ok: false, error: "notFound" };
  if (isFinished(c.status)) return { ok: false, error: "alreadyEnded" };
  const reached = c.prospects_found >= c.quota;
  const now = new Date().toISOString();
  await db.from("campaigns").update({ status: reached ? "completed" : "partial", partial_reason: reached ? null : "stopped", stopped_at: now, completed_at: now, next_run_at: null }).eq("id", id);
  return { ok: true };
}

/**
 * Campaigns paused because the prospects ran out continue by themselves once
 * more are available (a pack bought, a bigger plan). Service role.
 */
export async function resumeQuotaPaused(db: Db, workspaceId: string): Promise<number> {
  const { data } = await db.from("campaigns").update({ status: "queued", partial_reason: null })
    .eq("workspace_id", workspaceId).eq("status", "paused").eq("partial_reason", "quota").select("id");
  for (const c of data ?? []) await enqueue("campaign.discover", { campaignId: c.id });
  return data?.length ?? 0;
}
