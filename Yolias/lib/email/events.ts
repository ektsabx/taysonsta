import "server-only";
import { monthlyUsage } from "@/services/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlanCatalog } from "@/lib/plan-catalog";
import { isPaidPlan } from "@/lib/plans";
import { dictionaries } from "@/lib/i18n/config";
import { notify, userRecipient, workspaceRecipients } from "@/lib/email/notify";
import type { BillingPeriod, Currency, Plan, WorkspaceRow } from "@/types/database";

// Email triggers: one function per real event. Callers never await email
// success; every function here swallows its own errors (notify does too).

const planName = (plan: Plan) => (l: "en" | "ar") => dictionaries[l].plans[plan];

/* ───────────────────────── Discovery & usage ───────────────────────── */

/** A campaign finished (completed or partial): tell whoever started it. */
export async function campaignFinished(campaignId: string) {
  const db = createAdminClient();
  const { data: c } = await db.from("campaigns").select("workspace_id, strategy_id, name, created_by, prospects_found, companies_found, status").eq("id", campaignId).maybeSingle();
  if (!c || !c.strategy_id || (c.status !== "completed" && c.status !== "partial")) return;
  const { data: s } = await db.from("strategies").select("title").eq("id", c.strategy_id).maybeSingle();
  await notify("discovery_ready", await userRecipient(c.created_by), {
    strategyId: c.strategy_id, strategyTitle: s?.title ?? c.name, prospects: c.prospects_found, companies: c.companies_found,
  }, { workspaceId: c.workspace_id, dedupe: campaignId });
}

/**
 * Usage alerts from the ledger (rule 26: prospects, never credits): "running
 * low" at 80 % of the month's allowance, "limit reached" at 100 %. Each fires
 * once per workspace per month.
 */
export async function usageAlerts(workspaceId: string) {
  const u = await monthlyUsage(workspaceId);
  if (u.allowance <= 0) return;
  const used = u.prospects;
  const level = used >= u.allowance ? "usage_limit" : used >= u.allowance * 0.8 ? "usage_low" : null;
  if (!level) return;
  // Free is one-time (D-138): no reset date, and each alert fires once ever.
  const payload = { used, total: u.allowance, resetsAt: u.resetsAt };
  await notify(level, await workspaceRecipients(workspaceId), payload, { workspaceId, dedupe: u.resetsAt ? `${workspaceId}:${u.resetsAt.slice(0, 7)}` : `${workspaceId}:free` });
}

/* ───────────────────────── Subscription ───────────────────────── */

/** After startPlan(): welcome, re-activation, upgrade or downgrade (+ receipt for paid plans). */
export async function planStarted(before: WorkspaceRow, plan: Plan, period: BillingPeriod, charge: { amount: number; currency: Currency; test: boolean }, periodEnd: string | null, invoice: { id: string; number: string; created_at: string } | null, payerId: string) {
  try {
    const catalog = await getPlanCatalog();
    const admins = await workspaceRecipients(before.id);
    const ws = before.id;
    const { amount, currency, test } = charge;
    if (invoice && periodEnd) {
      await notify("receipt", await userRecipient(payerId), (l) => ({
        invoiceId: invoice.id, invoiceNumber: invoice.number, planName: planName(plan)(l), period, amount, currency, date: invoice.created_at, periodEnd, test,
      }), { workspaceId: ws, dedupe: invoice.id });
    }
    const wasPaid = isPaidPlan(before.plan) && before.subscription_status !== "none";
    if (!isPaidPlan(plan)) {
      if (wasPaid) {
        await notify("plan_downgraded", admins, (l) => ({
          planName: planName(plan)(l), fromPlanName: planName(before.plan)(l), period, amount: 0, periodEnd: new Date().toISOString(), test, prospectsPerMonth: catalog[plan].prospects,
        }), { workspaceId: ws });
      }
      return;
    }
    if (!periodEnd) return;
    const base = (l: "en" | "ar") => ({ planName: planName(plan)(l), period, amount, currency, periodEnd, test });
    if (!wasPaid) {
      const { count } = await createAdminClient().from("subscription_events").select("id", { count: "exact", head: true })
        .eq("workspace_id", ws).in("plan", ["pro", "growth"]).in("status", ["activated", "changed"]);
      // count includes the event just written for this activation.
      if ((count ?? 0) <= 1) await notify("plan_welcome", admins, (l) => ({ ...base(l), prospectsPerMonth: catalog[plan].prospects }), { workspaceId: ws, dedupe: `${ws}:welcome:${plan}` });
      else await notify("subscription_activated", admins, base, { workspaceId: ws });
      return;
    }
    if (before.plan === plan) return;
    const up = catalog[plan].prospects > catalog[before.plan].prospects || (catalog[plan].prospects === catalog[before.plan].prospects && catalog[plan].priceUsd > catalog[before.plan].priceUsd);
    await notify(up ? "plan_upgraded" : "plan_downgraded", admins, (l) => ({ ...base(l), fromPlanName: planName(before.plan)(l), prospectsPerMonth: catalog[plan].prospects }), { workspaceId: ws });
  } catch (e) {
    console.error("[email] planStarted", e);
  }
}

export async function planCanceled(ws: WorkspaceRow, cancel: boolean) {
  if (!ws.current_period_end) return;
  const endsAt = ws.current_period_end;
  if (cancel) {
    await notify("subscription_canceled", await workspaceRecipients(ws.id), (l) => ({ planName: planName(ws.plan)(l), endsAt }), { workspaceId: ws.id });
  } else {
    await notify("subscription_activated", await workspaceRecipients(ws.id), (l) => ({
      planName: planName(ws.plan)(l), period: ws.billing_period, amount: 0, periodEnd: endsAt, test: ws.subscription_status === "test",
    }), { workspaceId: ws.id });
  }
}

/** A canceled plan reached its end and the workspace moved to Free. */
export async function planEnded(ws: WorkspaceRow) {
  const catalog = await getPlanCatalog();
  await notify("plan_downgraded", await workspaceRecipients(ws.id), (l) => ({
    planName: planName("free")(l), fromPlanName: planName(ws.plan)(l), period: "monthly" as const, amount: 0, periodEnd: new Date().toISOString(), test: true, prospectsPerMonth: catalog.free.prospects,
  }), { workspaceId: ws.id, dedupe: `${ws.id}:ended:${ws.current_period_end}` });
}

/* ───────────────────────── Account & security ───────────────────────── */

export async function welcome(userId: string, name: string | null) {
  await notify("welcome", await userRecipient(userId), { name }, { dedupe: userId });
}

const DEVICE_LABELS: [RegExp, string][] = [
  [/Edg\//, "Edge"], [/OPR\//, "Opera"], [/Chrome\//, "Chrome"], [/Firefox\//, "Firefox"], [/Safari\//, "Safari"],
];
const OS_LABELS: [RegExp, string][] = [[/iPhone|iPad/, "iOS"], [/Android/, "Android"], [/Mac OS X/, "macOS"], [/Windows/, "Windows"], [/Linux/, "Linux"]];
export function deviceLabel(ua: string): string {
  const browser = DEVICE_LABELS.find(([re]) => re.test(ua))?.[1] ?? "Browser";
  const os = OS_LABELS.find(([re]) => re.test(ua))?.[1];
  return os ? `${browser} · ${os}` : browser;
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * After a successful sign-in: remember the device; email "New sign-in" when
 * it's a device we haven't seen for this user (not on the very first one).
 */
export async function signedIn(userId: string, userAgent: string, ip: string | null) {
  try {
    const db = createAdminClient();
    const hash = await sha256(userAgent || "unknown");
    const label = deviceLabel(userAgent);
    const { count } = await db.from("known_devices").select("device_hash", { count: "exact", head: true }).eq("user_id", userId);
    const { data: existing } = await db.from("known_devices").select("device_hash").eq("user_id", userId).eq("device_hash", hash).maybeSingle();
    const now = new Date().toISOString();
    if (existing) {
      await db.from("known_devices").update({ last_seen: now }).eq("user_id", userId).eq("device_hash", hash);
      return;
    }
    await db.from("known_devices").insert({ user_id: userId, device_hash: hash, label });
    if ((count ?? 0) > 0) await notify("new_sign_in", await userRecipient(userId), { at: now, device: label, ip }, { dedupe: `${userId}:${hash}` });
  } catch (e) {
    console.error("[email] signedIn", e);
  }
}

const SUSPICIOUS_WINDOW_MIN = 60;
const SUSPICIOUS_COUNT = 5;

/** Each sign-in link request; many in an hour for an existing account ⇒ one alert per hour. */
export async function signInRequested(email: string) {
  try {
    const db = createAdminClient();
    const addr = email.trim().toLowerCase();
    await db.from("sign_in_requests").insert({ email: addr });
    const since = new Date(Date.now() - SUSPICIOUS_WINDOW_MIN * 60_000).toISOString();
    const { count } = await db.from("sign_in_requests").select("id", { count: "exact", head: true }).eq("email", addr).gte("created_at", since);
    if ((count ?? 0) < SUSPICIOUS_COUNT) return;
    const { data: profile } = await db.from("profiles").select("id").eq("email", addr).maybeSingle();
    if (!profile) return;
    const hour = new Date().toISOString().slice(0, 13);
    await notify("suspicious_sign_in", await userRecipient(profile.id), { attempts: count ?? SUSPICIOUS_COUNT, windowMinutes: SUSPICIOUS_WINDOW_MIN }, { dedupe: `${profile.id}:${hour}` });
  } catch (e) {
    console.error("[email] signInRequested", e);
  }
}

export async function securityAlert(userId: string, event: "signed_out_everywhere" | "email_changed" | "account_suspended" | "account_restored") {
  await notify("security_alert", await userRecipient(userId), { event, at: new Date().toISOString() });
}
