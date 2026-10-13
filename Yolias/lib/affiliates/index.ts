import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashIp } from "@/lib/support/messages";
import type { AffiliateBalances, AffiliateCommissionRow, AffiliatePayoutRow, AffiliateRow } from "@/types/database";
import { CODE_RE, parseProgramSettings, type Program } from "./program";

// Affiliate program, member side (docs/12 D-178). Every read and write runs on
// the server with the service role, always filtered by the signed-in user's
// own affiliate row; amounts and statuses only change inside the database
// functions (supabase/migrations/20261109000000_affiliates.sql).

type Db = ReturnType<typeof createAdminClient>;

export async function currentProgram(db: Db = createAdminClient()): Promise<(Program & { terms: string }) | null> {
  const { data } = await db.from("affiliate_program_versions").select("id, settings, terms_version, terms_text").order("id", { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  return { versionId: data.id, termsVersion: data.terms_version, terms: data.terms_text, settings: parseProgramSettings(data.settings) };
}

export async function affiliateFor(userId: string, db: Db = createAdminClient()): Promise<AffiliateRow | null> {
  const { data } = await db.from("affiliates").select("*").eq("user_id", userId).maybeSingle();
  return data;
}

function newCode(): string {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((b) => abc[b % abc.length]).join("");
}

export type ApplyResult = { ok: true; status: AffiliateRow["status"] } | { ok: false; error: "closed" | "exists" | "terms" | "answers" | "failed"; field?: string };

/** One partner account per user; approved at once, no application questions (owner, 2026-10-13, D-206). */
export async function applyAffiliate(user: { id: string; email: string }, input: { answers: Record<string, string>; acceptedTerms: string | null; ip: string | null }): Promise<ApplyResult> {
  const db = createAdminClient();
  const program = await currentProgram(db);
  if (!program?.settings.enabled) return { ok: false, error: "closed" };
  if (input.acceptedTerms !== program.termsVersion) return { ok: false, error: "terms" };
  const answers: Record<string, string> = {};
  if (await affiliateFor(user.id, db)) return { ok: false, error: "exists" };
  const status = "approved" as const;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await db.from("affiliates").insert({
      user_id: user.id, email: user.email, code: newCode(), status, answers, terms_version: program.termsVersion, terms_accepted_at: new Date().toISOString(),
      program_version_id: program.versionId, ip_hash: hashIp(input.ip), decided_at: status === "approved" ? new Date().toISOString() : null, decided_by: status === "approved" ? "auto" : null,
    }).select("id").single();
    if (data) {
      await db.rpc("affiliate_log", { p_affiliate: data.id, p_actor: `user:${user.id}`, p_action: "affiliate.applied", p_type: "affiliate", p_id: data.id, p_before: null, p_after: { status, terms_version: program.termsVersion } });
      return { ok: true, status };
    }
    // 23505 on user_id: applied twice at once. On code: try another code.
    if (error?.code === "23505" && /user_id/.test(error.message)) return { ok: false, error: "exists" };
    if (error?.code !== "23505") break;
  }
  return { ok: false, error: "failed" };
}

export async function affiliateByCode(code: string, db: Db = createAdminClient()) {
  if (!CODE_RE.test(code)) return null;
  const { data } = await db.from("affiliates").select("id, status").eq("code", code).maybeSingle();
  return data;
}

/**
 * A click on a referral link. One visit per network per affiliate per 30
 * minutes (reloads and bots hammering a link don't inflate the count).
 * Returns the visit to store in the cookie, or the recent one.
 */
export async function recordVisit(affiliateId: string, meta: { ip: string | null; path: string; campaign: string | null; referrer: string | null }): Promise<string | null> {
  const db = createAdminClient();
  const ipHash = hashIp(meta.ip);
  if (ipHash) {
    const since = new Date(Date.now() - 30 * 60_000).toISOString();
    const { data: recent } = await db.from("affiliate_visits").select("id").eq("affiliate_id", affiliateId).eq("ip_hash", ipHash).gte("created_at", since).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (recent) return recent.id;
  }
  let referrerHost: string | null = null;
  try {
    referrerHost = meta.referrer ? new URL(meta.referrer).host.slice(0, 200) : null;
  } catch {
    referrerHost = null;
  }
  const campaign = meta.campaign && /^[A-Za-z0-9_.-]{1,60}$/.test(meta.campaign) ? meta.campaign : null;
  const { data } = await db.from("affiliate_visits").insert({ affiliate_id: affiliateId, ip_hash: ipHash, landing_path: meta.path.slice(0, 300), campaign, referrer_host: referrerHost }).select("id").single();
  return data?.id ?? null;
}

/** Called right after sign-in: links a new account to the visit in its cookie. Never throws. */
export async function attributeSignup(userId: string, visitId: string | undefined, ip: string | null): Promise<void> {
  if (!visitId || !/^[0-9a-f-]{36}$/i.test(visitId)) return;
  try {
    await createAdminClient().rpc("affiliate_attribute_signup", { p_user: userId, p_visit: visitId, p_ip_hash: hashIp(ip) });
  } catch (e) {
    console.error("[affiliates] attribution", e);
  }
}

export async function visitAffiliate(visitId: string): Promise<{ affiliateId: string; at: string } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(visitId)) return null;
  const { data } = await createAdminClient().from("affiliate_visits").select("affiliate_id, created_at").eq("id", visitId).maybeSingle();
  return data ? { affiliateId: data.affiliate_id, at: data.created_at } : null;
}

export interface ReferralView {
  id: string;
  /** Never the customer's name or email: a short reference only. */
  label: string;
  signedUpAt: string;
  paying: boolean;
  campaign: string | null;
}

export interface Dashboard {
  balances: AffiliateBalances;
  stats: { visits: number; signups: number; paying: number };
  commissions: AffiliateCommissionRow[];
  commissionPages: number;
  payouts: AffiliatePayoutRow[];
  referrals: ReferralView[];
  campaigns: { campaign: string; visits: number; signups: number }[];
}

const PAGE = 20;

export async function dashboard(affiliateId: string, f: { since: string; page: number }): Promise<Dashboard> {
  const db = createAdminClient();
  const [{ data: bal }, { data: stats }, { data: commissions, count }, { data: payouts }, { data: refs }, { data: visits }] = await Promise.all([
    db.rpc("affiliate_balances", { p_affiliate: affiliateId }),
    db.rpc("affiliate_stats", { p_affiliate: affiliateId, p_since: f.since }),
    db.from("affiliate_commissions").select("*", { count: "exact" }).eq("affiliate_id", affiliateId).gte("created_at", f.since)
      .order("created_at", { ascending: false }).range((f.page - 1) * PAGE, f.page * PAGE - 1),
    db.from("affiliate_payouts").select("*").eq("affiliate_id", affiliateId).order("requested_at", { ascending: false }).limit(20),
    db.from("affiliate_referrals").select("id, created_at, campaign, status").eq("affiliate_id", affiliateId).eq("status", "active").gte("created_at", f.since).order("created_at", { ascending: false }).limit(50),
    db.from("affiliate_visits").select("campaign").eq("affiliate_id", affiliateId).gte("created_at", f.since).limit(10_000),
  ]);
  const refIds = (refs ?? []).map((r) => r.id);
  const { data: paid } = refIds.length
    ? await db.from("affiliate_commissions").select("referral_id").in("referral_id", refIds).eq("kind", "payment").neq("status", "rejected")
    : { data: [] as { referral_id: string | null }[] };
  const payingSet = new Set((paid ?? []).map((p) => p.referral_id));
  const byCampaign = new Map<string, { visits: number; signups: number }>();
  for (const v of visits ?? []) {
    const k = v.campaign ?? "";
    byCampaign.set(k, { visits: (byCampaign.get(k)?.visits ?? 0) + 1, signups: byCampaign.get(k)?.signups ?? 0 });
  }
  for (const r of refs ?? []) {
    const k = r.campaign ?? "";
    byCampaign.set(k, { visits: byCampaign.get(k)?.visits ?? 0, signups: (byCampaign.get(k)?.signups ?? 0) + 1 });
  }
  const zero: AffiliateBalances = { pending_cents: 0, approved_cents: 0, available_cents: 0, processing_cents: 0, paid_cents: 0, reversed_cents: 0, rejected_cents: 0, on_hold_cents: 0 };
  const b = bal?.[0] ?? zero;
  const num = (v: unknown) => Number(v ?? 0);
  return {
    balances: Object.fromEntries(Object.entries({ ...zero, ...b }).map(([k, v]) => [k, num(v)])) as AffiliateBalances,
    stats: { visits: num(stats?.[0]?.visits), signups: num(stats?.[0]?.signups), paying: num(stats?.[0]?.paying) },
    commissions: (commissions ?? []).map((c) => ({ ...c, amount_cents: num(c.amount_cents), base_cents: num(c.base_cents) })),
    commissionPages: Math.max(1, Math.ceil((count ?? 0) / PAGE)),
    payouts: (payouts ?? []).map((p) => ({ ...p, amount_cents: num(p.amount_cents) })),
    referrals: (refs ?? []).map((r) => ({ id: r.id, label: `#${r.id.slice(0, 6).toUpperCase()}`, signedUpAt: r.created_at, paying: payingSet.has(r.id), campaign: r.campaign })),
    campaigns: [...byCampaign.entries()].map(([campaign, v]) => ({ campaign, ...v })).sort((a, b) => b.visits - a.visits).slice(0, 20),
  };
}

export async function savePayoutDetails(affiliateId: string, method: string, details: string): Promise<"ok" | "method" | "details"> {
  const db = createAdminClient();
  const program = await currentProgram(db);
  if (!program?.settings.payoutMethods.some((m) => m.id === method && m.enabled)) return "method";
  const v = details.trim();
  if (v.length < 3 || v.length > 1000) return "details";
  const { data: before } = await db.from("affiliates").select("payout_method").eq("id", affiliateId).maybeSingle();
  await db.from("affiliates").update({ payout_method: method, payout_details: v }).eq("id", affiliateId);
  // The details themselves are not copied into the audit log.
  await db.rpc("affiliate_log", { p_affiliate: affiliateId, p_actor: "affiliate", p_action: "affiliate.payout_details", p_type: "affiliate", p_id: affiliateId, p_before: { method: before?.payout_method ?? null }, p_after: { method } });
  return "ok";
}

export async function requestPayout(affiliateId: string, method: string): Promise<{ ok: true; payoutId: string } | { ok: false; error: string }> {
  const { data, error } = await createAdminClient().rpc("affiliate_request_payout", { p_affiliate: affiliateId, p_method: method });
  if (error) {
    // The unique "one open payout" index caught a concurrent request.
    if (error.code === "23505") return { ok: false, error: "open_payout" };
    console.error("[affiliates] payout", error.message);
    return { ok: false, error: "failed" };
  }
  const row = data?.[0];
  if (!row?.out_payout) return { ok: false, error: row?.out_error ?? "failed" };
  return { ok: true, payoutId: row.out_payout };
}
