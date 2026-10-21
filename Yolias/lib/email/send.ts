import "server-only";
import type { RenderedEmail } from "@/lib/email/templates";
import { integrationConfig, integrationSecret, loadIntegrations } from "@/lib/integrations";

// Product emails (receipts, plan ending, usage, discovery ready) through
// Resend — the same account Taysonsta uses (docs/12-decisions.md D-111).
// Sign-in emails don't come here: Supabase Auth sends them (via Resend SMTP).
// The key and sender come from Yolias Admin → Integrations → Resend (D-132,
// copied to integration_keys "resend"); the variables below override them.
//   RESEND_API_KEY   without a key emails are skipped, never faked
//   RESEND_FROM      "Name <address>" on a domain verified in Resend
//   EMAIL_FROM       optional override of the full From header
//   EMAIL_DOMAIN     optional sending domain for per-category senders
//                    (billing@, usage@, updates@, security@, no-reply@);
//                    without it every category uses the RESEND_FROM address.
//   EMAIL_FROM_<CATEGORY>  optional full From override per category
//   RESEND_API_URL   optional, for tests (a local capture server)
// The display name is "Yolias" (billing: "Yolias Billing", security:
// "Yolias Security") unless EMAIL_FROM says otherwise.

/**
 * "sent" = Resend accepted the request (not proof of delivery: the webhook
 * reports delivered / bounced later). "failed" with retry=false is permanent
 * (Resend rejected the request itself); otherwise the job retries.
 */
export type SendResult = { status: "sent"; id: string | null } | { status: "skipped"; reason: string } | { status: "failed"; error: string; retry: boolean };

export type EmailCategory = "account" | "subscription" | "billing" | "usage" | "updates" | "security" | "marketing";

const senders: Record<EmailCategory, { name: string; local: string }> = {
  account: { name: "Yolias", local: "no-reply" },
  subscription: { name: "Yolias", local: "billing" },
  billing: { name: "Yolias Billing", local: "billing" },
  usage: { name: "Yolias", local: "usage" },
  updates: { name: "Yolias", local: "updates" },
  security: { name: "Yolias Security", local: "security" },
  marketing: { name: "Yolias", local: "updates" },
};

/** The Resend key: the server variable, else the one from the Integration Hub (last load). */
export function resendKey(): string | null {
  return process.env.RESEND_API_KEY?.trim() || integrationSecret("resend", "api_key");
}

export function emailConfigured(): boolean {
  return Boolean(resendKey() && fromHeader("account"));
}

export function fromHeader(category: EmailCategory = "account"): string | null {
  const override = process.env[`EMAIL_FROM_${category.toUpperCase()}`] || process.env.EMAIL_FROM;
  if (override) return override;
  const { name, local } = senders[category];
  const domain = process.env.EMAIL_DOMAIN?.trim();
  if (domain) return `${name} <${local}@${domain}>`;
  const raw = process.env.RESEND_FROM || integrationConfig("resend", "yolias_from") || integrationConfig("resend", "from") || "";
  const address = raw.match(/<([^>]+)>/)?.[1] ?? raw.trim();
  return /.+@.+\..+/.test(address) ? `${name} <${address}>` : null;
}

export interface SendOptions {
  /** Full From header (Admin → Messaging → Settings); default per category. */
  from?: string | null;
  replyTo?: string | null;
  /** Plain-text part. */
  text?: string | null;
  /** Extra headers (List-Unsubscribe for lifecycle / marketing mail). */
  headers?: Record<string, string>;
}

export async function sendEmail(to: string, email: RenderedEmail, category: EmailCategory = "account", opts: SendOptions = {}): Promise<SendResult> {
  if (!/.+@.+\..+/.test(to)) return { status: "skipped", reason: "invalid recipient" };
  await loadIntegrations();
  const key = resendKey();
  const from = (opts.from && /<[^>]+@[^>]+>|^[^<>\s]+@[^<>\s]+$/.test(opts.from) ? opts.from : null) ?? fromHeader(category);
  if (!key || !from) return { status: "skipped", reason: "Resend is not configured" };
  try {
    const res = await fetch(`${(process.env.RESEND_API_URL || "https://api.resend.com").replace(/\/$/, "")}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject: email.subject, html: email.html, ...(opts.text ? { text: opts.text } : {}), ...(opts.replyTo ? { reply_to: opts.replyTo } : {}), ...(opts.headers ? { headers: opts.headers } : {}) }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!res.ok) {
      console.error(`[email] Resend responded ${res.status}: ${body?.message ?? ""}`);
      // 429 and 5xx are temporary; any other 4xx is a request Resend will never accept.
      return { status: "failed", error: body?.message ?? `HTTP ${res.status}`, retry: res.status === 429 || res.status >= 500 };
    }
    return { status: "sent", id: body?.id ?? null };
  } catch (e) {
    console.error("[email] Resend request failed", e);
    return { status: "failed", error: e instanceof Error ? e.message : "request failed", retry: true };
  }
}
