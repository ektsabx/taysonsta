import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Referral program (owner, 2026-10-28): a workspace's invite link
// (www.yolias.com/i/<code>) gives it prospects that never expire each time
// someone opens it and creates a new Yolias account (50 by default, Yolias
// Admin → Referrals). Separate from Yolias Partners (affiliates, cash).
// Rules, decided here on the server:
//  - only a brand-new account counts, once ever (unique referred user);
//  - joining the inviting workspace's own team doesn't count;
//  - more than the monthly cap of rewarded sign-ups is recorded as "capped", nothing granted;
//  - sign-up runs Cloudflare Turnstile and a confirmed email first, which keeps fake accounts out.

export const REFERRAL_COOKIE = "yl_invite";
export const REFERRAL_DAYS = 30;

export interface ReferralSettings { enabled: boolean; prospects: number; monthlyCap: number }

export async function referralSettings(): Promise<ReferralSettings> {
  const { data } = await createAdminClient().from("site_settings").select("value").eq("key", "referral_program").maybeSingle();
  const v = (data?.value ?? {}) as { enabled?: boolean; prospects?: number; monthly_cap?: number };
  const n = (x: unknown, d: number) => (Number.isInteger(x) && (x as number) >= 0 ? (x as number) : d);
  return { enabled: v.enabled !== false, prospects: n(v.prospects, 50), monthlyCap: n(v.monthly_cap, 20) };
}

export const validReferralCode = (code: string) => /^[a-z0-9]{6,20}$/.test(code);

/** The workspace behind an invite code, if the program is on. */
export async function referrerByCode(code: string): Promise<{ id: string; name: string | null } | null> {
  if (!validReferralCode(code)) return null;
  const { data } = await createAdminClient().from("workspaces").select("id, name").eq("referral_code", code).maybeSingle();
  return data;
}

const monthStart = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)); };

/** A new account was created after opening an invite link: record it and reward the inviting workspace. */
export async function recordReferral(userId: string, code: string, ip: string | null): Promise<{ status: "rewarded" | "capped" | "rejected" | "skipped" }> {
  const settings = await referralSettings();
  if (!settings.enabled) return { status: "skipped" };
  const referrer = await referrerByCode(code);
  if (!referrer) return { status: "skipped" };
  const db = createAdminClient();
  const { data: already } = await db.from("referrals").select("id").eq("referred_user_id", userId).maybeSingle();
  if (already) return { status: "skipped" };
  const { data: memberships } = await db.from("workspace_members").select("workspace_id, role").eq("user_id", userId);
  const own = (memberships ?? []).find((m) => m.role === "owner")?.workspace_id ?? memberships?.[0]?.workspace_id ?? null;
  let status: "rewarded" | "capped" | "rejected" = "rewarded";
  let reason: string | null = null;
  if ((memberships ?? []).some((m) => m.workspace_id === referrer.id)) { status = "rejected"; reason = "same_workspace"; }
  else {
    const { count } = await db.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_workspace_id", referrer.id).eq("status", "rewarded").gte("created_at", monthStart().toISOString());
    if ((count ?? 0) >= settings.monthlyCap) { status = "capped"; reason = "monthly_cap"; }
  }
  const prospects = status === "rewarded" ? settings.prospects : 0;
  const { data: row, error } = await db.from("referrals").insert({
    referrer_workspace_id: referrer.id, referred_user_id: userId, referred_workspace_id: own, status, reason, prospects, signup_ip: ip,
  }).select("id").single();
  if (error || !row) return { status: "skipped" }; // a parallel sign-in already recorded it
  if (status === "rewarded" && prospects > 0) {
    await db.from("usage_ledger").insert({
      workspace_id: referrer.id, kind: "grant", prospects, period_start: monthStart().toISOString().slice(0, 10), reason: `referral:${row.id}`, created_by: "referral",
    });
    // Its owners and admins hear about it.
    const { data: admins } = await db.from("workspace_members").select("user_id").eq("workspace_id", referrer.id).in("role", ["owner", "admin"]);
    const { data: langs } = admins?.length ? await db.from("profiles").select("id, language").in("id", admins.map((a) => a.user_id)) : { data: [] };
    for (const a of admins ?? []) {
      const ar = langs?.find((p) => p.id === a.user_id)?.language === "ar";
      await db.from("notifications").insert({
        user_id: a.user_id, workspace_id: referrer.id, kind: "referral",
        title: ar ? `انضم شخص عبر رابط دعوتك: +${prospects} عميل محتمل` : `Someone joined with your invite link: +${prospects} prospects`,
        body: ar ? "أضفناها إلى رصيدك، ولا تنتهي صلاحيتها." : "They're in your balance and never expire.",
        link: "/?settings=referral", dedupe_key: `referral:${row.id}:${a.user_id}`,
      }).then(({ error: e }) => e && console.error("[referral] notify", e.message));
    }
  }
  return { status };
}
