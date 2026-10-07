import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueue } from "@/lib/jobs/queue";
import { emailMeta, renderEmail, type EmailData, type EmailKind, type Pref } from "@/lib/email/catalog";
import { sendEmail } from "@/lib/email/send";
import type { Json, WorkspaceRole } from "@/types/database";

// Product email pipeline (docs/05 "Emails"): notify() writes one email_log
// row per recipient (deduplicated by key) and queues an "email.send" job; the
// worker renders and sends it through Resend. Idempotent and retryable
// (rule 18): a sent row is never sent twice.

export interface Recipient {
  userId: string | null;
  email: string;
  locale: "en" | "ar";
  prefs: Partial<Record<Pref, boolean>>;
}

type ProfilePick = { id: string; email: string; language: string; notify_campaign_done: boolean; notify_usage: boolean; notify_billing: boolean; notify_product: boolean };
const PROFILE_COLS = "id, email, language, notify_campaign_done, notify_usage, notify_billing, notify_product";

function toRecipient(p: ProfilePick): Recipient {
  return {
    userId: p.id, email: p.email, locale: p.language === "ar" ? "ar" : "en",
    prefs: { notify_campaign_done: p.notify_campaign_done, notify_usage: p.notify_usage, notify_billing: p.notify_billing, notify_product: p.notify_product },
  };
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200").replace(/\/$/, "");
}

/** Every user, a page at a time (announcements). */
export async function allRecipients(onlyPref: Pref | null, page: number, size = 500): Promise<Recipient[]> {
  let q = createAdminClient().from("profiles").select(PROFILE_COLS).order("created_at").range(page * size, page * size + size - 1);
  if (onlyPref) q = q.eq(onlyPref, true);
  const { data } = await q;
  return (data ?? []).map(toRecipient);
}

export async function userRecipient(userId: string | null | undefined): Promise<Recipient[]> {
  if (!userId) return [];
  const { data } = await createAdminClient().from("profiles").select(PROFILE_COLS).eq("id", userId).maybeSingle();
  return data ? [toRecipient(data)] : [];
}

/** Owners and admins by default: they manage plan and usage. */
export async function workspaceRecipients(workspaceId: string, roles: WorkspaceRole[] = ["owner", "admin"]): Promise<Recipient[]> {
  const db = createAdminClient();
  const { data: members } = await db.from("workspace_members").select("user_id").eq("workspace_id", workspaceId).in("role", roles);
  const ids = (members ?? []).map((m) => m.user_id);
  if (!ids.length) return [];
  const { data } = await db.from("profiles").select(PROFILE_COLS).in("id", ids);
  return (data ?? []).map(toRecipient);
}

type Payload<K extends EmailKind> = Omit<EmailData[K], "siteUrl">;

// Events that also appear in the in-app notifications (bell). Account
// housekeeping mails (welcome, deleted, sign-in links) stay email-only.
const IN_APP = new Set<EmailKind>([
  "discovery_ready", "usage_low", "usage_limit", "prospects_added", "plan_welcome", "subscription_activated", "subscription_renewed",
  "subscription_ending", "subscription_canceled", "plan_upgraded", "plan_downgraded", "receipt", "payment_failed", "invoice_ready",
  "refund_processed", "refund_issued", "payment_overdue", "announcement", "security_alert", "suspicious_sign_in", "new_sign_in",
] as EmailKind[]);

/** Where a notice opens in the app. */
function linkFor(kind: EmailKind, data: Record<string, unknown>): string | null {
  if (typeof data.invoiceId === "string" && data.invoiceId !== "sample") return `/invoices/${data.invoiceId}`;
  if (typeof data.strategyId === "string") return `/search/${data.strategyId}`;
  if (kind.startsWith("usage_") || kind === "prospects_added") return "/prospects";
  if (kind.startsWith("plan_") || kind.startsWith("subscription_") || kind.startsWith("payment_")) return "/checkout";
  if (kind === "announcement" && typeof data.ctaUrl === "string" && data.ctaUrl.startsWith("/")) return data.ctaUrl;
  return null;
}

/** Admin switches per event (email_settings); no row = on. Cached briefly. */
let settingsCache: { at: number; map: Map<string, { email: boolean; inApp: boolean }> } | null = null;
async function eventSwitch(kind: EmailKind): Promise<{ email: boolean; inApp: boolean }> {
  if (!settingsCache || Date.now() - settingsCache.at > 30_000) {
    const { data } = await createAdminClient().from("email_settings").select("kind, email_enabled, in_app_enabled");
    settingsCache = { at: Date.now(), map: new Map((data ?? []).map((r) => [r.kind, { email: r.email_enabled, inApp: r.in_app_enabled }])) };
  }
  return settingsCache.map.get(kind) ?? { email: true, inApp: true };
}

/** One in-app notice in the recipient's language (title = the email's subject). Never throws. */
async function notifyInApp<K extends EmailKind>(kind: K, r: Recipient, payload: Payload<K>, opts: { workspaceId?: string | null; dedupe?: string }) {
  if (!r.userId) return;
  try {
    const { subject } = renderEmail(kind, r.locale, { ...(payload as object), siteUrl: siteUrl() } as EmailData[K]);
    const row = {
      user_id: r.userId, workspace_id: opts.workspaceId ?? null, kind, title: subject.slice(0, 300),
      link: linkFor(kind, payload as unknown as Record<string, unknown>), dedupe_key: opts.dedupe ? `${kind}:${opts.dedupe}:${r.userId}` : null,
    };
    const db = createAdminClient();
    await (opts.dedupe ? db.from("notifications").upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: true }) : db.from("notifications").insert(row));
  } catch (e) {
    console.error(`[notify] in-app ${kind} failed`, e);
  }
}

/**
 * Queues `kind` for each recipient who hasn't turned it off. `dedupe` makes
 * it once-only per recipient (e.g. `${workspaceId}:${month}`). Returns how
 * many emails were queued. `data` may depend on the recipient's language
 * (plan names). Never throws: email must not break the event.
 */
export async function notify<K extends EmailKind>(kind: K, to: Recipient[], data: Payload<K> | ((locale: "en" | "ar") => Payload<K>), opts: { workspaceId?: string | null; dedupe?: string; ignorePrefs?: boolean } = {}): Promise<number> {
  const { category, pref } = emailMeta(kind);
  const on = await eventSwitch(kind).catch(() => ({ email: true, inApp: true }));
  let queued = 0;
  for (const r of to) {
    // In-app notices don't follow the email preferences: they're the quiet channel.
    if (on.inApp && IN_APP.has(kind)) await notifyInApp(kind, r, typeof data === "function" ? data(r.locale) : data, opts);
    if (!on.email) continue;
    if (pref && !opts.ignorePrefs && r.prefs[pref] === false) continue;
    try {
      const row = {
        kind, category, to_email: r.email, user_id: r.userId, workspace_id: opts.workspaceId ?? null, locale: "en" as const,
        // Emails are always in English (D-158).
        data: (typeof data === "function" ? data("en") : data) as unknown as Json, dedupe_key: opts.dedupe ? `${kind}:${opts.dedupe}:${r.email.toLowerCase()}` : null,
      };
      const db = createAdminClient();
      const { data: inserted, error } = opts.dedupe
        ? await db.from("email_log").upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: true }).select("id")
        : await db.from("email_log").insert(row).select("id");
      if (error) throw error;
      const id = inserted?.[0]?.id;
      if (!id) continue; // already queued or sent before
      await enqueue("email.send", { logId: id });
      queued++;
    } catch (e) {
      console.error(`[email] couldn't queue ${kind}`, e);
    }
  }
  return queued;
}

/** Worker: renders and sends one logged email. Throws on a retryable failure. */
export async function deliverEmail(logId: number): Promise<void> {
  const db = createAdminClient();
  const { data: row } = await db.from("email_log").select("*").eq("id", logId).maybeSingle();
  if (!row || row.status === "sent" || row.status === "skipped") return;
  const kind = row.kind as EmailKind;
  const email = renderEmail(kind, "en", { ...(row.data as object), siteUrl: siteUrl() } as EmailData[typeof kind]);
  const result = await sendEmail(row.to_email, email, row.category);
  const attempts = row.attempts + 1;
  if (result.status === "sent") {
    await db.from("email_log").update({ status: "sent", provider_id: result.id, attempts, sent_at: new Date().toISOString(), error: null }).eq("id", logId);
  } else if (result.status === "skipped") {
    // Not configured or invalid address: retrying won't help, and nothing is faked.
    await db.from("email_log").update({ status: "skipped", error: result.reason, attempts }).eq("id", logId);
  } else {
    await db.from("email_log").update({ status: "failed", error: result.error, attempts }).eq("id", logId);
    throw new Error(`email ${logId} failed: ${result.error}`);
  }
}
