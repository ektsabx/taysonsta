import "server-only";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { ydb } from "@/lib/yolias/db";
import type { CheckoutSessionRow } from "../../Yolias/types/database";

// Subscriptions & conversions for Admin (owner brief 2026-10-13, D-212).
// Definitions (shown on the pages too):
//   Checkout opened      — the /checkout page created a checkout session.
//   Payment started      — the member pressed pay (server action ran).
//   Gateway redirected   — Yolias sent the member to the provider / opened
//                          Polar's embedded checkout (recorded by the server;
//                          not proof the member saw the provider's page).
//   Payment succeeded    — the provider's signed callback / webhook confirmed it.
//   Subscription active  — Yolias started the trial or plan (subscription_events).
//   Abandoned            — no activity for the configured minutes and no result
//                          that can still arrive (worker, checkout_classify).
//   Failed               — a confirmed failure from the provider or Yolias.
//   Recovered            — a later checkout of the same workspace activated
//                          after this one was abandoned (history kept).
// Money: revenue = live, succeeded payments in USD; "potential value" is an
// estimate of unconverted checkouts (their price when opened), not revenue.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const PAGE = 50;

export const STAGES = [
  ["plans_viewed", "زيارة الخطط"],
  ["plan_selected", "اختيار خطة"],
  ["checkout_opened", "فتح Checkout"],
  ["checkout_details", "بدء إدخال بيانات الاشتراك"],
  ["payment_started", "بدء الدفع"],
  ["gateway_redirected", "الانتقال إلى بوابة الدفع"],
  ["payment_succeeded", "نجاح الدفع"],
  ["subscription_activated", "تفعيل الاشتراك"],
] as const;

export const REASONS: Record<string, string> = {
  left_before_details: "غادر Checkout قبل إكمال البيانات",
  no_payment_started: "لم يبدأ الدفع",
  payment_failed: "فشل الدفع (رفض من البوابة)",
  technical_error: "خطأ تقني",
  gateway_expired: "انتهت صلاحية جلسة الدفع",
  left_at_gateway: "انتقل إلى البوابة ولم تصل نتيجة",
  returned_not_completed: "عاد من البوابة دون إكمال",
  confirmation_missing: "البوابة أبلغت بالنجاح ولم يصل التأكيد (Webhook)",
  canceled_by_user: "ألغى المستخدم العملية",
  unknown: "سبب غير معروف",
};

export const STEP_LABEL: Record<string, string> = {
  checkout_opened: "فتح Checkout", checkout_details: "اختار طريقة الدفع / الخطة", payment_started: "بدأ الدفع", payment_retried: "أعاد محاولة الدفع",
  gateway_redirected: "انتقل إلى البوابة", gateway_returned: "عاد من البوابة", payment_error: "خطأ قبل البوابة", payment_failed: "فشل الدفع",
  payment_succeeded: "اكتمل الدفع", subscription_activated: "تم تفعيل الاشتراك",
};

export function period(sp: Record<string, string>): { since: string; until: string; days: number | null; label: string } {
  const day = 86_400_000;
  if (sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from)) {
    const since = `${sp.from}T00:00:00Z`;
    const until = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? new Date(Date.parse(`${sp.to}T00:00:00Z`) + day).toISOString() : new Date().toISOString();
    return { since, until, days: null, label: `${sp.from} → ${sp.to ?? "اليوم"}` };
  }
  const days = [7, 30, 90].includes(Number(sp.range)) ? Number(sp.range) : 30;
  return { since: new Date(Date.now() - days * day).toISOString(), until: new Date(Date.now() + 60_000).toISOString(), days, label: `آخر ${days} يومًا` };
}

export async function funnel(since: string, until: string, dim: string | null = null) {
  const { data, error } = await ydb().rpc("admin_funnel", { p_since: since, p_until: until, p_dim: dim });
  if (error) throw error;
  const groups = new Map<string, { stage: string; people: number; events: number }[]>();
  for (const r of data ?? []) {
    const list = groups.get(r.dim) ?? [];
    list.push({ stage: r.stage, people: Number(r.people), events: Number(r.events) });
    groups.set(r.dim, list);
  }
  return [...groups.entries()].map(([key, rows]) => ({ key, rows }));
}

async function countOf(q: PromiseLike<{ count: number | null; error: unknown }>) {
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

export async function conversionOverview(since: string, until: string) {
  const y = ydb();
  const cs = () => y.from("checkout_sessions").select("id", { count: "exact", head: true });
  const [stages, opened, started, redirected, abandoned, failedSessions, activated, recovered, paidFromCheckout, activatedFromStarted, payments, canceled, reasons, providers, unconverted] = await Promise.all([
    funnel(since, until).then((g) => g[0]?.rows ?? []),
    countOf(cs().gte("opened_at", since).lt("opened_at", until)),
    countOf(cs().gte("opened_at", since).lt("opened_at", until).not("payment_started_at", "is", null)),
    countOf(cs().gte("opened_at", since).lt("opened_at", until).not("redirected_at", "is", null)),
    countOf(cs().gte("opened_at", since).lt("opened_at", until).not("abandoned_at", "is", null)),
    countOf(cs().gte("opened_at", since).lt("opened_at", until).not("failed_at", "is", null)),
    countOf(cs().gte("activated_at", since).lt("activated_at", until)),
    countOf(cs().gte("recovered_at", since).lt("recovered_at", until)),
    countOf(cs().gte("opened_at", since).lt("opened_at", until).not("paid_at", "is", null)),
    countOf(cs().gte("opened_at", since).lt("opened_at", until).not("payment_started_at", "is", null).not("activated_at", "is", null)),
    y.from("payments").select("status, amount, mode, provider, paid_at, created_at").gte("created_at", since).lt("created_at", until).limit(10000).then((r) => r.data ?? []),
    countOf(y.from("subscription_events").select("id", { count: "exact", head: true }).eq("status", "canceled").gte("created_at", since).lt("created_at", until)),
    y.from("checkout_sessions").select("reason_category").gte("opened_at", since).lt("opened_at", until).not("reason_category", "is", null).limit(10000).then((r) => r.data ?? []),
    y.from("checkout_sessions").select("provider, status").gte("opened_at", since).lt("opened_at", until).limit(10000).then((r) => r.data ?? []),
    y.from("checkout_sessions").select("amount_usd").gte("opened_at", since).lt("opened_at", until).in("status", ["abandoned", "payment_failed"]).is("recovered_at", null).limit(10000).then((r) => r.data ?? []),
  ]);
  const live = payments.filter((p) => p.mode === "live");
  const succeeded = live.filter((p) => p.status === "succeeded" || p.status === "refunded");
  const reasonCounts = new Map<string, number>();
  for (const r of reasons) reasonCounts.set(r.reason_category!, (reasonCounts.get(r.reason_category!) ?? 0) + 1);
  const providerCounts = new Map<string, { opened: number; activated: number }>();
  for (const p of providers) {
    const k = p.provider ?? "—";
    const v = providerCounts.get(k) ?? { opened: 0, activated: 0 };
    v.opened++;
    if (p.status === "activated" || p.status === "paid") v.activated++;
    providerCounts.set(k, v);
  }
  const ratio = (a: number, b: number) => (b ? a / b : null);
  return {
    stages,
    opened, started, redirected, abandoned, failedSessions, activated, recovered, canceled,
    paymentsSucceeded: succeeded.length,
    paymentsFailed: live.filter((p) => p.status === "failed").length,
    paymentsPending: live.filter((p) => p.status === "pending").length,
    revenue: succeeded.reduce((n, p) => n + Number(p.amount), 0),
    testPayments: payments.length - live.length,
    checkoutToPaid: ratio(paidFromCheckout, opened),
    startedToActive: ratio(activatedFromStarted, started),
    abandonRate: ratio(abandoned, opened),
    potentialValue: unconverted.reduce((n, r) => n + Number(r.amount_usd ?? 0), 0),
    reasons: [...reasonCounts.entries()].sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, count, share: reasons.length ? count / reasons.length : 0 })),
    providers: [...providerCounts.entries()].map(([key, v]) => ({ key, ...v })),
  };
}

// ── Checkouts (abandoned / failed / pending / recovered) ───────────────────

export interface CheckoutFilters {
  state?: string;
  plan?: string;
  provider?: string;
  reason?: string;
  country?: string;
  source?: string;
  attempts?: string;
  review?: string;
  from?: string;
  to?: string;
  q?: string;
}

export const CHECKOUT_STATES: Record<string, string> = {
  open: "Checkout مفتوح",
  pending: "في انتظار نتيجة الدفع",
  abandoned: "متروك",
  failed: "دفع فاشل",
  not_back: "لم يعد بعد",
  recovered: "عاد وأكمل الاشتراك",
  activated: "تم تفعيل الاشتراك",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Builder = any;

/** Filters a checkout_sessions query (returned wrapped: a bare builder would run when awaited). */
async function checkoutQuery(q: Builder, f: CheckoutFilters): Promise<{ q: Builder }> {
  switch (f.state) {
    case "open": q = q.in("status", ["opened", "details", "payment_started"]); break;
    case "pending": q = q.eq("status", "awaiting_result"); break;
    case "abandoned": q = q.not("abandoned_at", "is", null); break;
    case "failed": q = q.not("failed_at", "is", null); break;
    case "not_back": q = q.in("status", ["abandoned", "payment_failed"]).is("recovered_at", null); break;
    case "recovered": q = q.not("recovered_at", "is", null); break;
    case "activated": q = q.eq("status", "activated"); break;
    default: q = q.or("abandoned_at.not.is.null,failed_at.not.is.null,status.in.(opened,details,payment_started,awaiting_result,payment_failed,abandoned)");
  }
  if (f.review === "new") q = q.eq("review_status", "new");
  else if (f.review === "reviewed" || f.review === "excluded") q = q.eq("review_status", f.review);
  else q = q.neq("review_status", "excluded");
  if (f.plan) q = q.eq("plan", f.plan);
  if (f.provider) q = q.eq("provider", f.provider);
  if (f.reason) q = q.eq("reason_category", f.reason);
  if (f.country && /^[A-Za-z]{2}$/.test(f.country)) q = q.eq("country", f.country.toUpperCase());
  if (f.source) q = q.eq("source", f.source);
  if (f.attempts && /^\d+$/.test(f.attempts)) q = q.gte("attempts", Number(f.attempts));
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) q = q.gte("opened_at", `${f.from}T00:00:00Z`);
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) q = q.lte("opened_at", `${f.to}T23:59:59Z`);
  const term = (f.q ?? "").replace(/[%,()*]/g, " ").trim();
  if (term) {
    if (UUID.test(term)) {
      const { data: pay } = await ydb().from("payments").select("checkout_id").eq("id", term).maybeSingle();
      q = q.or([`id.eq.${term}`, `user_id.eq.${term}`, `payment_id.eq.${term}`, ...(pay?.checkout_id ? [`id.eq.${pay.checkout_id}`] : [])].join(","));
    } else {
      const { data: users } = await ydb().from("profiles").select("id").ilike("email", `%${term}%`).limit(100);
      const ids = (users ?? []).map((u) => u.id);
      q = ids.length ? q.in("user_id", ids) : q.eq("provider_checkout_id", term);
    }
  }
  return { q };
}

async function enrich(rows: CheckoutSessionRow[]) {
  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
  const wsIds = [...new Set(rows.map((r) => r.workspace_id).filter(Boolean))] as string[];
  const y = ydb();
  const [{ data: users }, { data: phones }, { data: ws }] = await Promise.all([
    userIds.length ? y.from("profiles").select("id, email, full_name, avatar_url").in("id", userIds) : Promise.resolve({ data: [] as { id: string; email: string; full_name: string | null; avatar_url: string | null }[] }),
    userIds.length ? y.from("user_phones").select("user_id, phone").in("user_id", userIds) : Promise.resolve({ data: [] as { user_id: string; phone: string }[] }),
    wsIds.length ? y.from("workspaces").select("id, plan, subscription_status, trial_started_at").in("id", wsIds) : Promise.resolve({ data: [] as { id: string; plan: string; subscription_status: string; trial_started_at: string | null }[] }),
  ]);
  const u = new Map((users ?? []).map((x) => [x.id, x]));
  const p = new Map((phones ?? []).map((x) => [x.user_id, x.phone]));
  const w = new Map((ws ?? []).map((x) => [x.id, x]));
  return rows.map((r) => {
    const wsRow = r.workspace_id ? w.get(r.workspace_id) ?? null : null;
    return {
      ...r,
      user: r.user_id ? u.get(r.user_id) ?? null : null,
      phone: r.user_id ? p.get(r.user_id) ?? null : null,
      workspace: wsRow,
      subscribedNow: wsRow ? ["active", "trialing", "test"].includes(wsRow.subscription_status) : false,
      hadTrial: Boolean(wsRow?.trial_started_at),
      next: nextAction(r, wsRow),
    };
  });
}

/** Suggested next step, from the facts only. */
function nextAction(r: CheckoutSessionRow, ws: { subscription_status: string } | null): string {
  if (r.status === "activated" || (ws && ["active", "trialing"].includes(ws.subscription_status))) return "لا شيء: مشترك الآن";
  if (r.review_status === "excluded") return "مستبعد من المتابعة";
  if (!r.user_id) return "زائر مجهول: لا يمكن التواصل";
  if (r.status === "awaiting_result") return r.return_result === "succeeded" ? "راجع وصول Webhook من مزود الدفع" : "انتظر نتيجة الدفع";
  if (r.status === "payment_failed") return r.reason_category === "technical_error" ? "راجع الخطأ التقني ثم تواصل" : "أرسل رسالة لإعادة المحاولة بطريقة دفع أخرى";
  if (r.status === "abandoned") return r.payment_started_at ? "تواصل لاستكمال الدفع" : "أرسل تذكيرًا بإكمال الاشتراك";
  return "انتظر: العملية ما زالت نشطة";
}

export async function listCheckouts(f: CheckoutFilters, page: number) {
  const { q } = await checkoutQuery(ydb().from("checkout_sessions").select("*", { count: "exact" }), f);
  const { data, count, error } = (await q.order("last_activity_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1)) as { data: CheckoutSessionRow[] | null; count: number | null; error: Error | null };
  if (error) throw error;
  return { total: count ?? 0, pages: Math.max(1, Math.ceil((count ?? 0) / PAGE)), rows: await enrich(data ?? []) };
}

export async function matchingCheckoutIds(f: CheckoutFilters, cap = 1000): Promise<string[]> {
  const { q } = await checkoutQuery(ydb().from("checkout_sessions").select("id"), f);
  const { data } = (await q.limit(cap)) as { data: { id: string }[] | null };
  return (data ?? []).map((r) => r.id);
}

export async function checkoutStateCounts() {
  const out: Record<string, number> = {};
  await Promise.all(Object.keys(CHECKOUT_STATES).map(async (k) => {
    const { q } = await checkoutQuery(ydb().from("checkout_sessions").select("id", { count: "exact", head: true }), { state: k });
    out[k] = ((await q) as { count: number | null }).count ?? 0;
  }));
  return out;
}

export async function checkoutDetail(id: string) {
  if (!UUID.test(id)) throw new NotFoundError();
  const y = ydb();
  const { data: c } = await y.from("checkout_sessions").select("*").eq("id", id).maybeSingle();
  if (!c) throw new NotFoundError();
  const [[row], events, payments, notes, messages, recoveredBy, later] = await Promise.all([
    enrich([c]),
    y.from("funnel_events").select("*").eq("checkout_id", id).order("occurred_at").then((r) => r.data ?? []),
    y.from("payments").select("*").or(`checkout_id.eq.${id}${c.payment_id ? `,id.eq.${c.payment_id}` : ""}`).order("created_at").then((r) => r.data ?? []),
    y.from("account_notes").select("*").eq("checkout_id", id).order("created_at", { ascending: false }).then((r) => r.data ?? []),
    y.from("account_messages").select("*").eq("checkout_id", id).order("created_at", { ascending: false }).then((r) => r.data ?? []),
    c.recovered_by ? y.from("checkout_sessions").select("id, status, activated_at, outcome, plan, billing_period").eq("id", c.recovered_by).maybeSingle().then((r) => r.data) : Promise.resolve(null),
    c.workspace_id ? y.from("checkout_sessions").select("id, status, opened_at, activated_at").eq("workspace_id", c.workspace_id).gt("opened_at", c.opened_at).order("opened_at").limit(20).then((r) => r.data ?? []) : Promise.resolve([]),
  ]);
  return { checkout: row, events, payments, notes, messages, recoveredBy, later };
}

/** Admin follow-up on checkouts: reviewed / excluded (with reason) / assigned / back to new. */
export async function reviewCheckouts(bos: BosUser, ids: string[], action: "reviewed" | "excluded" | "new" | "assign", input: { reason?: string; assignee?: string } = {}) {
  const valid = ids.filter((i) => UUID.test(i)).slice(0, 1000);
  if (!valid.length) throw new ValidationError("اختر حالة واحدة على الأقل.");
  const by = bos.employee?.full_name || bos.email;
  const now = new Date().toISOString();
  let patch: Partial<CheckoutSessionRow>;
  if (action === "excluded") {
    const reason = (input.reason ?? "").trim();
    if (reason.length < 3) throw new ValidationError("سبب الاستبعاد مطلوب.", { reason: "مطلوب" });
    patch = { review_status: "excluded", exclude_reason: reason.slice(0, 300), reviewed_by: by, reviewed_at: now };
  } else if (action === "assign") {
    patch = { assigned_to: (input.assignee ?? "").trim().slice(0, 120) || null };
  } else {
    patch = { review_status: action, reviewed_by: action === "new" ? null : by, reviewed_at: action === "new" ? null : now, ...(action === "new" ? { exclude_reason: null } : {}) };
  }
  const { data, error } = await ydb().from("checkout_sessions").update(patch).in("id", valid).select("id");
  if (error) throw error;
  await audit({ actorId: bos.userId, action: `yolias.checkout.${action}`, entityType: "yolias_checkout", entityId: valid.length === 1 ? valid[0] : null, reason: input.reason ?? null, newValue: patch, metadata: { ids: valid, count: data?.length ?? 0 } });
  return data?.length ?? 0;
}

export async function trackingSettings() {
  const { data } = await ydb().from("site_settings").select("value").eq("key", "checkout_tracking").maybeSingle();
  const v = (data?.value ?? {}) as Record<string, number>;
  return { abandon: v.abandon_minutes ?? 30, result: v.result_minutes ?? 120, confirm: v.confirm_minutes ?? 1440 };
}

export async function saveTrackingSettings(bos: BosUser, abandon: number, result: number) {
  if (!Number.isInteger(abandon) || abandon < 5 || abandon > 10_080) throw new ValidationError("مدة الترك بين 5 دقائق و7 أيام.", { abandon_minutes: "5–10080" });
  if (!Number.isInteger(result) || result < 15 || result > 10_080) throw new ValidationError("مهلة انتظار نتيجة الدفع بين 15 دقيقة و7 أيام.", { result_minutes: "15–10080" });
  const before = await trackingSettings();
  const { error } = await ydb().from("site_settings").upsert({ key: "checkout_tracking", value: { abandon_minutes: abandon, result_minutes: result, confirm_minutes: before.confirm }, updated_at: new Date().toISOString() });
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.checkout.settings", entityType: "yolias_setting", entityId: null, oldValue: before, newValue: { abandon, result } });
}

// ── Failed payments ─────────────────────────────────────────────────────────

export async function failedPayments(since: string, until: string, page: number, provider?: string) {
  let q = ydb().from("payments").select("*", { count: "exact" }).eq("status", "failed").gte("created_at", since).lt("created_at", until);
  if (provider) q = q.eq("provider", provider);
  const { data, count, error } = await q.order("created_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  if (error) throw error;
  const rows = data ?? [];
  const users = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[];
  const { data: profs } = users.length ? await ydb().from("profiles").select("id, email, full_name").in("id", users) : { data: [] };
  const byId = new Map((profs ?? []).map((p) => [p.id, p]));
  const { data: all } = await ydb().from("payments").select("failure_reason").eq("status", "failed").gte("created_at", since).lt("created_at", until).limit(10000);
  const reasons = new Map<string, number>();
  for (const r of all ?? []) reasons.set(r.failure_reason ?? "غير مذكور", (reasons.get(r.failure_reason ?? "غير مذكور") ?? 0) + 1);
  // Checkouts that failed before a payment row existed (e.g. the provider refused to open).
  const { count: technical } = await ydb().from("checkout_sessions").select("id", { count: "exact", head: true }).eq("reason_category", "technical_error").gte("opened_at", since).lt("opened_at", until);
  return {
    total: count ?? 0, pages: Math.max(1, Math.ceil((count ?? 0) / PAGE)),
    rows: rows.map((r) => ({ ...r, user: r.created_by ? byId.get(r.created_by) ?? null : null })),
    reasons: [...reasons.entries()].sort((a, b) => b[1] - a[1]).map(([key, n]) => ({ key, n, share: (all ?? []).length ? n / (all ?? []).length : 0 })),
    technical: technical ?? 0,
  };
}

// ── Free trials ─────────────────────────────────────────────────────────────

export async function trialsOverview(since: string, until: string, page: number, state?: string) {
  const y = ydb();
  const now = new Date().toISOString();
  const soon = new Date(Date.now() + 3 * 86_400_000).toISOString();
  const ev = (status: "trial_started" | "trial_converted" | "trial_ended") => countOf(y.from("subscription_events").select("id", { count: "exact", head: true }).eq("status", status).gte("created_at", since).lt("created_at", until));
  const [started, converted, ended, active, endingSoon, trialWs] = await Promise.all([
    ev("trial_started"), ev("trial_converted"), ev("trial_ended"),
    countOf(y.from("workspaces").select("id", { count: "exact", head: true }).eq("subscription_status", "trialing")),
    countOf(y.from("workspaces").select("id", { count: "exact", head: true }).eq("subscription_status", "trialing").gte("trial_ends_at", now).lte("trial_ends_at", soon)),
    y.from("workspaces").select("id, name, plan, billing_period, subscription_status, trial_started_at, trial_ends_at, cancel_at_period_end, created_at, billing_provider").not("trial_started_at", "is", null).limit(5000).then((r) => r.data ?? []),
  ]);
  const ids = trialWs.map((w) => w.id);
  const [{ data: canceledEv }, { data: paid }, { data: failed }, { data: owners }] = await Promise.all([
    ids.length ? y.from("subscription_events").select("workspace_id, created_at").eq("status", "canceled").in("workspace_id", ids) : Promise.resolve({ data: [] as { workspace_id: string; created_at: string }[] }),
    ids.length ? y.from("payments").select("workspace_id, paid_at").in("workspace_id", ids).in("status", ["succeeded", "refunded"]).eq("mode", "live").order("paid_at") : Promise.resolve({ data: [] as { workspace_id: string; paid_at: string | null }[] }),
    ids.length ? y.from("payments").select("workspace_id, created_at").in("workspace_id", ids).eq("status", "failed") : Promise.resolve({ data: [] as { workspace_id: string; created_at: string }[] }),
    ids.length ? y.from("admin_accounts_v").select("id, email, full_name, workspace_id, created_at").in("workspace_id", ids).eq("role", "owner") : Promise.resolve({ data: [] as { id: string; email: string; full_name: string | null; workspace_id: string | null; created_at: string }[] }),
  ]);
  const firstPaid = new Map<string, string>();
  for (const p of paid ?? []) if (p.paid_at && !firstPaid.has(p.workspace_id)) firstPaid.set(p.workspace_id, p.paid_at);
  const owner = new Map((owners ?? []).map((o) => [o.workspace_id!, o]));
  const rows = trialWs.map((w) => {
    const paidAt = firstPaid.get(w.id) ?? null;
    const canceledDuring = (canceledEv ?? []).some((e) => e.workspace_id === w.id && w.trial_ends_at && e.created_at <= w.trial_ends_at && e.created_at >= (w.trial_started_at ?? ""));
    const failedAfter = (failed ?? []).some((f) => f.workspace_id === w.id && w.trial_ends_at && f.created_at >= w.trial_ends_at);
    const st = paidAt ? "converted" : w.subscription_status === "trialing" ? (canceledDuring || w.cancel_at_period_end ? "canceling" : "active") : failedAfter ? "payment_failed" : canceledDuring ? "canceled" : "ended";
    return { ...w, owner: owner.get(w.id) ?? null, paidAt, state: st };
  });
  const inPeriod = rows.filter((r) => r.trial_started_at && r.trial_started_at >= since && r.trial_started_at < until);
  const hours = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 3_600_000;
  const toPaid = rows.filter((r) => r.paidAt && r.trial_started_at).map((r) => hours(r.trial_started_at!, r.paidAt!));
  const signupToTrial = rows.filter((r) => r.owner && r.trial_started_at).map((r) => hours(r.owner!.created_at, r.trial_started_at!));
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const filtered = state ? rows.filter((r) => r.state === state) : rows;
  filtered.sort((a, b) => Date.parse(b.trial_started_at ?? b.created_at) - Date.parse(a.trial_started_at ?? a.created_at));
  return {
    started, converted, ended, active, endingSoon,
    canceledBeforeEnd: rows.filter((r) => r.state === "canceled" || r.state === "canceling").length,
    failedAfterTrial: rows.filter((r) => r.state === "payment_failed").length,
    endedWithoutPaying: rows.filter((r) => r.state === "ended").length,
    conversionRate: inPeriod.length ? inPeriod.filter((r) => r.state === "converted").length / inPeriod.length : null,
    cancelRate: inPeriod.length ? inPeriod.filter((r) => r.state === "canceled" || r.state === "canceling").length / inPeriod.length : null,
    avgHoursSignupToTrial: avg(signupToTrial),
    avgHoursTrialToPaid: avg(toPaid),
    total: filtered.length,
    pages: Math.max(1, Math.ceil(filtered.length / PAGE)),
    rows: filtered.slice((page - 1) * PAGE, page * PAGE),
  };
}
