import "server-only";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CheckoutSessionRow, CheckoutStatus, Json, WorkspaceRow } from "@/types/database";

// Subscription journey tracking (owner brief 2026-10-13, D-212). Two records:
//   checkout_sessions — one row per checkout attempt and where it got to;
//   funnel_events     — append-only events, each with a unique key, so a
//                       repeated webhook / reload never counts twice.
// Payment results and plan activation are written by database triggers on
// `payments` and `subscription_events` (server truth only). This module adds
// what only the app knows: opening the checkout, choosing the method,
// starting the payment, the redirect to the provider and the return.
// Tracking never breaks the checkout: every call here swallows its errors.

type Db = ReturnType<typeof createAdminClient>;

/** A reopened checkout continues the same session within this window; after it a new one starts. */
const REOPEN_MINUTES = 30;
const OPEN: CheckoutStatus[] = ["opened", "details", "payment_started", "awaiting_result", "payment_failed"];

export interface FunnelEvent {
  name: string;
  key?: string;
  userId?: string | null;
  workspaceId?: string | null;
  checkoutId?: string | null;
  paymentId?: string | null;
  provider?: string | null;
  plan?: string | null;
  period?: string | null;
  confirmed?: boolean;
  source?: "client" | "server" | "webhook" | "worker" | "admin";
  props?: Record<string, Json | undefined>;
  visitorId?: string | null;
}

export async function trackEvent(e: FunnelEvent, db: Db = createAdminClient()): Promise<void> {
  try {
    await db.from("funnel_events").insert({
      event_key: e.key ?? `${e.name}:${randomUUID()}`,
      name: e.name,
      user_id: e.userId ?? null,
      visitor_id: e.visitorId ?? null,
      workspace_id: e.workspaceId ?? null,
      checkout_id: e.checkoutId ?? null,
      payment_id: e.paymentId ?? null,
      provider: e.provider ?? null,
      plan: e.plan ?? null,
      billing_period: e.period ?? null,
      confirmed: e.confirmed ?? true,
      source: e.source ?? "server",
      props: (e.props ?? {}) as Json,
    });
  } catch (err) {
    console.error("[funnel] event", e.name, err instanceof Error ? err.message : err);
  }
}

/** Device class and browser from the User-Agent (no fingerprinting, nothing stored beyond these labels). */
export function deviceOf(ua: string | null): { device: string; browser: string; os: string } {
  const u = ua ?? "";
  const device = /iPad|Tablet/i.test(u) ? "tablet" : /Mobi|Android|iPhone/i.test(u) ? "mobile" : u ? "desktop" : "unknown";
  const browser = /Edg\//.test(u) ? "Edge" : /OPR\/|Opera/.test(u) ? "Opera" : /SamsungBrowser/.test(u) ? "Samsung Internet" : /Chrome\//.test(u) ? "Chrome"
    : /Firefox\//.test(u) ? "Firefox" : /Safari\//.test(u) ? "Safari" : "Other";
  const os = /Windows/.test(u) ? "Windows" : /iPhone|iPad|iOS/.test(u) ? "iOS" : /Android/.test(u) ? "Android" : /Mac OS X/.test(u) ? "macOS" : /Linux/.test(u) ? "Linux" : "Other";
  return { device, browser, os };
}

async function requestDevice() {
  try {
    const h = await headers();
    return { ...deviceOf(h.get("user-agent")), country: h.get("cf-ipcountry")?.slice(0, 2) ?? null };
  } catch {
    return { device: "unknown", browser: "Other", os: "Other", country: null };
  }
}

/**
 * The checkout page was opened (server render). Reloads and re-renders within
 * the reopen window continue the same session; a checkout that was abandoned
 * or finished starts a new one. Returns the session id (null if tracking failed).
 */
export async function openCheckout(ws: WorkspaceRow, userId: string, opts: { plan: string; period: string; amountUsd: number | null; trialOffered: boolean; source?: string | null }): Promise<string | null> {
  try {
    const db = createAdminClient();
    const since = new Date(Date.now() - REOPEN_MINUTES * 60_000).toISOString();
    const { data: open } = await db.from("checkout_sessions").select("id, plan, billing_period")
      .eq("workspace_id", ws.id).eq("user_id", userId).in("status", OPEN).gte("last_activity_at", since)
      .order("last_activity_at", { ascending: false }).limit(1).maybeSingle();
    if (open) {
      await db.from("checkout_sessions").update({ last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", open.id);
      return open.id;
    }
    const d = await requestDevice();
    const { data: profile } = await db.from("profiles").select("acquisition_source").eq("id", userId).maybeSingle();
    const { data: row } = await db.from("checkout_sessions").insert({
      workspace_id: ws.id, user_id: userId, plan: opts.plan, billing_period: opts.period, amount_usd: opts.amountUsd,
      trial_offered: opts.trialOffered, source: opts.source ?? profile?.acquisition_source ?? null, device: d.device, browser: d.browser, country: d.country,
    }).select("id").single();
    if (!row) return null;
    await trackEvent({ name: "checkout_opened", key: `checkout_opened:${row.id}`, userId, workspaceId: ws.id, checkoutId: row.id, plan: opts.plan, period: opts.period, props: { device: d.device, browser: d.browser, amount: opts.amountUsd } }, db);
    return row.id;
  } catch (err) {
    console.error("[funnel] open checkout", err instanceof Error ? err.message : err);
    return null;
  }
}

/** The member's open checkout session for this workspace (the latest one), if any. */
export async function currentCheckout(workspaceId: string, userId: string): Promise<Pick<CheckoutSessionRow, "id" | "status" | "attempts"> | null> {
  try {
    const { data } = await createAdminClient().from("checkout_sessions").select("id, status, attempts")
      .eq("workspace_id", workspaceId).eq("user_id", userId).in("status", [...OPEN, "abandoned"])
      .order("last_activity_at", { ascending: false }).limit(1).maybeSingle();
    return data;
  } catch {
    return null;
  }
}

type Step = "details" | "payment_started" | "redirected" | "returned" | "payment_error";

const RANK: Record<string, number> = { opened: 1, abandoned: 1, details: 2, payment_failed: 3, payment_started: 3, awaiting_result: 4, paid: 7, activated: 8, closed: 9 };

/**
 * Moves a checkout forward. Never moves it back past a confirmed result
 * (paid / activated); a retry after a failure goes back to payment_started.
 * Coming back to an abandoned checkout continues it (abandoned_at stays).
 */
export async function checkoutStep(checkoutId: string | null | undefined, step: Step, info: { userId?: string | null; workspaceId?: string | null; provider?: string | null; plan?: string | null; period?: string | null; paymentId?: string | null; result?: string | null; reason?: string | null; key?: string; signed?: boolean } = {}): Promise<void> {
  if (!checkoutId) return;
  try {
    const db = createAdminClient();
    const { data: c } = await db.from("checkout_sessions").select("*").eq("id", checkoutId).maybeSingle();
    if (!c) return;
    const now = new Date().toISOString();
    const done = c.status === "paid" || c.status === "activated" || c.status === "closed";
    const patch: Partial<CheckoutSessionRow> = { last_activity_at: now, updated_at: now };
    if (info.provider) patch.provider = info.provider;
    if (info.plan) patch.plan = info.plan;
    if (info.period) patch.billing_period = info.period;
    if (step === "details") {
      patch.details_at = c.details_at ?? now;
      if (!done && RANK[c.status] < RANK.details) { patch.status = "details"; patch.last_step = "checkout_details"; }
    } else if (step === "payment_started") {
      patch.payment_started_at = c.payment_started_at ?? now;
      patch.attempts = c.attempts + 1;
      if (!done) { patch.status = "payment_started"; patch.last_step = c.status === "payment_failed" ? "payment_retried" : "payment_started"; patch.failure_reason = null; }
    } else if (step === "redirected") {
      patch.redirected_at = now;
      if (info.paymentId) patch.payment_id = info.paymentId;
      if (!done) { patch.status = "awaiting_result"; patch.last_step = "gateway_redirected"; }
    } else if (step === "returned") {
      patch.returned_at = now;
      patch.return_result = info.result ?? null;
      if (!done && c.status !== "payment_failed") { patch.status = "awaiting_result"; patch.last_step = "gateway_returned"; }
    } else if (step === "payment_error") {
      if (!done) { patch.status = "payment_failed"; patch.last_step = "payment_error"; patch.failed_at = now; patch.failure_reason = info.reason ?? "technical_error"; patch.reason_category = "technical_error"; }
    }
    await db.from("checkout_sessions").update(patch).eq("id", c.id);
    const name = step === "details" ? "checkout_details" : step === "redirected" ? "gateway_redirected" : step === "returned" ? "gateway_returned" : step;
    await trackEvent({
      name, key: info.key, userId: info.userId ?? c.user_id, workspaceId: info.workspaceId ?? c.workspace_id, checkoutId: c.id, paymentId: info.paymentId ?? null,
      provider: info.provider ?? c.provider, plan: info.plan ?? c.plan, period: info.period ?? c.billing_period,
      // A redirect is recorded by the server; it doesn't prove the member saw the
      // provider's page. A return is confirmed only when the provider signed it.
      confirmed: step !== "returned" || Boolean(info.signed),
      props: { ...(info.result ? { result: info.result } : {}), ...(info.reason ? { reason: info.reason } : {}), attempt: patch.attempts ?? c.attempts },
    }, db);
  } catch (err) {
    console.error("[funnel] step", step, err instanceof Error ? err.message : err);
  }
}

/** Opening the app: one session per 30 idle minutes (pinged by the app while visible). */
export async function pingAppSession(userId: string, workspaceId: string | null, ua: string | null): Promise<void> {
  try {
    const d = deviceOf(ua);
    await createAdminClient().rpc("app_session_ping", { p_user: userId, p_workspace: workspaceId, p_device: d.device, p_browser: d.browser, p_os: d.os });
  } catch {
    // never blocks the app
  }
}

/** Checkout tracking settings (Admin → Abandoned checkouts). */
export async function trackingSettings(db: Db = createAdminClient()): Promise<{ abandon_minutes: number; result_minutes: number; confirm_minutes: number }> {
  const { data } = await db.from("site_settings").select("value").eq("key", "checkout_tracking").maybeSingle();
  const v = (data?.value ?? {}) as Record<string, unknown>;
  const n = (x: unknown, d: number, min: number) => (typeof x === "number" && x >= min && x <= 10_080 ? Math.round(x) : d);
  return { abandon_minutes: n(v.abandon_minutes, 30, 5), result_minutes: n(v.result_minutes, 120, 15), confirm_minutes: n(v.confirm_minutes, 1440, 60) };
}

/** Worker: marks quiet checkouts abandoned (never one whose payment can still land). */
export async function classifyCheckouts(): Promise<number> {
  const db = createAdminClient();
  const s = await trackingSettings(db);
  const { data } = await db.rpc("checkout_classify", { p_abandon_minutes: s.abandon_minutes, p_result_minutes: s.result_minutes, p_confirm_minutes: s.confirm_minutes });
  return data ?? 0;
}
