"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { canManageTeam, requireSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDictionary } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import { setCampaignRun } from "@/lib/outreach/execute";

// The dashboard's two controls (owner, 2026-10-31, D-273): the workspace's
// daily budget (owners and admins) and "Stop all campaigns" (pauses every
// running campaign: no sending, no finding people, replies still read).

export type DashResult = { ok: true; message?: string } | { ok: false; error: string };

export async function setDailyBudget(usd: number | null): Promise<DashResult> {
  const session = await requireSession();
  const t = await getDictionary();
  if (!canManageTeam(session)) return { ok: false, error: t.ws.outreach.errors.notFound };
  const p = z.number().min(0).max(100_000).nullable().safeParse(usd);
  if (!p.success) return { ok: false, error: t.ag.builder.errors.settings };
  const { error } = await createAdminClient().from("workspaces").update({ daily_budget_usd: p.data == null ? null : Math.round(p.data * 100) / 100 }).eq("id", session.workspace.id);
  if (error) return { ok: false, error: t.ag.builder.errors.settings };
  revalidatePath("/dashboard");
  return { ok: true, message: t.ag.dash.budgetSaved };
}

export async function stopAllCampaigns(): Promise<DashResult> {
  const session = await requireSession();
  const t = await getDictionary();
  const { data } = await createAdminClient().from("outreach_campaigns").select("id").eq("workspace_id", session.workspace.id).in("status", ["active", "scheduled"]);
  let n = 0;
  for (const c of data ?? []) if (await setCampaignRun(session.workspace.id, c.id, "pause")) n++;
  revalidatePath("/dashboard");
  revalidatePath("/outreach", "layout");
  return { ok: true, message: fmt(t.ag.dash.stopped, { n: String(n) }) };
}
