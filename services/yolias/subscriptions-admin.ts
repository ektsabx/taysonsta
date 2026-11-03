import "server-only";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { ydb } from "@/lib/yolias/db";

// A workspace's subscription from Yolias Admin (owner, 2026-11-03, D-276):
// activate a plan without payment, renew a period, cancel now or at the end
// of the period. Same states as Yolias's own billing (Yolias/lib/billing.ts).
// A plan the team activates or renews without a payment is recorded in test
// mode: the member gets the full plan, and it is never counted as revenue or
// MRR. platform.manage only; every change is audited, with the reason.

const DAY = 86_400_000;
const PLANS = ["growth", "scale", "pro"] as const;
type PaidPlan = (typeof PLANS)[number];

function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

async function load(workspaceId: string) {
  const { data: ws } = await ydb().from("workspaces").select("id, plan, subscription_status, billing_period, current_period_end, cancel_at_period_end, billing_currency").eq("id", workspaceId).maybeSingle();
  if (!ws) throw new NotFoundError();
  return ws;
}
const reasonOf = (r: string) => {
  const why = r.trim();
  if (why.length < 3 || why.length > 300) throw new ValidationError("السبب مطلوب (3 أحرف على الأقل).", { reason: "مطلوب" });
  return why;
};

/** Activates (or changes) a plan without a payment, for `months` (1 to 24). */
export async function activateWithoutPayment(bos: BosUser, workspaceId: string, input: { plan: string; period: "monthly" | "annual"; months: number; reason: string }) {
  if (!(PLANS as readonly string[]).includes(input.plan)) throw new ValidationError("خطة غير معروفة.", { plan: "اختر خطة" });
  const months = Math.round(input.months);
  if (!Number.isFinite(months) || months < 1 || months > 24) throw new ValidationError("المدة غير صالحة.", { months: "من 1 إلى 24 شهرًا" });
  const why = reasonOf(input.reason);
  const ws = await load(workspaceId);
  const end = addMonths(new Date(), months);
  const next = { plan: input.plan as PaidPlan, billing_period: input.period, subscription_status: "test" as const, current_period_end: end.toISOString(), cancel_at_period_end: false };
  const { error } = await ydb().from("workspaces").update(next).eq("id", workspaceId);
  if (error) throw error;
  await ydb().from("subscription_events").insert({ workspace_id: workspaceId, plan: next.plan, status: ws.subscription_status === "none" || ws.subscription_status === "canceled" ? "activated" : "changed", amount: 0, currency: ws.billing_currency, billing_period: input.period, mode: "test" });
  await audit({ actorId: bos.userId, action: "yolias.subscription.activate", entityType: "yolias_workspace", entityId: workspaceId, oldValue: { plan: ws.plan, status: ws.subscription_status, end: ws.current_period_end }, newValue: next, reason: why });
}

/** Renews the current plan for one more period (or `months`), without a payment. */
export async function renewPeriod(bos: BosUser, workspaceId: string, input: { months?: number; reason: string }) {
  const why = reasonOf(input.reason);
  const ws = await load(workspaceId);
  if (!(PLANS as readonly string[]).includes(ws.plan)) throw new ValidationError("لا توجد خطة لتجديدها: فعّل خطة أولًا.");
  const months = Math.round(input.months ?? (ws.billing_period === "annual" ? 12 : 1));
  if (months < 1 || months > 24) throw new ValidationError("المدة غير صالحة.", { months: "من 1 إلى 24 شهرًا" });
  const base = ws.current_period_end && Date.parse(ws.current_period_end) > Date.now() ? new Date(ws.current_period_end) : new Date();
  const end = addMonths(base, months);
  // A live subscription stays live (its next charge simply moves); anything else is a plan without payment.
  const status = ws.subscription_status === "active" ? "active" : "test";
  const next = { subscription_status: status as "active" | "test", current_period_end: end.toISOString(), cancel_at_period_end: false };
  const { error } = await ydb().from("workspaces").update(next).eq("id", workspaceId);
  if (error) throw error;
  await ydb().from("subscription_events").insert({ workspace_id: workspaceId, plan: ws.plan, status: "renewed", amount: 0, currency: ws.billing_currency, billing_period: ws.billing_period, mode: "test" });
  await audit({ actorId: bos.userId, action: "yolias.subscription.renew", entityType: "yolias_workspace", entityId: workspaceId, oldValue: { end: ws.current_period_end, status: ws.subscription_status }, newValue: next, reason: why });
}

/** Cancels: at the end of the paid period (it stays usable until then), or now. */
export async function cancelSubscription(bos: BosUser, workspaceId: string, input: { when: "end" | "now"; reason: string }) {
  const why = reasonOf(input.reason);
  const ws = await load(workspaceId);
  if (!["active", "test", "past_due"].includes(ws.subscription_status)) throw new ValidationError("لا يوجد اشتراك فعّال لإلغائه.");
  const mode = ws.subscription_status === "test" ? "test" : "live";
  if (input.when === "end" && ws.current_period_end && Date.parse(ws.current_period_end) > Date.now() + DAY / 24) {
    const { error } = await ydb().from("workspaces").update({ cancel_at_period_end: true }).eq("id", workspaceId);
    if (error) throw error;
    await ydb().from("subscription_events").insert({ workspace_id: workspaceId, plan: ws.plan, status: "canceled", amount: 0, currency: ws.billing_currency, billing_period: ws.billing_period, mode });
  } else {
    const { error } = await ydb().from("workspaces").update({ subscription_status: "canceled", current_period_end: null, cancel_at_period_end: false }).eq("id", workspaceId);
    if (error) throw error;
    await ydb().from("subscription_events").insert({ workspace_id: workspaceId, plan: ws.plan, status: "ended", amount: 0, currency: ws.billing_currency, billing_period: ws.billing_period, mode });
  }
  await audit({ actorId: bos.userId, action: `yolias.subscription.cancel_${input.when}`, entityType: "yolias_workspace", entityId: workspaceId, oldValue: { status: ws.subscription_status, end: ws.current_period_end }, newValue: { when: input.when }, reason: why });
}
