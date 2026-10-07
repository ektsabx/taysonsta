import "server-only";
import { db } from "@/lib/bos/db";
import { nowIso, nowMs } from "@/lib/bos/clock";
import { siteUrl } from "@/lib/seo";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { ForbiddenError, NotFoundError } from "@/lib/bos/errors";
import { sendEmail } from "@/lib/bos/integrations/email";

// Notification delivery queue (docs/bos/30 §9.2–9.3, doc 31 Phase 6).
// Email is sent through the Integration Hub (Resend); failures retry with
// backoff (5 min → 30 min → 2 h → 12 h) up to 5 attempts, then stay failed
// and visible in the delivery log with a manual retry. Push / WhatsApp / SMS
// are recorded as skipped with the reason until their channel is connected.

const BACKOFF_MIN = [5, 30, 120, 720];
const MAX_ATTEMPTS = 5;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function processDeliveries(limit = 100): Promise<{ sent: number; failed: number; skipped: number }> {
  const now = new Date(nowMs()).toISOString();
  const { data: rows } = await db()
    .from("notification_deliveries")
    .select("id, channel, status, attempts, notification_id, notifications:bos_notifications(user_id, title, body, link, priority)")
    .in("status", ["queued", "failed"])
    .lt("attempts", MAX_ATTEMPTS)
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
    .order("created_at")
    .limit(limit);
  const result = { sent: 0, failed: 0, skipped: 0 };
  for (const d of rows ?? []) {
    // Claim: only one worker processes a delivery.
    const { data: claimed } = await db().from("notification_deliveries").update({ next_attempt_at: new Date(nowMs() + 10 * 60_000).toISOString() }).eq("id", d.id).eq("status", d.status).eq("attempts", d.attempts).select("id").maybeSingle();
    if (!claimed) continue;
    const n = d.notifications as unknown as { user_id: string; title: string; body: string | null; link: string | null; priority: string } | null;
    if (!n) continue;

    if (d.channel !== "email") {
      await db().from("notification_deliveries").update({ status: "skipped", last_error: "Push provider not configured", next_attempt_at: null }).eq("id", d.id);
      result.skipped++;
      continue;
    }

    const { data: emp } = await db().from("employees").select("email").eq("user_id", n.user_id).maybeSingle();
    let to = emp?.email ?? null;
    if (!to) to = (await db().auth.admin.getUserById(n.user_id)).data.user?.email ?? null;
    if (!to) {
      await db().from("notification_deliveries").update({ status: "skipped", last_error: "No email address", next_attempt_at: null }).eq("id", d.id);
      result.skipped++;
      continue;
    }

    const url = n.link ? (n.link.startsWith("http") ? n.link : `${siteUrl}${n.link}`) : null;
    const text = [n.body, url].filter(Boolean).join("\n\n");
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6"><p><strong>${esc(n.title)}</strong></p>${n.body ? `<p>${esc(n.body).replace(/\n/g, "<br>")}</p>` : ""}${url ? `<p><a href="${esc(url)}">${esc(url)}</a></p>` : ""}</div>`;
    const res = await sendEmail({ to: [to], subject: n.title, text: text || n.title, html });
    const attempts = d.attempts + 1;
    if (res.status === "sent") {
      await db().from("notification_deliveries").update({ status: "sent", attempts, sent_at: nowIso(), last_error: null, next_attempt_at: null, provider_message_id: res.id, recipient: to }).eq("id", d.id);
      result.sent++;
    } else if (res.status === "skipped") {
      await db().from("notification_deliveries").update({ status: "skipped", attempts, last_error: res.reason, next_attempt_at: null, recipient: to }).eq("id", d.id);
      result.skipped++;
    } else {
      const next = attempts < MAX_ATTEMPTS ? new Date(nowMs() + BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)] * 60_000).toISOString() : null;
      await db().from("notification_deliveries").update({ status: "failed", attempts, last_error: res.error.slice(0, 500), next_attempt_at: next, recipient: to }).eq("id", d.id);
      result.failed++;
    }
  }
  return result;
}

export async function retryDelivery(bos: BosUser, id: string) {
  if (!(bos.isSuperAdmin || bos.permissions.get("settings.manage") === "all")) throw new ForbiddenError();
  const { data } = await db().from("notification_deliveries").select("id, status").eq("id", id).maybeSingle();
  if (!data) throw new NotFoundError();
  await db().from("notification_deliveries").update({ status: "queued", attempts: 0, next_attempt_at: null, last_error: null }).eq("id", id);
  await audit({ actorId: bos.userId, action: "notification.delivery_retried", entityType: "notification_delivery", entityId: id, oldValue: { status: data.status } });
  return processDeliveries(20);
}

export async function deliveryLog(filters: { status?: string; channel?: string } = {}) {
  let q = db().from("notification_deliveries").select("id, channel, status, attempts, last_error, sent_at, created_at, recipient, next_attempt_at, notifications:bos_notifications(title, user_id, event_type, priority)").order("created_at", { ascending: false }).limit(200);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.channel) q = q.eq("channel", filters.channel);
  const { data } = await q;
  return data ?? [];
}
