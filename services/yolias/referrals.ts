import "server-only";
import { ydb } from "@/lib/yolias/db";
import { audit } from "@/lib/bos/audit";
import { ValidationError } from "@/lib/bos/errors";
import type { BosUser } from "@/lib/bos/auth";

// Yolias referral program (owner, 2026-10-28): each workspace's invite link
// gives it prospects when a new account signs up through it. The reward and
// the monthly cap live in Yolias site_settings "referral_program", read live
// by Yolias (no deploy needed). Rows: Yolias public.referrals.

export interface ReferralProgram { enabled: boolean; prospects: number; monthlyCap: number }

export async function getReferralProgram(): Promise<ReferralProgram> {
  const { data } = await ydb().from("site_settings").select("value").eq("key", "referral_program").maybeSingle();
  const v = (data?.value ?? {}) as { enabled?: boolean; prospects?: number; monthly_cap?: number };
  return { enabled: v.enabled !== false, prospects: Number.isInteger(v.prospects) ? v.prospects! : 50, monthlyCap: Number.isInteger(v.monthly_cap) ? v.monthly_cap! : 20 };
}

export async function setReferralProgram(bos: BosUser, input: ReferralProgram): Promise<void> {
  if (!Number.isInteger(input.prospects) || input.prospects < 0 || input.prospects > 10_000) throw new ValidationError("عدد العملاء المحتملين غير صالح.", { prospects: "من 0 إلى 10,000" });
  if (!Number.isInteger(input.monthlyCap) || input.monthlyCap < 0 || input.monthlyCap > 1_000) throw new ValidationError("الحد الشهري غير صالح.", { monthly_cap: "من 0 إلى 1,000" });
  const before = await getReferralProgram();
  const value = { enabled: input.enabled, prospects: input.prospects, monthly_cap: input.monthlyCap };
  const { error } = await ydb().from("site_settings").upsert({ key: "referral_program", value, updated_at: new Date().toISOString() });
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.referral_program.update", entityType: "yolias_setting", entityId: null, oldValue: before, newValue: input, metadata: { key: "referral_program" } });
}

export interface ReferralRow { id: string; at: string; status: string; prospects: number; referrer: string; referrerId: string; referred: string }

export async function referralOverview(): Promise<{ total: number; rewarded: number; prospects: number; last30: number; top: { workspaceId: string; name: string; count: number; prospects: number }[]; recent: ReferralRow[] }> {
  const db = ydb();
  const { data, error } = await db.from("referrals").select("id, created_at, status, prospects, referrer_workspace_id, referred_user_id").order("created_at", { ascending: false }).limit(2000);
  if (error) throw error;
  const rows = data ?? [];
  const wsIds = [...new Set(rows.map((r) => r.referrer_workspace_id))];
  const userIds = rows.slice(0, 100).map((r) => r.referred_user_id);
  const [{ data: ws }, { data: people }] = await Promise.all([
    wsIds.length ? db.from("workspaces").select("id, name").in("id", wsIds.slice(0, 1000)) : Promise.resolve({ data: [] }),
    userIds.length ? db.from("profiles").select("id, email").in("id", userIds) : Promise.resolve({ data: [] }),
  ]);
  const wsName = new Map((ws ?? []).map((w: { id: string; name: string | null }) => [w.id, w.name ?? "—"]));
  const email = new Map((people ?? []).map((p: { id: string; email: string }) => [p.id, p.email]));
  const since = Date.now() - 30 * 86_400_000;
  const per = new Map<string, { count: number; prospects: number }>();
  for (const r of rows) if (r.status === "rewarded") { const x = per.get(r.referrer_workspace_id) ?? { count: 0, prospects: 0 }; x.count++; x.prospects += r.prospects; per.set(r.referrer_workspace_id, x); }
  return {
    total: rows.length,
    rewarded: rows.filter((r) => r.status === "rewarded").length,
    prospects: rows.reduce((n, r) => n + r.prospects, 0),
    last30: rows.filter((r) => Date.parse(r.created_at) >= since).length,
    top: [...per.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 10).map(([id, v]) => ({ workspaceId: id, name: wsName.get(id) ?? "—", ...v })),
    recent: rows.slice(0, 100).map((r) => ({ id: r.id, at: r.created_at, status: r.status, prospects: r.prospects, referrer: wsName.get(r.referrer_workspace_id) ?? "—", referrerId: r.referrer_workspace_id, referred: email.get(r.referred_user_id) ?? "—" })),
  };
}

/** One client's referrals, for its file in Admin → Clients. */
export async function workspaceReferrals(workspaceId: string): Promise<{ code: string | null; invited: number; rewarded: number; prospects: number; referredBy: string | null }> {
  const db = ydb();
  const [{ data: w }, { data: rows }, { data: members }] = await Promise.all([
    db.from("workspaces").select("referral_code").eq("id", workspaceId).maybeSingle(),
    db.from("referrals").select("status, prospects").eq("referrer_workspace_id", workspaceId),
    db.from("workspace_members").select("user_id").eq("workspace_id", workspaceId).eq("role", "owner"),
  ]);
  const ownerIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
  const { data: by } = ownerIds.length ? await db.from("referrals").select("referrer_workspace_id").in("referred_user_id", ownerIds).limit(1).maybeSingle() : { data: null };
  const { data: byWs } = by ? await db.from("workspaces").select("name").eq("id", by.referrer_workspace_id).maybeSingle() : { data: null };
  const list = (rows ?? []) as { status: string; prospects: number }[];
  return {
    code: (w as { referral_code?: string } | null)?.referral_code ?? null,
    invited: list.filter((r) => r.status !== "rejected").length,
    rewarded: list.filter((r) => r.status === "rewarded").length,
    prospects: list.reduce((n, r) => n + r.prospects, 0),
    referredBy: by ? ((byWs as { name?: string | null } | null)?.name ?? "—") : null,
  };
}
