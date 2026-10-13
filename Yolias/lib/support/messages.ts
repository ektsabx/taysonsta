import "server-only";
import { createHash } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { siteUrl } from "@/lib/email/notify";
import type { ContactMessageRow } from "@/types/database";

// Contact messages and bug reports (2026-10-12). Stored first (the message is
// never lost), then the team is told by email when an address is set in
// Yolias Admin → Support → Website messages. `notified_at` is written only
// when the email provider accepted the email — never assumed.
//
// Abuse protection: a honeypot field in the forms, Turnstile on the public
// form when configured, per-IP / per-email / per-account limits, and the
// same message sent twice in a few minutes is stored once.

type Db = ReturnType<typeof createAdminClient>;

export const NOTIFY_KEY = "yolias_support_notify";

const LIMITS = {
  /** Public form: messages per hour from one IP or one email address. */
  contactPerHour: 5,
  /** In-app reports per account per day. */
  reportsPerDay: 10,
  duplicateMinutes: 10,
};

/** Salted hash: lets us count requests from one address without storing it. */
export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createHash("sha256").update(`yolias-support:${salt}:${ip}`).digest("hex").slice(0, 32);
}

const since = (ms: number) => new Date(Date.now() - ms).toISOString();

/** True when this sender already sent too many messages recently. */
export async function contactLimited(db: Db, ipHash: string | null, email: string): Promise<boolean> {
  const hour = since(3_600_000);
  const [byEmail, byIp] = await Promise.all([
    db.from("contact_messages").select("id", { count: "exact", head: true }).eq("kind", "contact").eq("email", email).gte("created_at", hour),
    ipHash ? db.from("contact_messages").select("id", { count: "exact", head: true }).eq("kind", "contact").eq("ip_hash", ipHash).gte("created_at", hour) : Promise.resolve({ count: 0 }),
  ]);
  return (byEmail.count ?? 0) >= LIMITS.contactPerHour || (byIp.count ?? 0) >= LIMITS.contactPerHour;
}

export async function reportsLimited(db: Db, userId: string): Promise<boolean> {
  const { count } = await db.from("contact_messages").select("id", { count: "exact", head: true }).eq("kind", "bug_report").eq("user_id", userId).gte("created_at", since(86_400_000));
  return (count ?? 0) >= LIMITS.reportsPerDay;
}

/** The same message from the same sender a few minutes ago (a double submit). */
export async function recentDuplicate(db: Db, kind: ContactMessageRow["kind"], email: string, message: string): Promise<string | null> {
  const { data } = await db.from("contact_messages").select("id").eq("kind", kind).eq("email", email).eq("message", message)
    .gte("created_at", since(LIMITS.duplicateMinutes * 60_000)).limit(1).maybeSingle();
  return data?.id ?? null;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Emails the team about a new message, if an address is set. Never throws. */
export async function notifyTeam(db: Db, row: Pick<ContactMessageRow, "id" | "kind" | "name" | "email" | "topic" | "category" | "subject" | "message" | "page_path">): Promise<void> {
  try {
    const { data } = await db.from("site_settings").select("value").eq("key", NOTIFY_KEY).maybeSingle();
    const to = (data?.value as { email?: unknown } | undefined)?.email;
    if (typeof to !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return;
    const what = row.kind === "bug_report" ? `Bug report (${row.category ?? "other"})` : `Contact message (${row.topic})`;
    const lines = [
      ["From", `${row.name} <${row.email}>`],
      row.subject ? ["Subject", row.subject] : null,
      row.page_path ? ["Page", row.page_path] : null,
    ].filter(Boolean) as [string, string][];
    const html = `<p><strong>${esc(what)}</strong></p>${lines.map(([k, v]) => `<p><strong>${esc(k)}:</strong> ${esc(v)}</p>`).join("")}`
      + `<p style="white-space:pre-wrap">${esc(row.message.slice(0, 4000))}</p>`
      + `<p>Open it in Yolias Admin → Support → Website messages.</p><p style="color:#888">${esc(siteUrl())}</p>`;
    const res = await sendEmail(to, { subject: `[Yolias] ${what}: ${(row.subject ?? row.message).slice(0, 60)}`, html }, "account");
    if (res.status === "sent") await db.from("contact_messages").update({ notified_at: new Date().toISOString() }).eq("id", row.id);
    else if (res.status === "failed") Sentry.captureMessage("Support notification email failed", { level: "warning", tags: { area: "support_notify" }, extra: { message_id: row.id, error: res.error } });
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "support_notify" }, extra: { message_id: row.id } });
  }
}
