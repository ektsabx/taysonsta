"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { canManageTeam, requireSession, canEdit, viewOnly } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDictionary } from "@/lib/i18n/server";
import { spentSince } from "@/lib/campaigns/budget";

// The account spending limit (owner, 2026-11-02, D-274), in Settings →
// Billing, like an ads account's: the most the account spends, counted from
// when it was set or last reset. Owners and admins set, reset or remove it;
// searches stop when it's reached (lib/campaigns/budget.ts dailyRoom). The
// daily budget card and "Stop all campaigns" left the dashboard (D-274).

export type LimitResult = { ok: true; message?: string } | { ok: false; error: string };
export interface SpendingLimit { limitUsd: number | null; spentUsd: number; since: string | null; canManage: boolean }

export async function getSpendingLimit(): Promise<SpendingLimit> {
  const session = await requireSession();
  const { data: ws } = await createAdminClient().from("workspaces").select("spending_limit_usd, spending_limit_since").eq("id", session.workspace.id).maybeSingle();
  const limit = ws?.spending_limit_usd == null ? null : Number(ws.spending_limit_usd);
  const since = ws?.spending_limit_since ?? null;
  return { limitUsd: limit, since, spentUsd: limit == null ? 0 : await spentSince(session.workspace.id, since ?? new Date(0).toISOString()), canManage: canManageTeam(session) };
}

export async function setSpendingLimit(usd: number | null): Promise<LimitResult> {
  const session = await requireSession();
  if (!canEdit(session)) return await viewOnly() as never;
  const t = await getDictionary();
  if (!canManageTeam(session)) return { ok: false, error: t.ws.outreach.errors.notFound };
  const p = z.number().min(1).max(10_000_000).nullable().safeParse(usd);
  if (!p.success) return { ok: false, error: t.ag.builder.errors.settings };
  const db = createAdminClient();
  const { data: ws } = await db.from("workspaces").select("spending_limit_since").eq("id", session.workspace.id).maybeSingle();
  const { error } = await db.from("workspaces").update({
    spending_limit_usd: p.data == null ? null : Math.round(p.data * 100) / 100,
    spending_limit_since: p.data == null ? null : ws?.spending_limit_since ?? new Date().toISOString(),
  }).eq("id", session.workspace.id);
  if (error) return { ok: false, error: t.ag.builder.errors.settings };
  revalidatePath("/", "layout");
  return { ok: true, message: t.ag.rx.limit.saved };
}

/** Starts the count again from now (the limit stays). */
export async function resetSpendingLimit(): Promise<LimitResult> {
  const session = await requireSession();
  if (!canEdit(session)) return await viewOnly() as never;
  const t = await getDictionary();
  if (!canManageTeam(session)) return { ok: false, error: t.ws.outreach.errors.notFound };
  await createAdminClient().from("workspaces").update({ spending_limit_since: new Date().toISOString() }).eq("id", session.workspace.id).not("spending_limit_usd", "is", null);
  revalidatePath("/", "layout");
  return { ok: true, message: t.ag.rx.limit.resetDone };
}
