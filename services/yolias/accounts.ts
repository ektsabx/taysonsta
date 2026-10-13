import "server-only";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { db } from "@/lib/bos/db";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { ydb, type YTables } from "@/lib/yolias/db";
import type { AccountStatus, AdminAccountRow } from "../../Yolias/types/database";

// Yolias accounts for Admin → Users (owner brief 2026-10-13, D-214).
// Reads: one row per account from the `admin_accounts_v` view (Yolias DB),
// filtered, sorted and paged on the server. Actions: suspend / pause / ban /
// restore / delete (Auth ban + account_moderation), notes, messages and
// compensation — each audited in Admin's audit log. Callers check
// `platform.read` (reads) or `platform.manage` scope all (actions).

export const PAGE = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FOREVER = "876000h";

export type AccountView = "all" | "registered" | "subscribed" | "suspended" | "banned";
export const accountViews: AccountView[] = ["all", "registered", "subscribed", "suspended", "banned"];

export interface AccountFilters {
  q?: string;
  status?: string;
  sub?: string;
  plan?: string;
  country?: string;
  segment?: string;
  from?: string;
  to?: string;
  sort?: string;
  dir?: string;
}

const SORTS: Record<string, keyof AdminAccountRow> = {
  created: "created_at", activity: "last_activity_at", paid: "paid_total", trial_end: "trial_ends_at", period_end: "current_period_end",
};

export const SEGMENTS = [
  "registered_only", "trialing", "trial_ended", "plan_selected", "checkout_no_payment", "payment_pending", "payment_failed",
  "payment_not_completed", "paid_active", "lapsed", "test", "deleted",
] as const;

// A PostgREST filter builder on admin_accounts_v (its generic type is too deep to spell out here).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Builder = any;

/**
 * Applies a page's base filter and the user's filters to a query on
 * admin_accounts_v. Returned wrapped: a builder is "thenable", so returning it
 * bare from an async function would run the query early.
 */
async function filtered(x: Builder, view: AccountView, f: AccountFilters): Promise<{ q: Builder }> {
  if (view === "registered") x = x.eq("paid_count", 0).neq("subscription_status", "active").neq("account_status", "deleted");
  if (view === "subscribed") x = x.or("subscription_status.neq.none,paid_count.gt.0").neq("account_status", "deleted");
  if (view === "suspended") x = x.in("account_status", ["suspended", "paused"]);
  if (view === "banned") x = x.eq("account_status", "banned");
  if (f.status) x = x.eq("account_status", f.status);
  if (f.sub) x = x.eq("subscription_status", f.sub);
  if (f.plan) x = x.eq("plan", f.plan);
  if (f.country && /^[A-Za-z]{2}$/.test(f.country)) x = x.eq("country", f.country.toUpperCase());
  if (f.segment && (SEGMENTS as readonly string[]).includes(f.segment)) x = x.eq("segment", f.segment);
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) x = x.gte("created_at", `${f.from}T00:00:00Z`);
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) x = x.lte("created_at", `${f.to}T23:59:59Z`);
  const term = (f.q ?? "").replace(/[%,()*]/g, " ").trim();
  if (term) {
    if (UUID.test(term)) x = x.or(`id.eq.${term},workspace_id.eq.${term}`);
    else {
      // Phone numbers live in user_phones.
      const { data: phones } = /\d{4,}/.test(term) ? await ydb().from("user_phones").select("user_id").ilike("phone", `%${term.replace(/\s/g, "")}%`).limit(50) : { data: [] };
      const ids = (phones ?? []).map((p) => p.user_id);
      x = x.or([`email.ilike.%${term}%`, `full_name.ilike.%${term}%`, ...(ids.length ? [`id.in.(${ids.join(",")})`] : [])].join(","));
    }
  }
  return { q: x };
}

export async function listAccounts(view: AccountView, f: AccountFilters, page: number, pageSize = PAGE) {
  const sortCol = SORTS[f.sort ?? ""] ?? "created_at";
  const asc = f.dir === "asc";
  const { q } = await filtered(ydb().from("admin_accounts_v").select("*", { count: "exact" }), view, f);
  const { data, count, error } = (await q.order(sortCol, { ascending: asc, nullsFirst: false }).range((page - 1) * pageSize, page * pageSize - 1)) as { data: AdminAccountRow[] | null; count: number | null; error: Error | null };
  if (error) throw error;
  const rows = (data ?? []) as AdminAccountRow[];
  const { data: phones } = rows.length ? await ydb().from("user_phones").select("user_id, phone").in("user_id", rows.map((r) => r.id)) : { data: [] };
  const phoneOf = new Map((phones ?? []).map((p) => [p.user_id, p.phone]));
  return {
    total: count ?? 0,
    pages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
    rows: rows.map((r) => ({ ...r, phone: phoneOf.get(r.id) ?? null })),
  };
}

/** Every id matching the filters (bulk "select all results"), capped. */
export async function matchingAccountIds(view: AccountView, f: AccountFilters, cap = 2000): Promise<string[]> {
  const { q } = await filtered(ydb().from("admin_accounts_v").select("id"), view, f);
  const { data, error } = (await q.limit(cap)) as { data: { id: string }[] | null; error: Error | null };
  if (error) throw error;
  return (data ?? []).map((r) => r.id);
}

/** Users → Overview: every number is a count over the same view the tables use. */
export async function accountsOverview(sinceIso: string, untilIso: string) {
  const v = () => ydb().from("admin_accounts_v").select("id", { count: "exact", head: true });
  const soon = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
  const now = new Date().toISOString();
  const c = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
    const { count, error } = await q;
    if (error) throw error;
    return count ?? 0;
  };
  const [total, newInPeriod, notSubscribed, trialing, paidActive, ended, canceledRunning, suspended, banned, trialSoon, periodSoon, newPaid, canceledInPeriod] = await Promise.all([
    c(v().neq("account_status", "deleted")),
    c(v().neq("account_status", "deleted").gte("created_at", sinceIso).lt("created_at", untilIso)),
    c(v().neq("account_status", "deleted").eq("paid_count", 0).eq("subscription_status", "none")),
    c(v().eq("subscription_status", "trialing")),
    c(v().eq("segment", "paid_active")),
    c(v().eq("subscription_status", "canceled")),
    c(v().eq("subscription_status", "active").eq("cancel_at_period_end", true)),
    c(v().in("account_status", ["suspended", "paused"])),
    c(v().eq("account_status", "banned")),
    c(v().eq("subscription_status", "trialing").gte("trial_ends_at", now).lte("trial_ends_at", soon(3))),
    c(v().eq("subscription_status", "active").gte("current_period_end", now).lte("current_period_end", soon(7))),
    // Signed up in the period and paid (live) at least once.
    c(v().gte("created_at", sinceIso).lt("created_at", untilIso).gt("paid_count", 0)),
    c(ydb().from("subscription_events").select("id", { count: "exact", head: true }).eq("status", "canceled").gte("created_at", sinceIso).lt("created_at", untilIso)),
  ]);
  return {
    total, newInPeriod, notSubscribed, trialing, paidActive, ended, canceledRunning, canceledInPeriod, suspended, banned, trialSoon, periodSoon, newPaid,
    conversion: newInPeriod ? newPaid / newInPeriod : null,
  };
}

/** Counts per journey segment (Users and Conversions pages link to each list). */
export async function segmentCounts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  await Promise.all(SEGMENTS.map(async (s) => {
    const { count } = await ydb().from("admin_accounts_v").select("id", { count: "exact", head: true }).eq("segment", s);
    out[s] = count ?? 0;
  }));
  return out;
}

// ── User 360 ────────────────────────────────────────────────────────────────

export async function account360(id: string) {
  if (!UUID.test(id)) throw new NotFoundError();
  const y = ydb();
  const { data: row, error } = await y.from("admin_accounts_v").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!row) throw new NotFoundError();
  const a = row as AdminAccountRow;
  const ws = a.workspace_id;
  const day = 86_400_000;
  const since30 = new Date(Date.now() - 30 * day).toISOString();
  const [
    phone, workspace, usage, subEvents, payments, invoices, checkouts, events, sessions, logins, devices, notes, messages, emails, referral,
    searches, campaigns, exports, aiMessages, outreach, ledger,
  ] = await Promise.all([
    y.from("user_phones").select("phone").eq("user_id", id).maybeSingle().then((r) => r.data?.phone ?? null),
    ws ? y.from("workspaces").select("*").eq("id", ws).maybeSingle().then((r) => r.data) : Promise.resolve(null),
    ws ? y.rpc("usage_summary", { p_ws: ws }).then((r) => r.data?.[0] ?? null) : Promise.resolve(null),
    ws ? y.from("subscription_events").select("*").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(200).then((r) => r.data ?? []) : Promise.resolve([]),
    ws ? y.from("payments").select("*").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(200).then((r) => r.data ?? []) : Promise.resolve([]),
    ws ? y.from("invoices").select("id, number, kind, plan, billing_period, amount, currency, status, mode, period_start, period_end, payment_id, created_at").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(100).then((r) => r.data ?? []) : Promise.resolve([]),
    y.from("checkout_sessions").select("*").or(ws ? `user_id.eq.${id},workspace_id.eq.${ws}` : `user_id.eq.${id}`).order("opened_at", { ascending: false }).limit(100).then((r) => r.data ?? []),
    y.from("funnel_events").select("*").eq("user_id", id).order("occurred_at", { ascending: false }).limit(300).then((r) => r.data ?? []),
    y.from("app_sessions").select("*").eq("user_id", id).order("started_at", { ascending: false }).limit(1000).then((r) => r.data ?? []),
    y.rpc("admin_login_history", { p_user: id, p_limit: 50 }).then((r) => r.data ?? []),
    y.from("known_devices").select("*").eq("user_id", id).order("last_seen", { ascending: false }).then((r) => r.data ?? []),
    y.from("account_notes").select("*").eq("user_id", id).order("created_at", { ascending: false }).then((r) => r.data ?? []),
    y.from("account_messages").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(100).then((r) => r.data ?? []),
    y.from("email_log").select("id, kind, category, status, error, created_at, sent_at").eq("user_id", id).order("created_at", { ascending: false }).limit(100).then((r) => r.data ?? []),
    y.from("affiliate_referrals").select("campaign, attributed_at, status, affiliates(code)").eq("referred_user_id", id).maybeSingle().then((r) => r.data as { campaign: string | null; attributed_at: string; status: string; affiliates: { code: string } | null } | null),
    ws ? y.from("strategies").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("created_by", id).then((r) => r.count ?? 0) : Promise.resolve(0),
    ws ? y.from("campaigns").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("created_by", id).then((r) => r.count ?? 0) : Promise.resolve(0),
    ws ? y.from("workspace_activity").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("user_id", id).then((r) => r.count ?? 0) : Promise.resolve(0),
    ws ? y.from("agent_messages").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("user_id", id).eq("role", "user").then((r) => r.count ?? 0) : Promise.resolve(0),
    ws ? y.from("outreach_messages").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("created_by", id).then((r) => r.count ?? 0) : Promise.resolve(0),
    ws ? y.from("usage_ledger").select("*").eq("workspace_id", ws).eq("kind", "grant").order("created_at", { ascending: false }).limit(50).then((r) => r.data ?? []) : Promise.resolve([]),
  ]);

  // App sessions: counts and durations come only from recorded pings (D-214).
  const startOf = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).getTime();
  const today = startOf(new Date());
  const durations = sessions.map((s) => Date.parse(s.last_seen_at) - Date.parse(s.started_at));
  const perDay: { day: string; sessions: number; minutes: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d0 = today - i * day;
    const list = sessions.filter((s) => { const t = Date.parse(s.started_at); return t >= d0 && t < d0 + day; });
    perDay.push({ day: new Date(d0).toISOString().slice(0, 10), sessions: list.length, minutes: Math.round(list.reduce((n, s) => n + (Date.parse(s.last_seen_at) - Date.parse(s.started_at)), 0) / 60_000) });
  }
  const within = (ms: number) => sessions.filter((s) => Date.parse(s.started_at) >= ms).length;
  const usageStats = {
    sessions: sessions.length,
    sessionsToday: within(today),
    sessionsWeek: within(Date.now() - 7 * day),
    sessionsMonth: within(Date.parse(since30)),
    avgMinutes: durations.length ? Math.round(durations.reduce((n, x) => n + x, 0) / durations.length / 60_000 * 10) / 10 : null,
    first: sessions.length ? sessions[sessions.length - 1].started_at : null,
    last: sessions.length ? sessions[0].last_seen_at : null,
    perDay,
    features: { searches, campaigns, exports, aiMessages, outreach },
  };

  // Admin actions on this account (Admin's own audit log).
  const { data: auditRows } = await db().from("audit_logs").select("id, action, actor_user_id, old_value, new_value, reason, metadata, created_at")
    .or(`and(entity_type.eq.yolias_user,entity_id.eq.${id}),metadata->>userId.eq.${id}`).order("created_at", { ascending: false }).limit(200);
  const actorIds = [...new Set((auditRows ?? []).map((r) => r.actor_user_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length ? await db().from("employees").select("user_id, full_name").in("user_id", actorIds) : { data: [] };
  const actorName = new Map((actors ?? []).map((e) => [e.user_id, e.full_name]));
  const adminActions = (auditRows ?? []).map((r) => ({ ...r, actor: r.actor_user_id ? actorName.get(r.actor_user_id) ?? null : null }));

  return {
    account: { ...a, phone }, workspace, usage, subEvents, payments, invoices, checkouts, events, logins, devices, notes, messages, emails, referral,
    usageStats, grants: ledger, adminActions,
  };
}
export type Account360 = Awaited<ReturnType<typeof account360>>;

/** One merged, time-ordered list of everything that happened to the account. */
export function timelineOf(d: Account360) {
  type Item = { at: string; kind: string; label: string; detail?: string | null; source: string; tone?: "success" | "danger" | "warning" | "info" | "neutral"; confirmed: boolean };
  const out: Item[] = [];
  out.push({ at: d.account.created_at, kind: "signup", label: "أنشأ الحساب", source: "Yolias", confirmed: true });
  const evLabel: Record<string, string> = {
    plans_viewed: "شاهد صفحة الخطط", plan_selected: "اختار خطة", checkout_opened: "فتح Checkout", checkout_details: "اختار طريقة الدفع / غيّر الخطة",
    payment_started: "بدأ الدفع", gateway_redirected: "انتقل إلى بوابة الدفع", gateway_returned: "عاد من بوابة الدفع", payment_error: "خطأ قبل الوصول للبوابة",
    payment_succeeded: "اكتمل الدفع", payment_failed: "فشل الدفع", subscription_activated: "تم تفعيل الاشتراك", checkout_abandoned: "تُرك Checkout",
    checkout_recovered: "استُعيد Checkout متروك",
  };
  for (const e of d.events) {
    const props = (e.props ?? {}) as Record<string, unknown>;
    out.push({
      at: e.occurred_at, kind: e.name, label: evLabel[e.name] ?? e.name, source: e.source, confirmed: e.confirmed,
      detail: [e.plan, e.billing_period, e.provider, typeof props.result === "string" ? `النتيجة: ${props.result}` : null, typeof props.reason === "string" ? `السبب: ${props.reason}` : null].filter(Boolean).join(" · ") || null,
      tone: e.name === "payment_failed" || e.name === "payment_error" ? "danger" : e.name === "payment_succeeded" || e.name === "subscription_activated" ? "success" : e.name === "checkout_abandoned" ? "warning" : "neutral",
    });
  }
  const subLabel: Record<string, string> = {
    activated: "بدأ الاشتراك", changed: "غيّر الخطة", canceled: "ألغى التجديد", resumed: "استأنف التجديد", ended: "انتهى الاشتراك", renewed: "جدّد الاشتراك",
    past_due: "تأخر السداد", trial_started: "بدأ التجربة المجانية", trial_converted: "تحولت التجربة إلى اشتراك مدفوع", trial_ended: "انتهت التجربة",
  };
  for (const s of d.subEvents) {
    out.push({ at: s.created_at, kind: `sub_${s.status}`, label: subLabel[s.status] ?? s.status, detail: `${s.plan} · ${s.billing_period}${s.amount ? ` · ${s.currency} ${s.amount}` : ""}${s.mode === "test" ? " · اختبار" : ""}`, source: "Yolias", confirmed: true, tone: ["ended", "past_due", "canceled"].includes(s.status) ? "warning" : "info" });
  }
  for (const l of d.logins) out.push({ at: l.at, kind: `auth_${l.action}`, label: authLabel[l.action] ?? l.action, detail: l.provider, source: "Supabase Auth", confirmed: true });
  for (const m of d.messages) out.push({ at: m.created_at, kind: "message", label: m.channel === "email" ? "أُرسل له بريد من الفريق" : m.channel === "in_app" ? "أُرسل له إشعار داخل التطبيق" : "رسالة SMS", detail: `${m.subject} · ${m.status}`, source: m.sent_by_name ?? "Admin", confirmed: m.status === "sent", tone: m.status === "failed" ? "danger" : "neutral" });
  for (const r of d.adminActions) out.push({ at: r.created_at, kind: "admin", label: adminActionLabel(r.action), detail: r.reason, source: r.actor ?? "Admin", confirmed: true, tone: "info" });
  for (const n of d.notes) out.push({ at: n.created_at, kind: "note", label: "ملاحظة داخلية", detail: n.body.slice(0, 120), source: n.author_name ?? "Admin", confirmed: true });
  return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

const authLabel: Record<string, string> = {
  login: "سجّل الدخول", logout: "سجّل الخروج", user_signedup: "أكد التسجيل", user_recovery_requested: "طلب رابط دخول بالبريد",
  user_repeated_signup: "حاول التسجيل مرة أخرى بنفس البريد", user_confirmation_requested: "طلب تأكيد البريد", user_invited: "دُعي إلى مساحة عمل",
};

export function adminActionLabel(action: string): string {
  const map: Record<string, string> = {
    "yolias.user.suspend": "أوقف الأدمن الحساب", "yolias.user.restore": "أعاد الأدمن تفعيل الحساب", "yolias.user.pause": "أوقف الأدمن الحساب مؤقتًا",
    "yolias.user.ban": "حظر الأدمن الحساب", "yolias.user.unban": "رفع الأدمن الحظر", "yolias.user.delete": "حذف الأدمن الحساب",
    "yolias.user.note": "أضاف الأدمن ملاحظة", "yolias.user.message": "أرسل الأدمن رسالة", "yolias.user.compensate": "أضاف الأدمن رصيدًا / تعويضًا",
    "yolias.user.renewal_request": "أرسل الأدمن طلب تجديد", "yolias.usage.adjust": "عدّل الأدمن رصيد العملاء المحتملين",
  };
  return map[action] ?? action;
}

// ── Actions ─────────────────────────────────────────────────────────────────

export type AccountAction = "suspend" | "pause" | "ban" | "restore" | "unban" | "delete";

export interface ActionResult { id: string; email: string | null; ok: boolean; error?: string }

const adminName = (bos: BosUser) => bos.employee?.full_name || bos.email;

/** Changes an account's state. Suspend / pause / ban block sign-in (Auth ban); data is kept. */
export async function setAccountState(bos: BosUser, userId: string, action: AccountAction, reason: string, opts: { days?: number } = {}): Promise<ActionResult> {
  const why = reason.trim();
  if (!UUID.test(userId)) return { id: userId, email: null, ok: false, error: "معرّف غير صالح" };
  if (["suspend", "pause", "ban", "delete"].includes(action) && (why.length < 3 || why.length > 300)) throw new ValidationError("السبب مطلوب (3 أحرف على الأقل).", { reason: "مطلوب" });
  const y = ydb();
  const { data: u, error: getError } = await y.auth.admin.getUserById(userId);
  if (getError || !u.user) return { id: userId, email: null, ok: false, error: "الحساب غير موجود" };
  const email = u.user.email ?? null;
  const { data: before } = await y.from("account_moderation").select("*").eq("user_id", userId).maybeSingle();
  const was: AccountStatus = before?.status ?? "active";
  if (was === "deleted") return { id: userId, email, ok: false, error: "الحساب محذوف" };
  if ((action === "unban" && was !== "banned") || (action === "restore" && !["suspended", "paused"].includes(was))) return { id: userId, email, ok: false, error: "الحالة الحالية لا تسمح بهذا الإجراء" };
  if (action === "restore" && was === "banned") return { id: userId, email, ok: false, error: "الحساب محظور: استخدم رفع الحظر" };

  let next: AccountStatus;
  let until: string | null = null;
  if (action === "suspend") next = "suspended";
  else if (action === "ban") next = "banned";
  else if (action === "delete") next = "deleted";
  else if (action === "pause") {
    const days = Math.min(Math.max(Math.round(opts.days ?? 7), 1), 365);
    next = "paused";
    until = new Date(Date.now() + days * 86_400_000).toISOString();
  } else next = "active";

  if (action === "delete") {
    // Soft delete (Supabase keeps the row, the email is freed, sign-in stops):
    // payments, invoices and audit records stay for accounting and the law.
    const { error } = await y.auth.admin.deleteUser(userId, true);
    if (error) return { id: userId, email, ok: false, error: error.message };
  } else {
    const ban = next === "active" ? "none" : next === "paused" ? `${Math.round((Date.parse(until!) - Date.now()) / 3_600_000)}h` : FOREVER;
    const { error } = await y.auth.admin.updateUserById(userId, { ban_duration: ban });
    if (error) return { id: userId, email, ok: false, error: error.message };
  }
  await y.from("account_moderation").upsert({ user_id: userId, status: next, reason: why || null, until, changed_by: adminName(bos), changed_at: new Date().toISOString() });
  await audit({
    actorId: bos.userId, action: `yolias.user.${action}`, entityType: "yolias_user", entityId: userId,
    oldValue: { status: was }, newValue: { status: next, until }, reason: why || null, metadata: { userId, email },
  });
  if (action === "suspend" || action === "ban" || action === "pause") await y.rpc("jobs_enqueue", { p_kind: "email.user", p_payload: { userId, event: "account_suspended" }, p_delay: 0 });
  if (action === "restore" || action === "unban") await y.rpc("jobs_enqueue", { p_kind: "email.user", p_payload: { userId, event: "account_restored" }, p_delay: 0 });
  return { id: userId, email, ok: true };
}

export async function addAccountNote(bos: BosUser, userId: string, body: string, checkoutId: string | null = null): Promise<void> {
  const text = body.trim();
  if (!UUID.test(userId)) throw new NotFoundError();
  if (text.length < 1 || text.length > 4000) throw new ValidationError("اكتب الملاحظة (حتى 4000 حرف).", { body: "مطلوب" });
  const { error } = await ydb().from("account_notes").insert({ user_id: userId, body: text, author_id: bos.userId, author_name: adminName(bos), checkout_id: checkoutId && UUID.test(checkoutId) ? checkoutId : null });
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.user.note", entityType: "yolias_user", entityId: userId, metadata: { userId, checkoutId } });
}

export interface MessageInput {
  channel: "email" | "in_app" | "sms";
  purpose: "service" | "recovery" | "marketing";
  subject: string;
  body: string;
  ctaUrl?: string | null;
  checkoutId?: string | null;
}

/**
 * Queues a message to one account through Yolias's own pipeline (job
 * email.team_message). Never to a deleted account, never twice the same
 * subject to the same account within 24 hours, SMS only when a provider is
 * connected (none is today).
 */
export async function sendAccountMessage(bos: BosUser, userId: string, m: MessageInput): Promise<ActionResult> {
  if (!UUID.test(userId)) return { id: userId, email: null, ok: false, error: "معرّف غير صالح" };
  const subject = m.subject.trim();
  const body = m.body.trim();
  if (subject.length < 2 || subject.length > 200 || body.length < 2 || body.length > 5000) throw new ValidationError("العنوان والنص مطلوبان.", { subject: "مطلوب" });
  if (m.ctaUrl && !m.ctaUrl.startsWith("/")) throw new ValidationError("الرابط يجب أن يكون داخل يولياس ويبدأ بـ /", { cta_url: "رابط داخلي فقط" });
  const y = ydb();
  const { data: acc } = await y.from("admin_accounts_v").select("email, account_status").eq("id", userId).maybeSingle();
  if (!acc) return { id: userId, email: null, ok: false, error: "الحساب غير موجود" };
  if (acc.account_status === "deleted") return { id: userId, email: acc.email, ok: false, error: "الحساب محذوف" };
  if (m.channel === "sms") return { id: userId, email: acc.email, ok: false, error: "مزود SMS غير متصل" };
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await y.from("account_messages").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("subject", subject).eq("channel", m.channel).gte("created_at", since).neq("status", "failed");
  if ((count ?? 0) > 0) return { id: userId, email: acc.email, ok: false, error: "أُرسلت نفس الرسالة لهذا الحساب خلال آخر 24 ساعة" };
  const { data: row, error } = await y.from("account_messages").insert({
    user_id: userId, checkout_id: m.checkoutId && UUID.test(m.checkoutId) ? m.checkoutId : null, channel: m.channel, purpose: m.purpose,
    subject, body, cta_url: m.ctaUrl || null, sent_by: bos.userId, sent_by_name: adminName(bos),
  }).select("id").single();
  if (error || !row) return { id: userId, email: acc.email, ok: false, error: error?.message ?? "تعذّر الحفظ" };
  await y.rpc("jobs_enqueue", { p_kind: "email.team_message", p_payload: { messageId: row.id }, p_delay: 0 });
  await audit({ actorId: bos.userId, action: "yolias.user.message", entityType: "yolias_user", entityId: userId, metadata: { userId, channel: m.channel, purpose: m.purpose, subject, messageId: row.id, checkoutId: m.checkoutId ?? null } });
  return { id: userId, email: acc.email, ok: true };
}

export type AccountRow = YTables<"profiles">;
