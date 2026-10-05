import "server-only";
import type { RenderedEmail } from "@/lib/email/templates";

// Product emails (receipts, plan ending, usage, discovery ready) through
// Resend — the same account Taysonsta uses (docs/12-decisions.md D-111).
// Sign-in emails don't come here: Supabase Auth sends them (via Resend SMTP).
//   RESEND_API_KEY   required; without it emails are skipped, never faked
//   RESEND_FROM      "Name <address>" on a domain verified in Resend
//   EMAIL_FROM       optional override of the full From header
//   EMAIL_DOMAIN     optional sending domain for per-category senders
//                    (billing@, usage@, updates@, security@, no-reply@);
//                    without it every category uses the RESEND_FROM address.
//   EMAIL_FROM_<CATEGORY>  optional full From override per category
//   RESEND_API_URL   optional, for tests (a local capture server)
// The display name is "Yolias" (billing: "Yolias Billing", security:
// "Yolias Security") unless EMAIL_FROM says otherwise.

export type SendResult = { status: "sent"; id: string | null } | { status: "skipped"; reason: string } | { status: "failed"; error: string };

export type EmailCategory = "account" | "subscription" | "billing" | "usage" | "updates" | "security";

const senders: Record<EmailCategory, { name: string; local: string }> = {
  account: { name: "Yolias", local: "no-reply" },
  subscription: { name: "Yolias", local: "billing" },
  billing: { name: "Yolias Billing", local: "billing" },
  usage: { name: "Yolias", local: "usage" },
  updates: { name: "Yolias", local: "updates" },
  security: { name: "Yolias Security", local: "security" },
};

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && fromHeader("account"));
}

export function fromHeader(category: EmailCategory = "account"): string | null {
  const override = process.env[`EMAIL_FROM_${category.toUpperCase()}`] || process.env.EMAIL_FROM;
  if (override) return override;
  const { name, local } = senders[category];
  const domain = process.env.EMAIL_DOMAIN?.trim();
  if (domain) return `${name} <${local}@${domain}>`;
  const raw = process.env.RESEND_FROM ?? "";
  const address = raw.match(/<([^>]+)>/)?.[1] ?? raw.trim();
  return /.+@.+\..+/.test(address) ? `${name} <${address}>` : null;
}

export async function sendEmail(to: string, email: RenderedEmail, category: EmailCategory = "account"): Promise<SendResult> {
  if (!/.+@.+\..+/.test(to)) return { status: "skipped", reason: "invalid recipient" };
  const from = fromHeader(category);
  if (!process.env.RESEND_API_KEY || !from) return { status: "skipped", reason: "Resend is not configured" };
  try {
    const res = await fetch(`${(process.env.RESEND_API_URL || "https://api.resend.com").replace(/\/$/, "")}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject: email.subject, html: email.html }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!res.ok) {
      console.error(`[email] Resend responded ${res.status}: ${body?.message ?? ""}`);
      return { status: "failed", error: body?.message ?? `HTTP ${res.status}` };
    }
    return { status: "sent", id: body?.id ?? null };
  } catch (e) {
    console.error("[email] Resend request failed", e);
    return { status: "failed", error: e instanceof Error ? e.message : "request failed" };
  }
}
