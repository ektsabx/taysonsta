import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

// Referral program (owner, 2026-10-28): a workspace's invite link
// (www.yolias.com/i/<code>) gives it prospects that never expire each time
// someone opens it and creates a new Yolias account (50 by default, Yolias
// Admin → Referrals). Separate from Yolias Partners (affiliates, cash).
// Rules, decided here on the server:
//  - only a brand-new account counts, once ever (unique referred user);
//  - joining the inviting workspace's own team doesn't count, nor referring
//    yourself (the same email under another spelling) or a disposable inbox;
//  - one rewarded account per network (IP) (owner, 2026-10-31, D-273): a
//    second sign-up from an IP that already brought a referral, or a burst of
//    sign-ups for one link in a day, is held for Yolias Admin to review
//    ("review", nothing granted until approved). An IP alone never rejects:
//    people in one office or on one mobile network share it;
//  - more than the monthly cap of rewarded sign-ups is recorded as "capped", nothing granted;
//  - sign-up runs Cloudflare Turnstile and a confirmed email first, which keeps fake accounts out.
// Every decision stores its signals, so Admin can see why.

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

export type ReferralSignal = "same_workspace" | "self_referral" | "disposable_email" | "ip_used" | "burst";
export type ReferralStatus = "rewarded" | "capped" | "rejected" | "review";

/** Pure: the decision from the signals (unit-tested). Hard signals reject, soft ones hold for review, the cap comes last. */
export function referralDecision(signals: ReferralSignal[], capReached: boolean): { status: ReferralStatus; reason: string | null } {
  const hard = signals.find((x) => x === "same_workspace" || x === "self_referral" || x === "disposable_email");
  if (hard) return { status: "rejected", reason: hard };
  const soft = signals.find((x) => x === "ip_used" || x === "burst");
  if (soft) return { status: "review", reason: soft };
  if (capReached) return { status: "capped", reason: "monthly_cap" };
  return { status: "rewarded", reason: null };
}

/** The same mailbox under another spelling: Gmail ignores dots and "+tags". */
export function sameInbox(a: string, b: string): boolean {
  const norm = (e: string) => {
    const [user, domain] = e.trim().toLowerCase().split("@");
    if (!user || !domain) return e.trim().toLowerCase();
    const d = domain === "googlemail.com" ? "gmail.com" : domain;
    const u = user.split("+")[0];
    return `${d === "gmail.com" ? u.replace(/\./g, "") : u}@${d}`;
  };
  return norm(a) === norm(b);
}

const DAY = 86_400_000;

/** A new account was created after opening an invite link: record it and reward the inviting workspace. */
export async function recordReferral(userId: string, code: string, ip: string | null): Promise<{ status: ReferralStatus | "skipped" }> {
  const settings = await referralSettings();
  if (!settings.enabled) return { status: "skipped" };
  const referrer = await referrerByCode(code);
  if (!referrer) return { status: "skipped" };
  const db = createAdminClient();
  const { data: already } = await db.from("referrals").select("id").eq("referred_user_id", userId).maybeSingle();
  if (already) return { status: "skipped" };
  const { data: memberships } = await db.from("workspace_members").select("workspace_id, role").eq("user_id", userId);
  const own = (memberships ?? []).find((m) => m.role === "owner")?.workspace_id ?? memberships?.[0]?.workspace_id ?? null;

  const signals: ReferralSignal[] = [];
  if ((memberships ?? []).some((m) => m.workspace_id === referrer.id)) signals.push("same_workspace");
  const { data: me } = await db.from("profiles").select("email").eq("id", userId).maybeSingle();
  const { data: team } = await db.from("workspace_members").select("user_id").eq("workspace_id", referrer.id);
  const { data: teamEmails } = team?.length ? await db.from("profiles").select("email").in("id", team.map((x) => x.user_id)) : { data: [] };
  if (me?.email && (teamEmails ?? []).some((x) => x.email && sameInbox(x.email, me.email))) signals.push("self_referral");
  if (me?.email && (await db.rpc("email_domain_blocked", { p_email: me.email.trim().toLowerCase() })).data === true) signals.push("disposable_email");
  if (ip) {
    const { count } = await db.from("referrals").select("id", { count: "exact", head: true }).eq("signup_ip", ip).in("status", ["rewarded", "review"]).gte("created_at", new Date(Date.now() - 180 * DAY).toISOString());
    if (count) signals.push("ip_used");
  }
  const { count: lastDay } = await db.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_workspace_id", referrer.id).gte("created_at", new Date(Date.now() - DAY).toISOString());
  if ((lastDay ?? 0) >= 3) signals.push("burst");
  const { count: month } = await db.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_workspace_id", referrer.id).eq("status", "rewarded").gte("created_at", monthStart().toISOString());
  const { status, reason } = referralDecision(signals, (month ?? 0) >= settings.monthlyCap);

  const prospects = status === "rewarded" ? settings.prospects : 0;
  const { data: row, error } = await db.from("referrals").insert({
    referrer_workspace_id: referrer.id, referred_user_id: userId, referred_workspace_id: own, status, reason, prospects, signup_ip: ip, signals: signals as unknown as Json,
  }).select("id").single();
  if (error || !row) return { status: "skipped" }; // a parallel sign-in already recorded it
  if (status === "rewarded" && prospects > 0) await grantReferral(db, row.id, referrer.id, prospects);
  return { status };
}

/** The reward: prospects that never expire, and a notice to the workspace's owners and admins. */
export async function grantReferral(db: ReturnType<typeof createAdminClient>, referralId: string, workspaceId: string, prospects: number) {
  await db.from("usage_ledger").insert({
    workspace_id: workspaceId, kind: "grant", prospects, period_start: monthStart().toISOString().slice(0, 10), reason: `referral:${referralId}`, created_by: "referral",
  });
  const { data: admins } = await db.from("workspace_members").select("user_id").eq("workspace_id", workspaceId).in("role", ["owner", "admin"]);
  const { data: langs } = admins?.length ? await db.from("profiles").select("id, language").in("id", admins.map((a) => a.user_id)) : { data: [] };
  for (const a of admins ?? []) {
    const ar = langs?.find((p) => p.id === a.user_id)?.language === "ar";
    await db.from("notifications").insert({
      user_id: a.user_id, workspace_id: workspaceId, kind: "referral",
      title: ar ? `انضم شخص عبر رابط دعوتك: +${prospects} عميل محتمل` : `Someone joined with your invite link: +${prospects} prospects`,
      body: ar ? "أضفناها إلى رصيدك، ولا تنتهي صلاحيتها." : "They're in your balance and never expire.",
      link: "/?settings=referral", dedupe_key: `referral:${referralId}:${a.user_id}`,
    }).then(({ error: e }) => e && console.error("[referral] notify", e.message));
  }
}
