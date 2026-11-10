import "server-only";
import { ydb } from "@/lib/yolias/db";
import { audit } from "@/lib/bos/audit";
import { ValidationError } from "@/lib/bos/errors";
import type { BosUser } from "@/lib/bos/auth";

// Yolias referral program (owner, 2026-10-28): each workspace's invite link
// gives it prospects when a new account signs up through it. The reward and
// the monthly cap live in Yolias site_settings "referral_program", read live
// by Yolias (no deploy needed). Rows: Yolias public.referrals.

// Owner, 2026-11-10: the reward is credit in dollars ($5 by default). Yolias adds it as leads at its credit price.
export interface ReferralProgram { enabled: boolean; usd: number; monthlyCap: number }

async function creditRate(): Promise<number> {
  const { data } = await ydb().from("site_settings").select("value").eq("key", "credits").maybeSingle();
  const v = Number((data?.value as { usd_per_prospect?: number } | null)?.usd_per_prospect);
  return Number.isFinite(v) && v > 0 ? v : 0.1;
}
export const leadsFor = async (usd: number) => Math.round(usd / (await creditRate()));
export const usdFor = async (leads: number) => Math.round(leads * (await creditRate()) * 100) / 100;

export async function getReferralProgram(): Promise<ReferralProgram> {
  const { data } = await ydb().from("site_settings").select("value").eq("key", "referral_program").maybeSingle();
  const v = (data?.value ?? {}) as { enabled?: boolean; usd?: number; monthly_cap?: number };
  return { enabled: v.enabled !== false, usd: typeof v.usd === "number" && v.usd >= 0 ? v.usd : 5, monthlyCap: Number.isInteger(v.monthly_cap) ? v.monthly_cap! : 20 };
}

export async function setReferralProgram(bos: BosUser, input: ReferralProgram): Promise<void> {
  if (!Number.isFinite(input.usd) || input.usd < 0 || input.usd > 1_000) throw new ValidationError("المكافأة بالدولار غير صالحة.", { usd: "من 0 إلى 1000" });
  if (!Number.isInteger(input.monthlyCap) || input.monthlyCap < 0 || input.monthlyCap > 1_000) throw new ValidationError("الحد الشهري غير صالح.", { monthly_cap: "من 0 إلى 1000" });
  const before = await getReferralProgram();
  const value = { enabled: input.enabled, usd: Math.round(input.usd * 100) / 100, monthly_cap: input.monthlyCap };
  const { error } = await ydb().from("site_settings").upsert({ key: "referral_program", value, updated_at: new Date().toISOString() });
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.referral_program.update", entityType: "yolias_setting", entityId: null, oldValue: before, newValue: input, metadata: {} });
}

export interface ReferralRow { id: string; at: string; status: string; reason: string | null; signals: string[]; ip: string | null; prospects: number; referrer: string; referrerId: string; referred: string }

export async function referralOverview(): Promise<{ total: number; rewarded: number; prospects: number; last30: number; top: { workspaceId: string; name: string; count: number; prospects: number }[]; recent: ReferralRow[] }> {
  const db = ydb();
  const { data, error } = await db.from("referrals").select("id, created_at, status, reason, signals, signup_ip, prospects, referrer_workspace_id, referred_user_id").order("created_at", { ascending: false }).limit(2000);
  if (error) throw error;
  const rows = data ?? [];
  const wsIds = [...new Set(rows.map((r) => r.referrer_workspace_id))];
  const shown = [...rows.filter((r) => r.status === "review"), ...rows.filter((r) => r.status !== "review").slice(0, 100)];
  const userIds = shown.map((r) => r.referred_user_id);
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
    recent: shown.map((r) => ({ id: r.id, at: r.created_at, status: r.status, reason: r.reason, signals: Array.isArray(r.signals) ? (r.signals as string[]) : [], ip: r.signup_ip, prospects: r.prospects, referrer: wsName.get(r.referrer_workspace_id) ?? "—", referrerId: r.referrer_workspace_id, referred: email.get(r.referred_user_id) ?? "—" })),
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

/**
 * A referral held for review (D-273: a second sign-up from one network, or a
 * burst for one link): approving grants the reward as the program says now
 * and tells the workspace; rejecting records it. Both are audited.
 */
export async function decideReferral(bos: BosUser, id: string, decision: "approve" | "reject"): Promise<void> {
  const db = ydb();
  const { data: r } = await db.from("referrals").select("id, status, referrer_workspace_id").eq("id", id).maybeSingle();
  if (!r || r.status !== "review") throw new ValidationError("هذه الإحالة ليست قيد المراجعة.", {});
  const program = await getReferralProgram();
  const prospects = decision === "approve" ? await leadsFor(program.usd) : 0;
  const { data: moved } = await db.from("referrals").update({ status: decision === "approve" ? "rewarded" : "rejected", prospects, decided_at: new Date().toISOString(), decided_by: bos.userId })
    .eq("id", id).eq("status", "review").select("id");
  if (!moved?.length) return;
  if (decision === "approve" && prospects > 0) {
    const month = new Date(); month.setUTCDate(1);
    await db.from("usage_ledger").insert({ workspace_id: r.referrer_workspace_id, kind: "grant", prospects, period_start: month.toISOString().slice(0, 10), reason: `referral:${id}`, created_by: "referral" });
    const { data: admins } = await db.from("workspace_members").select("user_id").eq("workspace_id", r.referrer_workspace_id).in("role", ["owner", "admin"]);
    for (const a of admins ?? []) {
      await db.from("notifications").insert({
        user_id: a.user_id, workspace_id: r.referrer_workspace_id, kind: "referral", title: `Someone joined with your invite link: +$${program.usd} credit`, body: "It's in your balance and never expires.", link: "/?settings=referral", dedupe_key: `referral:${id}:${a.user_id}`,
      });
    }
  }
  await audit({ actorId: bos.userId, action: `yolias.referral.${decision}`, entityType: "yolias_referral", entityId: id, oldValue: { status: "review" }, newValue: { status: decision === "approve" ? "rewarded" : "rejected", prospects }, metadata: {} });
}
