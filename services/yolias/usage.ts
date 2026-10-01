import "server-only";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { ydb } from "@/lib/yolias/db";
import { isYoliasPlan, yoliasPlanIds, type YoliasPlan } from "@/lib/yolias/plans";

// Prospect quotas and the usage ledger, from Yolias Admin (docs/06, D-005).
// Quotas change for everyone on the plan from the current month; grants and
// adjustments change one workspace's allowance for the current month. Every
// change is audited.

export type PlanTerms = { plan: YoliasPlan; priceUsd: number; prospects: number; updatedAt: string | null; updatedBy: string | null };

export async function getPlanTerms(): Promise<Record<YoliasPlan, PlanTerms>> {
  const { data, error } = await ydb().from("plan_quotas").select("*");
  if (error) throw error;
  const out = {} as Record<YoliasPlan, PlanTerms>;
  for (const p of yoliasPlanIds) out[p] = { plan: p, priceUsd: 0, prospects: 0, updatedAt: null, updatedBy: null };
  for (const r of data ?? []) {
    if (isYoliasPlan(r.plan)) out[r.plan] = { plan: r.plan, priceUsd: Number(r.price_usd), prospects: r.prospects_per_month, updatedAt: r.updated_at, updatedBy: r.updated_by };
  }
  return out;
}

export async function setPlanQuota(bos: BosUser, plan: string, prospects: number): Promise<void> {
  if (!isYoliasPlan(plan)) throw new ValidationError("خطة غير معروفة.");
  if (!Number.isInteger(prospects) || prospects < 0 || prospects > 1_000_000) throw new ValidationError("الحصة غير صالحة.", { prospects: "عدد صحيح من 0 إلى 1,000,000" });
  const before = (await getPlanTerms())[plan];
  const { error } = await ydb().from("plan_quotas").update({ prospects_per_month: prospects, updated_by: bos.email, updated_at: new Date().toISOString() }).eq("plan", plan);
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.plan_quota.update", entityType: "yolias_plan", entityId: null, oldValue: { prospects: before.prospects }, newValue: { prospects }, metadata: { plan } });
}

export async function workspaceUsage(workspaceId: string) {
  const [{ data: summary, error }, { data: ledger }] = await Promise.all([
    ydb().rpc("usage_summary", { p_ws: workspaceId }),
    ydb().from("usage_ledger").select("id, campaign_id, kind, prospects, period_start, reason, created_by, created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(40),
  ]);
  if (error) throw error;
  return { summary: summary?.[0] ?? null, ledger: ledger ?? [] };
}

/** Adds (grant) or removes (negative adjust) prospects for this month only. */
export async function adjustUsage(bos: BosUser, workspaceId: string, prospects: number, reason: string): Promise<void> {
  if (!Number.isInteger(prospects) || prospects === 0 || Math.abs(prospects) > 1_000_000) throw new ValidationError("العدد غير صالح.", { prospects: "عدد صحيح غير صفري" });
  const why = reason.trim();
  if (why.length < 3 || why.length > 300) throw new ValidationError("السبب مطلوب.", { reason: "مطلوب" });
  const { data: ws } = await ydb().from("workspaces").select("id").eq("id", workspaceId).maybeSingle();
  if (!ws) throw new NotFoundError();
  const now = new Date();
  const period = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const { error } = await ydb().from("usage_ledger").insert({
    workspace_id: workspaceId, kind: prospects > 0 ? "grant" : "adjust", prospects, period_start: period, reason: why, created_by: bos.email,
  });
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.usage.adjust", entityType: "yolias_workspace", entityId: workspaceId, newValue: { prospects, period }, reason: why });
}
