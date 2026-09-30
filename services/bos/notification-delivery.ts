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
    .select("id, channel, status, attempts, notification_id, notifications(user_id, title, body, link, priority)")
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

    if (d.channel === "whatsapp" || d.channel === "sms") {
      const r = await deliverByMessage(d.id, d.channel, n);
      await db().from("notification_deliveries").update({ status: r.status, attempts: d.attempts + 1, last_error: r.error, next_attempt_at: null, recipient: r.to, provider_message_id: r.providerId, ...(r.status === "sent" ? { sent_at: nowIso() } : {}) }).eq("id", d.id);
      result[r.status]++;
      continue;
    }
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

// WhatsApp/SMS notification to the employee's phone (docs/bos/30 §9.3, §11).
// SMS: plain text. WhatsApp: business-initiated messages need an approved
// template — the system uses the template named "bos_notification"
// ({{1}} = title, {{2}} = details) when the 24-hour window is closed.
// Retries of provider errors are handled by the outbound log.
async function deliverByMessage(deliveryId: string, channel: "whatsapp" | "sms", n: { user_id: string; title: string; body: string | null; link: string | null }): Promise<{ status: "sent" | "failed" | "skipped"; error: string | null; to: string | null; providerId: string | null }> {
  const { data: emp } = await db().from("employees").select("id, phone").eq("user_id", n.user_id).maybeSingle();
  const { normalizePhone, sendAsSystem, whatsappWindowOpen } = await import("@/services/bos/messaging");
  const to = normalizePhone(emp?.phone);
  if (!to) return { status: "skipped", error: "No phone number on the employee profile", to: null, providerId: null };
  const url = n.link ? (n.link.startsWith("http") ? n.link : `${siteUrl}${n.link}`) : null;
  const details = [n.body, url].filter(Boolean).join(" — ") || "—";
  try {
    let templateId: string | null = null;
    if (channel === "whatsapp" && !(await whatsappWindowOpen(to))) {
      const { data: tpl } = await db().from("message_templates").select("id").eq("channel", "whatsapp").eq("name", "bos_notification").eq("provider_status", "approved").eq("is_active", true).limit(1).maybeSingle();
      if (!tpl) return { status: "skipped", error: "WhatsApp needs an approved template named bos_notification", to, providerId: null };
      templateId = tpl.id;
    }
    const out = await sendAsSystem({ channel, to, text: templateId ? null : `${n.title}\n${details}`.slice(0, 1500), template_id: templateId, variables: templateId ? [n.title.slice(0, 200), details.slice(0, 800)] : [], entity_type: "notification", employee_id: emp!.id, notification_delivery_id: deliveryId, dedupe_key: `nd:${deliveryId}` }, null);
    const status = out.status === "skipped" ? "skipped" : out.status === "failed" ? "failed" : "sent";
    return { status, error: out.error, to, providerId: out.provider_message_id };
  } catch (e) {
    return { status: "skipped", error: e instanceof Error ? e.message.slice(0, 300) : "error", to, providerId: null };
  }
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
  let q = db().from("notification_deliveries").select("id, channel, status, attempts, last_error, sent_at, created_at, recipient, next_attempt_at, notifications(title, user_id, event_type, priority)").order("created_at", { ascending: false }).limit(200);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.channel) q = q.eq("channel", filters.channel);
  const { data } = await q;
  return data ?? [];
}
