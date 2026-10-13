import "server-only";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { ValidationError } from "@/lib/bos/errors";
import { ydb, type YTables } from "@/lib/yolias/db";
import type { Json } from "../../Yolias/types/database";
import { parseProgramSettings, type ProgramSettings } from "../../Yolias/lib/affiliates/program";

// Yolias Admin → Affiliates (D-178). The data lives in the Yolias database;
// money and status changes go through its functions (row locks, allowed
// transitions, ledger that is never edited). Every admin action is written
// to the affiliate audit trail (affiliate_events, with the admin's email)
// and to the Admin audit log. Callers check permissions first.

export type Affiliate = YTables<"affiliates">;
export type Commission = YTables<"affiliate_commissions">;
export type Payout = YTables<"affiliate_payouts">;
export type AffiliateEvent = YTables<"affiliate_events">;
export type AffiliateEmailEvent = "approved" | "rejected" | "suspended" | "reactivated" | "commission_available" | "commission_on_hold" | "commission_reversed"
  | "payout_approved" | "payout_rejected" | "payout_processing" | "payout_paid" | "payout_failed" | "terms_updated";

const PAGE = 25;
const num = (v: unknown) => Number(v ?? 0);
const actorOf = (bos: BosUser) => bos.email || bos.userId;
const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

/** Affiliate ids whose email or code matches a search (null = no search). */
async function affiliateIdsMatching(term: string | undefined): Promise<string[] | null> {
  const t = (term ?? "").trim().replace(/[%,()*\\]/g, " ").slice(0, 80);
  if (!t) return null;
  const { data } = await ydb().from("affiliates").select("id").or(`email.ilike.%${t}%,code.ilike.%${t}%`).limit(200);
  return (data ?? []).map((a) => a.id);
}

/** Email and code of the affiliates on a page (one query, no N+1). */
async function affiliateNames(ids: (string | null)[]): Promise<Map<string, { email: string; code: string; status: string }>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  if (!unique.length) return new Map();
  const { data } = await ydb().from("affiliates").select("id, email, code, status").in("id", unique);
  return new Map((data ?? []).map((a) => [a.id, { email: a.email, code: a.code, status: a.status }]));
}

/** The affiliate gets an email + in-app notice (sent by Yolias's worker, deduplicated per record). */
async function notifyAffiliate(affiliateId: string, event: AffiliateEmailEvent, dedupeId: string, extra: { amountCents?: number | null; reason?: string | null; reference?: string | null } = {}) {
  const { error } = await ydb().rpc("jobs_enqueue", {
    p_kind: "affiliate.notify",
    p_payload: { affiliateId, event, dedupeId, amountCents: extra.amountCents ?? null, reason: extra.reason ?? null, reference: extra.reference ?? null },
    p_delay: 0,
  });
  if (error) console.error("[affiliates] notify enqueue", error.message);
}

// ───────────────────────── Program ─────────────────────────

export async function program(): Promise<{ versionId: number; termsVersion: string; terms: string; settings: ProgramSettings; raw: Json; createdAt: string; createdBy: string } | null> {
  const { data } = await ydb().from("affiliate_program_versions").select("*").order("id", { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  return { versionId: data.id, termsVersion: data.terms_version, terms: data.terms_text, settings: parseProgramSettings(data.settings), raw: data.settings, createdAt: data.created_at, createdBy: data.created_by };
}

export async function programHistory(limit = 20) {
  const { data } = await ydb().from("affiliate_program_versions").select("id, terms_version, note, created_by, created_at").order("id", { ascending: false }).limit(limit);
  return data ?? [];
}

export interface ProgramInput {
  enabled: boolean;
  autoApprove: boolean;
  questions: { id: string; label: string; required: boolean }[];
  commissionType: "percent" | "fixed";
  percent: number;
  fixedUsd: number;
  plans: string[];
  periods: string[];
  packs: boolean;
  recurring: boolean;
  maxPayments: number | null;
  attributionDays: number;
  model: "first_touch" | "last_touch";
  minPaymentUsd: number;
  holdDays: number;
  minPayoutUsd: number;
  excludedWorkspaces: string[];
  excludedEmails: string[];
  holdSameIp: boolean;
  maxSignupsPerIpDay: number;
  payoutMethods: { id: string; label: string; enabled: boolean }[];
  includeTestPayments: boolean;
  notifyAffiliates: boolean;
  termsVersion: string;
  terms: string;
  note: string;
  notifyTermsChange: boolean;
}

const cents = (usd: number) => Math.round(usd * 100);

/** Validates on the server and saves a new program version (history is kept). */
export async function saveProgram(bos: BosUser, i: ProgramInput): Promise<number> {
  const bad = (msg: string, field: string) => new ValidationError(msg, { [field]: msg });
  if (!(i.percent >= 0 && i.percent <= 100)) throw bad("النسبة بين 0 و100.", "percent");
  if (!(i.fixedUsd >= 0 && i.fixedUsd <= 100000)) throw bad("مبلغ غير صالح.", "fixedUsd");
  if (i.commissionType === "percent" && i.percent === 0) throw bad("حدد نسبة العمولة.", "percent");
  if (i.commissionType === "fixed" && i.fixedUsd === 0) throw bad("حدد مبلغ العمولة.", "fixedUsd");
  if (!Number.isInteger(i.attributionDays) || i.attributionDays < 1 || i.attributionDays > 365) throw bad("مدة الإسناد بين 1 و365 يومًا.", "attributionDays");
  if (!Number.isInteger(i.holdDays) || i.holdDays < 0 || i.holdDays > 365) throw bad("فترة الانتظار بين 0 و365 يومًا.", "holdDays");
  if (i.maxPayments !== null && (!Number.isInteger(i.maxPayments) || i.maxPayments < 1 || i.maxPayments > 1200)) throw bad("عدد الدفعات بين 1 و1200، أو اتركه فارغًا لكامل مدة الاشتراك.", "maxPayments");
  if (!(i.minPayoutUsd >= 1 && i.minPayoutUsd <= 1000000)) throw bad("الحد الأدنى للسحب دولار واحد على الأقل.", "minPayoutUsd");
  if (!(i.minPaymentUsd >= 0 && i.minPaymentUsd <= 1000000)) throw bad("قيمة غير صالحة.", "minPaymentUsd");
  if (!Number.isInteger(i.maxSignupsPerIpDay) || i.maxSignupsPerIpDay < 1 || i.maxSignupsPerIpDay > 1000) throw bad("قيمة غير صالحة.", "maxSignupsPerIpDay");
  const plans = i.plans.filter((p) => p === "pro" || p === "growth");
  const periods = i.periods.filter((p) => p === "monthly" || p === "annual");
  if (!plans.length && !i.packs) throw bad("اختر خطة مؤهلة واحدة على الأقل.", "plans");
  if (plans.length && !periods.length) throw bad("اختر دورة فوترة مؤهلة واحدة على الأقل.", "periods");
  const questions = i.questions.filter((q) => q.label.trim()).slice(0, 10).map((q, n) => ({ id: /^[a-z0-9_]{1,30}$/.test(q.id) ? q.id : `q${n + 1}`, label: q.label.trim().slice(0, 200), required: q.required }));
  if (new Set(questions.map((q) => q.id)).size !== questions.length) throw bad("معرّفات الأسئلة مكررة.", "questions");
  const methods = i.payoutMethods.filter((m) => /^[a-z_]{2,30}$/.test(m.id) && m.label.trim()).map((m) => ({ id: m.id, label: m.label.trim().slice(0, 60), enabled: m.enabled }));
  const terms = i.terms.trim();
  const termsVersion = i.termsVersion.trim();
  if (terms.length < 20 || terms.length > 40000) throw bad("نص الشروط مطلوب (20 حرفًا على الأقل).", "terms");
  if (!/^[\w.-]{1,40}$/.test(termsVersion)) throw bad("رقم إصدار الشروط: حروف وأرقام ونقطة وشرطة فقط.", "termsVersion");
  const excludedWorkspaces = i.excludedWorkspaces.map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (excludedWorkspaces.some((w) => !isUuid(w))) throw bad("معرّف مساحة عمل غير صالح.", "excludedWorkspaces");
  const excludedEmails = i.excludedEmails.map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (excludedEmails.some((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))) throw bad("بريد غير صالح في قائمة الاستثناء.", "excludedEmails");

  const before = await program();
  const settings = {
    enabled: i.enabled, auto_approve: i.autoApprove, questions,
    commission: { type: i.commissionType, percent_bps: Math.round(i.percent * 100), fixed_cents: cents(i.fixedUsd) },
    eligible: { plans, periods, packs: i.packs },
    recurring: { enabled: i.recurring, max_payments: i.maxPayments },
    attribution: { days: i.attributionDays, model: i.model },
    min_payment_cents: cents(i.minPaymentUsd), hold_days: i.holdDays, min_payout_cents: cents(i.minPayoutUsd),
    currencies: ["USD"], refund_policy: "reverse", dispute_policy: "reverse",
    excluded_workspaces: [...new Set(excludedWorkspaces)], excluded_emails: [...new Set(excludedEmails)],
    risk: { hold_same_ip: i.holdSameIp, max_signups_per_ip_day: i.maxSignupsPerIpDay },
    payout_methods: methods, include_test_payments: i.includeTestPayments, notify_affiliates: i.notifyAffiliates,
  };
  const { data, error } = await ydb().from("affiliate_program_versions").insert({
    settings, terms_version: termsVersion, terms_text: terms, note: i.note.trim().slice(0, 300) || null, created_by: actorOf(bos),
  }).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "save failed");
  await ydb().rpc("affiliate_log", { p_affiliate: null, p_actor: actorOf(bos), p_action: "program.updated", p_type: "program_version", p_id: String(data.id), p_before: before ? (before.raw as Json) : null, p_after: settings as unknown as Json });
  await audit({ actorId: bos.userId, action: "yolias.affiliates.program", entityType: "yolias_affiliate_program", entityId: null, oldValue: before?.raw ?? null, newValue: { version: data.id, ...settings, terms_version: termsVersion } });

  // A material change of the terms: every active affiliate is told (once per version).
  if (i.notifyTermsChange && before && before.termsVersion !== termsVersion) {
    const { data: active } = await ydb().from("affiliates").select("id").in("status", ["approved", "suspended"]).limit(5000);
    for (const a of active ?? []) await notifyAffiliate(a.id, "terms_updated", `terms:${termsVersion}`);
  }
  return data.id;
}

// ───────────────────────── Overview ─────────────────────────

export interface Overview {
  affiliates: Record<string, number>;
  visits: number;
  referrals: number;
  payingReferrals: number;
  qualifyingPaymentsCents: number;
  commissions: Record<string, number>;
  payoutsOpen: { count: number; cents: number };
  payoutsPaidCents: number;
}

export async function overview(since: string): Promise<Overview> {
  const { data, error } = await ydb().rpc("affiliate_overview", { p_since: since });
  if (error) throw new Error(error.message);
  const o = (data ?? {}) as Record<string, unknown>;
  const map = (v: unknown) => Object.fromEntries(Object.entries((v ?? {}) as Record<string, unknown>).map(([k, x]) => [k, num(x)]));
  const open = (o.payouts_open ?? {}) as Record<string, unknown>;
  return {
    affiliates: map(o.affiliates), visits: num(o.visits), referrals: num(o.referrals), payingReferrals: num(o.paying_referrals),
    qualifyingPaymentsCents: num(o.qualifying_payments_cents), commissions: map(o.commissions),
    payoutsOpen: { count: num(open.count), cents: num(open.cents) }, payoutsPaidCents: num(o.payouts_paid_cents),
  };
}

// ───────────────────────── Affiliates ─────────────────────────

export async function listAffiliates(f: { q?: string; status?: string; page: number; sort?: string }) {
  let q = ydb().from("affiliates").select("id, email, code, status, risk_flags, created_at, decided_at", { count: "exact" })
    .range((f.page - 1) * PAGE, f.page * PAGE - 1);
  q = f.sort === "oldest" ? q.order("created_at", { ascending: true }) : q.order("created_at", { ascending: false });
  if (f.status && ["pending", "approved", "rejected", "suspended", "disabled"].includes(f.status)) q = q.eq("status", f.status as Affiliate["status"]);
  const term = (f.q ?? "").trim().replace(/[%,()*\\]/g, " ").slice(0, 80);
  if (term) q = q.or(`email.ilike.%${term}%,code.ilike.%${term}%`);
  const { data, count, error } = await q;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  // Balances for the listed affiliates (one call each, at most a page).
  const balances = await Promise.all(rows.map((r) => ydb().rpc("affiliate_balances", { p_affiliate: r.id }).then((b) => b.data?.[0] ?? null)));
  return {
    rows: rows.map((r, n) => ({ ...r, availableCents: num(balances[n]?.available_cents), paidCents: num(balances[n]?.paid_cents), pendingCents: num(balances[n]?.pending_cents) + num(balances[n]?.approved_cents) })),
    total: count ?? 0,
    pages: Math.max(1, Math.ceil((count ?? 0) / PAGE)),
  };
}

export async function getAffiliate(id: string, opts: { sensitive: boolean }) {
  if (!isUuid(id)) return null;
  const db = ydb();
  const { data: a } = await db.from("affiliates").select("*").eq("id", id).maybeSingle();
  if (!a) return null;
  const since = "2020-01-01T00:00:00Z";
  const [{ data: bal }, { data: stats }, { data: refs }, { data: commissions }, { data: payouts }, { data: events }, { data: notes }] = await Promise.all([
    db.rpc("affiliate_balances", { p_affiliate: id }),
    db.rpc("affiliate_stats", { p_affiliate: id, p_since: since }),
    db.from("affiliate_referrals").select("*").eq("affiliate_id", id).order("created_at", { ascending: false }).limit(100),
    db.from("affiliate_commissions").select("*").eq("affiliate_id", id).order("created_at", { ascending: false }).limit(100),
    db.from("affiliate_payouts").select("*").eq("affiliate_id", id).order("requested_at", { ascending: false }).limit(50),
    db.from("affiliate_events").select("*").eq("affiliate_id", id).order("id", { ascending: false }).limit(100),
    db.from("affiliate_notes").select("*").eq("affiliate_id", id).order("created_at", { ascending: false }).limit(50),
  ]);
  // Referred accounts' emails only with view_sensitive.
  const userIds = opts.sensitive ? (refs ?? []).map((r) => r.referred_user_id).filter((x): x is string => !!x) : [];
  const { data: profiles } = userIds.length ? await db.from("profiles").select("id, email").in("id", userIds) : { data: [] as { id: string; email: string }[] };
  const emailOf = new Map((profiles ?? []).map((p) => [p.id, p.email]));
  return {
    affiliate: opts.sensitive ? a : { ...a, payout_details: a.payout_details ? "••••••" : null },
    balances: bal?.[0] ?? null,
    stats: { visits: num(stats?.[0]?.visits), signups: num(stats?.[0]?.signups), paying: num(stats?.[0]?.paying) },
    referrals: (refs ?? []).map((r) => ({ ...r, email: r.referred_user_id ? emailOf.get(r.referred_user_id) ?? null : null })),
    commissions: commissions ?? [],
    payouts: (payouts ?? []).map((p) => (opts.sensitive ? p : { ...p, details_snapshot: p.details_snapshot ? "••••••" : null })),
    events: events ?? [],
    notes: notes ?? [],
  };
}

const statusMoves: Record<string, string[]> = {
  pending: ["approved", "rejected"],
  rejected: ["approved"],
  approved: ["suspended", "disabled"],
  suspended: ["approved", "disabled"],
  disabled: [],
};

export async function setAffiliateStatus(bos: BosUser, id: string, to: string, reason: string): Promise<void> {
  if (!isUuid(id)) throw new ValidationError("مسوّق غير صالح.");
  const { data: a } = await ydb().from("affiliates").select("status").eq("id", id).maybeSingle();
  if (!a) throw new ValidationError("المسوّق غير موجود.");
  if (!statusMoves[a.status]?.includes(to)) throw new ValidationError("انتقال حالة غير مسموح.");
  const why = reason.trim().slice(0, 500);
  if ((to === "rejected" || to === "suspended" || to === "disabled") && why.length < 3) throw new ValidationError("اكتب السبب.", { reason: "مطلوب" });
  // Conditional on the current status: two admins at once can't both move it.
  const { data: moved } = await ydb().from("affiliates")
    .update({ status: to as Affiliate["status"], decision_reason: why || null, decided_at: new Date().toISOString(), decided_by: actorOf(bos) })
    .eq("id", id).eq("status", a.status).select("id").maybeSingle();
  if (!moved) throw new ValidationError("تغيّرت الحالة في الأثناء. أعد تحميل الصفحة.");
  await ydb().rpc("affiliate_log", { p_affiliate: id, p_actor: actorOf(bos), p_action: `affiliate.${to}`, p_type: "affiliate", p_id: id, p_before: { status: a.status }, p_after: { status: to, reason: why || null } });
  await audit({ actorId: bos.userId, action: `yolias.affiliate.${to}`, entityType: "yolias_affiliate", entityId: id, oldValue: { status: a.status }, newValue: { status: to }, reason: why || null });
  const event: AffiliateEmailEvent | null = to === "approved" ? (a.status === "suspended" ? "reactivated" : "approved") : to === "rejected" ? "rejected" : to === "suspended" ? "suspended" : null;
  if (event) await notifyAffiliate(id, event, `${id}:${to}:${Date.now()}`, { reason: to === "approved" ? null : why || null });
}

export async function addNote(bos: BosUser, id: string, body: string): Promise<void> {
  const v = body.trim();
  if (!isUuid(id) || v.length < 1 || v.length > 4000) throw new ValidationError("اكتب الملاحظة (حتى 4000 حرف).", { body: "مطلوب" });
  const { error } = await ydb().from("affiliate_notes").insert({ affiliate_id: id, author: actorOf(bos), body: v });
  if (error) throw new Error(error.message);
  await ydb().rpc("affiliate_log", { p_affiliate: id, p_actor: actorOf(bos), p_action: "affiliate.note", p_type: "affiliate", p_id: id, p_before: null, p_after: null });
}

// ───────────────────────── Commissions ─────────────────────────

export async function listCommissions(f: { q?: string; status?: string; affiliate?: string; held?: string; from?: string; to?: string; page: number }) {
  const ids = await affiliateIdsMatching(f.q);
  if (ids && !ids.length) return { rows: [], total: 0, pages: 1 };
  let q = ydb().from("affiliate_commissions").select("*", { count: "exact" }).order("created_at", { ascending: false }).range((f.page - 1) * PAGE, f.page * PAGE - 1);
  if (f.status && ["pending", "approved", "available", "processing", "paid", "rejected", "reversed"].includes(f.status)) q = q.eq("status", f.status as Commission["status"]);
  if (f.affiliate && isUuid(f.affiliate)) q = q.eq("affiliate_id", f.affiliate);
  if (f.held === "1") q = q.eq("on_hold", true);
  if (ids) q = q.in("affiliate_id", ids);
  if (f.from && !Number.isNaN(Date.parse(f.from))) q = q.gte("created_at", f.from);
  if (f.to && !Number.isNaN(Date.parse(f.to))) q = q.lte("created_at", `${f.to}T23:59:59Z`);
  const { data, count, error } = await q;
  if (error) throw new Error(error.message);
  const names = await affiliateNames((data ?? []).map((c) => c.affiliate_id));
  return { rows: (data ?? []).map((c) => ({ ...c, affiliate: names.get(c.affiliate_id) ?? null })), total: count ?? 0, pages: Math.max(1, Math.ceil((count ?? 0) / PAGE)) };
}

const commissionResults: Record<string, string> = {
  not_found: "العمولة غير موجودة.", invalid: "هذا الإجراء غير مسموح لحالة العمولة الحالية.", in_payout: "العمولة داخل طلب سحب مفتوح. ارفض الطلب أو أكمله أولًا.", already: "العمولة معكوسة أو مرفوضة بالفعل.",
};

export async function commissionAction(bos: BosUser, id: string, action: string, reason: string): Promise<void> {
  if (!isUuid(id) || !["hold", "release", "approve", "reject", "reverse"].includes(action)) throw new ValidationError("إجراء غير صالح.");
  const why = reason.trim().slice(0, 500);
  if ((action === "reject" || action === "reverse" || action === "hold") && why.length < 3) throw new ValidationError("اكتب السبب.", { reason: "مطلوب" });
  const { data: before } = await ydb().from("affiliate_commissions").select("affiliate_id, status, amount_cents, on_hold").eq("id", id).maybeSingle();
  if (!before) throw new ValidationError(commissionResults.not_found);
  const { data, error } = await ydb().rpc("affiliate_set_commission", { p_commission: id, p_action: action, p_actor: actorOf(bos), p_reason: why || null });
  if (error) throw new Error(error.message);
  if (data !== "ok" && data !== "reversed") throw new ValidationError(commissionResults[data] ?? "تعذّر تنفيذ الإجراء.");
  await audit({ actorId: bos.userId, action: `yolias.affiliate_commission.${action}`, entityType: "yolias_affiliate_commission", entityId: id, oldValue: { status: before.status, on_hold: before.on_hold }, newValue: { action }, reason: why || null });
  const amount = num(before.amount_cents);
  if (action === "hold") await notifyAffiliate(before.affiliate_id, "commission_on_hold", `${id}:hold:${Date.now()}`, { amountCents: amount });
  if (action === "reverse" || action === "reject") await notifyAffiliate(before.affiliate_id, "commission_reversed", `${id}:${action}`, { amountCents: amount, reason: why });
}

/** A documented manual correction: positive (owed) or negative (to take back). */
export async function adjustBalance(bos: BosUser, affiliateId: string, amountUsd: number, reason: string): Promise<void> {
  const amount = Math.round(amountUsd * 100);
  if (!isUuid(affiliateId) || !Number.isFinite(amountUsd) || amount === 0 || Math.abs(amount) > 100_000_00) throw new ValidationError("مبلغ غير صالح.", { amount: "مثال: 25 أو -10" });
  if (reason.trim().length < 3) throw new ValidationError("اكتب سبب التسوية.", { reason: "مطلوب" });
  const { data, error } = await ydb().rpc("affiliate_adjust", { p_affiliate: affiliateId, p_amount_cents: amount, p_reason: reason.trim(), p_actor: actorOf(bos) });
  if (error) throw new Error(error.message);
  await audit({ actorId: bos.userId, action: "yolias.affiliate_commission.adjustment", entityType: "yolias_affiliate", entityId: affiliateId, newValue: { amount_cents: amount, commission: data }, reason: reason.trim() });
}

// ───────────────────────── Payouts ─────────────────────────

export async function listPayouts(f: { q?: string; status?: string; page: number }, opts: { sensitive: boolean }) {
  const ids = await affiliateIdsMatching(f.q);
  if (ids && !ids.length) return { rows: [], total: 0, pages: 1 };
  let q = ydb().from("affiliate_payouts").select("*", { count: "exact" }).order("requested_at", { ascending: false }).range((f.page - 1) * PAGE, f.page * PAGE - 1);
  if (f.status === "open") q = q.in("status", ["requested", "approved", "processing"]);
  else if (f.status && ["requested", "approved", "processing", "paid", "rejected", "failed"].includes(f.status)) q = q.eq("status", f.status as Payout["status"]);
  if (ids) q = q.in("affiliate_id", ids);
  const { data, count, error } = await q;
  if (error) throw new Error(error.message);
  const names = await affiliateNames((data ?? []).map((p) => p.affiliate_id));
  const rows = (data ?? []).map((p) => ({ ...(opts.sensitive ? p : { ...p, details_snapshot: p.details_snapshot ? "••••••" : null }), affiliate: names.get(p.affiliate_id) ?? null }));
  return { rows, total: count ?? 0, pages: Math.max(1, Math.ceil((count ?? 0) / PAGE)) };
}

export async function getPayout(id: string, opts: { sensitive: boolean }) {
  if (!isUuid(id)) return null;
  const db = ydb();
  const { data: p } = await db.from("affiliate_payouts").select("*").eq("id", id).maybeSingle();
  if (!p) return null;
  const affiliate = (await affiliateNames([p.affiliate_id])).get(p.affiliate_id) ?? null;
  const [{ data: commissions }, { data: events }] = await Promise.all([
    db.from("affiliate_commissions").select("*").eq("payout_id", id).order("created_at"),
    db.from("affiliate_events").select("*").eq("target_type", "payout").eq("target_id", id).order("id", { ascending: false }),
  ]);
  return { payout: opts.sensitive ? p : { ...p, details_snapshot: p.details_snapshot ? "••••••" : null }, affiliate, commissions: commissions ?? [], events: events ?? [] };
}

const payoutResults: Record<string, string> = {
  not_found: "طلب السحب غير موجود.", invalid: "هذا الانتقال غير مسموح من الحالة الحالية (ربما عالجه شخص آخر). أعد تحميل الصفحة.", reason_required: "اكتب السبب.",
};

export async function payoutAction(bos: BosUser, id: string, to: string, input: { reference: string; reason: string; note: string }): Promise<void> {
  if (!isUuid(id) || !["approved", "processing", "paid", "rejected", "failed"].includes(to)) throw new ValidationError("إجراء غير صالح.");
  if (to === "paid" && input.reference.trim().length < 2) throw new ValidationError("اكتب مرجع التحويل (رقم العملية) قبل تسجيل الدفع.", { reference: "مطلوب" });
  const { data: before } = await ydb().from("affiliate_payouts").select("affiliate_id, status, amount_cents").eq("id", id).maybeSingle();
  if (!before) throw new ValidationError(payoutResults.not_found);
  const { data, error } = await ydb().rpc("affiliate_set_payout", {
    p_payout: id, p_to: to, p_actor: actorOf(bos), p_reference: input.reference.trim().slice(0, 200) || null, p_reason: input.reason.trim().slice(0, 500) || null, p_note: input.note.trim().slice(0, 2000) || null,
  });
  if (error) throw new Error(error.message);
  if (data !== "ok") throw new ValidationError(payoutResults[data] ?? "تعذّر تنفيذ الإجراء.");
  await audit({ actorId: bos.userId, action: `yolias.affiliate_payout.${to}`, entityType: "yolias_affiliate_payout", entityId: id, oldValue: { status: before.status }, newValue: { status: to, reference: input.reference.trim() || null }, reason: input.reason.trim() || null });
  const event = ({ approved: "payout_approved", processing: "payout_processing", paid: "payout_paid", rejected: "payout_rejected", failed: "payout_failed" } as const)[to as "approved"];
  await notifyAffiliate(before.affiliate_id, event, `${id}:${to}`, { amountCents: num(before.amount_cents), reason: to === "rejected" || to === "failed" ? input.reason.trim() : null, reference: to === "paid" ? input.reference.trim() : null });
}

// ───────────────────────── Audit trail ─────────────────────────

export async function listEvents(f: { q?: string; affiliate?: string; action?: string; page: number }) {
  const ids = await affiliateIdsMatching(f.q);
  if (ids && !ids.length) return { rows: [], total: 0, pages: 1 };
  let q = ydb().from("affiliate_events").select("*", { count: "exact" }).order("id", { ascending: false }).range((f.page - 1) * PAGE * 2, f.page * PAGE * 2 - 1);
  if (f.affiliate && isUuid(f.affiliate)) q = q.eq("affiliate_id", f.affiliate);
  if (f.action && /^[a-z_.]{2,60}$/.test(f.action)) q = q.like("action", `${f.action}%`);
  if (ids) q = q.in("affiliate_id", ids);
  const { data, count, error } = await q;
  if (error) throw new Error(error.message);
  const names = await affiliateNames((data ?? []).map((e) => e.affiliate_id));
  return { rows: (data ?? []).map((e) => ({ ...e, affiliate: e.affiliate_id ? names.get(e.affiliate_id) ?? null : null })), total: count ?? 0, pages: Math.max(1, Math.ceil((count ?? 0) / (PAGE * 2))) };
}
