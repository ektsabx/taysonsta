import "server-only";
import type { RenderedEmail } from "@/lib/email/templates";

// Product emails (receipts, plan ending, usage, discovery ready) through
// Resend — the same account Taysonsta uses (docs/12-decisions.md D-111).
// Sign-in emails don't come here: Supabase Auth sends them (via Resend SMTP).
//   RESEND_API_KEY   required; without it emails are skipped, never faked
//   RESEND_FROM      "Name <address>" on a domain verified in Resend
//   EMAIL_FROM       optional override of the full From header
// The display name is always "Yolias" unless EMAIL_FROM says otherwise.

export type SendResult = { status: "sent"; id: string | null } | { status: "skipped"; reason: string } | { status: "failed"; error: string };

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && fromHeader());
}

function fromHeader(): string | null {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
  const raw = process.env.RESEND_FROM ?? "";
  const address = raw.match(/<([^>]+)>/)?.[1] ?? raw.trim();
  return /.+@.+\..+/.test(address) ? `Yolias <${address}>` : null;
}

export async function sendEmail(to: string, email: RenderedEmail): Promise<SendResult> {
  if (!/.+@.+\..+/.test(to)) return { status: "skipped", reason: "invalid recipient" };
  const from = fromHeader();
  if (!process.env.RESEND_API_KEY || !from) return { status: "skipped", reason: "Resend is not configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
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
