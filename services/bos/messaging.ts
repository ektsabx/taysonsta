import "server-only";
import { db, type Tables } from "@/lib/bos/db";
import { can, type BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { nowIso, nowMs } from "@/lib/bos/clock";
import { siteUrl } from "@/lib/seo";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/bos/errors";
import { providerFetch, resolveConnection, type ResolvedConnection } from "@/services/bos/integrations";
import { isStopKeyword, normalizePhone, renderTemplate } from "@/lib/bos/messaging-utils";

// WhatsApp Business (Meta Cloud API) + SMS (Twilio) messaging
// (docs/bos/30 §11, doc 31 Phase 9). Every outbound message — sent by staff,
// by a conversation reply or by a notification — goes through one path:
// consent check → WhatsApp 24-hour rule → dedupe → log row → provider →
// status. Delivery/read statuses and inbound messages arrive through the
// signed webhooks (services/bos/webhooks.ts). Without a connected provider
// messages are logged as skipped ("blocked by provider"), never faked.

export type OutboundMessage = Tables<"outbound_messages">;
export type MessageTemplate = Tables<"message_templates">;
export type MsgChannel = "whatsapp" | "sms";

const PROVIDER: Record<MsgChannel, string> = { whatsapp: "whatsapp_cloud", sms: "twilio" };
const BACKOFF_MIN = [2, 10, 60];
const MAX_ATTEMPTS = 4;
const WINDOW_MS = 24 * 3600_000;

export { normalizePhone };

// ---------------------------------------------------------------------------
// Consent
// ---------------------------------------------------------------------------

export async function consentState(phone: string, channel: MsgChannel) {
  const { data } = await db().from("messaging_consents").select("purpose, status").eq("phone", phone).eq("channel", channel);
  const get = (p: string) => (data ?? []).find((r) => r.purpose === p)?.status ?? null;
  return { optedOutAll: get("all") === "opted_out", marketingOptIn: get("marketing") === "opted_in" && get("all") !== "opted_out" };
}

export async function setConsent(actorId: string | null, input: { phone: string; channel: MsgChannel; purpose: "all" | "marketing"; status: "opted_in" | "opted_out"; source?: string; note?: string | null }) {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new ValidationError("رقم هاتف غير صالح.", { phone: "غير صالح" });
  const { error } = await db().from("messaging_consents").upsert({ phone, channel: input.channel, purpose: input.purpose, status: input.status, source: input.source ?? "manual", note: input.note ?? null, updated_by: actorId }, { onConflict: "phone,channel,purpose" });
  if (error) throw error;
  await audit({ actorId, action: "messaging.consent_changed", entityType: "messaging_consent", entityId: null, newValue: { phone: `…${phone.slice(-4)}`, channel: input.channel, purpose: input.purpose, status: input.status, source: input.source ?? "manual" } });
}

// ---------------------------------------------------------------------------
// WhatsApp 24-hour customer service window
// ---------------------------------------------------------------------------

export async function whatsappWindowOpen(phone: string) {
  const { data } = await db().from("conversations").select("last_customer_message_at").eq("channel", "whatsapp").eq("external_thread_id", `wa:${phone}`).order("last_customer_message_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  return !!data?.last_customer_message_at && nowMs() - new Date(data.last_customer_message_at).getTime() < WINDOW_MS;
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

export interface SendInput {
  channel: MsgChannel;
  to: string;
  text?: string | null;
  template_id?: string | null;
  variables?: string[];
  purpose?: "transactional" | "marketing";
  entity_type?: string | null;
  entity_id?: string | null;
  client_id?: string | null;
  employee_id?: string | null;
  dedupe_key?: string | null;
  notification_delivery_id?: string | null;
}

type Prepared = { phone: string; body: string; template: MessageTemplate | null; asTemplate: boolean };

async function prepare(input: SendInput): Promise<Prepared> {
  const phone = normalizePhone(input.to);
  if (!phone) throw new ValidationError("رقم هاتف غير صالح. استخدم الصيغة الدولية مثل ‎+201001234567.", { to: "غير صالح" });
  const purpose = input.purpose ?? "transactional";
  const consent = await consentState(phone, input.channel);
  if (consent.optedOutAll) throw new ValidationError("هذا الرقم ألغى الاشتراك في الرسائل على هذه القناة.");
  if (purpose === "marketing" && !consent.marketingOptIn) throw new ValidationError("الرسائل التسويقية تتطلب موافقة مسبقة من صاحب الرقم.");

  let template: MessageTemplate | null = null;
  if (input.template_id) {
    const { data } = await db().from("message_templates").select("*").eq("id", input.template_id).maybeSingle();
    if (!data || !data.is_active) throw new ValidationError("القالب غير متاح.");
    if (data.channel !== input.channel) throw new ValidationError("القالب لقناة أخرى.");
    template = data;
  }
  const vars = input.variables ?? [];
  const body = template ? renderTemplate(template.body, vars) : (input.text ?? "").trim();
  if (!body) throw new ValidationError("نص الرسالة مطلوب.", { text: "مطلوب" });
  if (body.length > (input.channel === "sms" ? 1600 : 4096)) throw new ValidationError("الرسالة طويلة جداً لهذه القناة.");
  if (template && (body.match(/\{\{\d+\}\}/g) ?? []).length) throw new ValidationError("أكمل كل متغيرات القالب.");

  let asTemplate = false;
  if (input.channel === "whatsapp") {
    const open = await whatsappWindowOpen(phone);
    const approved = template?.provider_status === "approved";
    if (purpose === "marketing" && !approved) throw new ValidationError("رسائل واتساب التسويقية تُرسل بقالب معتمد من Meta فقط.");
    if (!open && !approved) throw new ValidationError("نافذة الـ24 ساعة مغلقة (العميل لم يراسلنا خلال آخر 24 ساعة) — أرسل قالباً معتمداً من Meta.");
    asTemplate = approved;
  }
  return { phone, body, template, asTemplate };
}

// Staff send (Messaging page, record pages).
export async function sendMessage(bos: BosUser, input: SendInput) {
  if (!can(bos, "messaging.create")) throw new ForbiddenError();
  if ((input.purpose ?? "transactional") === "marketing" && !can(bos, "messaging.manage")) throw new ForbiddenError();
  return queueAndSend(input, await prepare(input), bos.userId);
}

// System send (conversation replies, notifications): same rules, the caller
// already checked its own permission.
export async function sendAsSystem(input: SendInput, actorId: string | null) {
  return queueAndSend(input, await prepare(input), actorId);
}

async function queueAndSend(input: SendInput, p: Prepared, actorId: string | null): Promise<OutboundMessage> {
  const c = db();
  const { data: row, error } = await c
    .from("outbound_messages")
    .insert({ channel: input.channel, to_phone: p.phone, purpose: input.purpose ?? "transactional", template_id: p.template?.id ?? null, variables: (input.variables ?? []) as never, body: p.body, dedupe_key: input.dedupe_key ?? null, entity_type: input.entity_type ?? null, entity_id: input.entity_id ?? null, client_id: input.client_id ?? null, employee_id: input.employee_id ?? null, notification_delivery_id: input.notification_delivery_id ?? null, created_by: actorId })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505" && input.dedupe_key) {
      const { data: existing } = await c.from("outbound_messages").select("*").eq("dedupe_key", input.dedupe_key).single();
      return existing!; // same logical message twice → sent once
    }
    throw error;
  }
  return attempt(row, p.asTemplate ? p.template : null);
}

async function attempt(row: OutboundMessage, template: MessageTemplate | null): Promise<OutboundMessage> {
  const c = db();
  const channel = row.channel as MsgChannel;
  const conn = await resolveConnection(PROVIDER[channel], row.connection_id).catch(() => null);
  if (!conn) {
    const { data } = await c.from("outbound_messages").update({ status: "skipped", error: `Blocked by provider: connect ${channel === "whatsapp" ? "WhatsApp Business" : "Twilio SMS"} in the Integration Hub`, next_attempt_at: null }).eq("id", row.id).select("*").single();
    return data!;
  }
  const res = channel === "whatsapp" ? await sendWhatsApp(conn, row, template) : await sendSms(conn, row);
  const attempts = row.attempts + 1;
  if (res.ok) {
    const { data, error } = await c.from("outbound_messages").update({ status: "sent", attempts, provider_message_id: res.id, connection_id: conn.connection.id, sent_at: nowIso(), error: null, next_attempt_at: null }).eq("id", row.id).select("*").single();
    if (error) throw error;
    return data;
  }
  const retry = res.retryable && attempts < MAX_ATTEMPTS;
  const { data } = await c
    .from("outbound_messages")
    .update({ status: "failed", attempts, connection_id: conn.connection.id, error: (res.error ?? "error").slice(0, 500), next_attempt_at: retry ? new Date(nowMs() + BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)] * 60_000).toISOString() : null })
    .eq("id", row.id)
    .select("*")
    .single();
  if (!retry) await failedEvent(data!);
  return data!;
}

async function failedEvent(m: OutboundMessage) {
  await emitEvent({ type: "messaging.failed", entityType: "outbound_message", entityId: m.id, summary: `${m.channel} to …${m.to_phone.slice(-4)} failed: ${(m.error ?? "").slice(0, 120)}`, actorType: "system", payload: { channel: m.channel === "whatsapp" ? "WhatsApp" : "SMS", to: `…${m.to_phone.slice(-4)}`, error: m.error, creator_user_id: m.created_by } });
}

type SendResult = { ok: true; id: string } | { ok: false; error: string | null; retryable: boolean };

async function sendWhatsApp(conn: ResolvedConnection, row: OutboundMessage, template: MessageTemplate | null): Promise<SendResult> {
  const cfg = conn.connection.config as Record<string, string>;
  const vars = (row.variables as string[]) ?? [];
  const payload = template
    ? { messaging_product: "whatsapp", to: row.to_phone, type: "template", template: { name: template.name, language: { code: template.language }, ...(vars.length ? { components: [{ type: "body", parameters: vars.map((v) => ({ type: "text", text: v })) }] } : {}) } }
    : { messaging_product: "whatsapp", to: row.to_phone, type: "text", text: { body: row.body, preview_url: false } };
  const res = await providerFetch({ provider: "whatsapp_cloud", connectionId: conn.connection.id, operation: "whatsapp.send", url: `https://graph.facebook.com/v21.0/${encodeURIComponent(cfg.phone_number_id ?? "")}/messages`, init: { method: "POST", headers: { Authorization: `Bearer ${conn.secrets.access_token}`, "content-type": "application/json" }, body: JSON.stringify(payload) }, retries: 1, meta: { to: `…${row.to_phone.slice(-4)}`, template: template?.name ?? null } });
  const id = (res.body as { messages?: { id?: string }[] } | null)?.messages?.[0]?.id;
  if (res.ok && id) return { ok: true, id };
  return { ok: false, error: res.error, retryable: res.status === 0 || res.status === 429 || res.status >= 500 };
}

async function sendSms(conn: ResolvedConnection, row: OutboundMessage): Promise<SendResult> {
  const cfg = conn.connection.config as Record<string, string>;
  const form = new URLSearchParams({ To: `+${row.to_phone}`, From: cfg.from ?? "", Body: row.body });
  if (siteUrl.startsWith("https://")) form.set("StatusCallback", `${siteUrl}/api/bos/webhooks/twilio`);
  const res = await providerFetch({ provider: "twilio", connectionId: conn.connection.id, operation: "sms.send", url: `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.account_sid ?? "")}/Messages.json`, init: { method: "POST", headers: { Authorization: `Basic ${btoa(`${cfg.account_sid}:${conn.secrets.auth_token}`)}`, "content-type": "application/x-www-form-urlencoded" }, body: form.toString() }, retries: 1, meta: { to: `…${row.to_phone.slice(-4)}` } });
  const id = (res.body as { sid?: string } | null)?.sid;
  if (res.ok && id) return { ok: true, id };
  return { ok: false, error: res.error, retryable: res.status === 0 || res.status === 429 || res.status >= 500 };
}

// Scheduled retry of failed sends (sweep).
export async function processOutbound(limit = 50) {
  const { data } = await db().from("outbound_messages").select("*").eq("status", "failed").lt("attempts", MAX_ATTEMPTS).not("next_attempt_at", "is", null).lte("next_attempt_at", nowIso()).order("next_attempt_at").limit(limit);
  let done = 0;
  for (const m of data ?? []) {
    const { data: claimed } = await db().from("outbound_messages").update({ next_attempt_at: new Date(nowMs() + 10 * 60_000).toISOString() }).eq("id", m.id).eq("attempts", m.attempts).select("id").maybeSingle();
    if (!claimed) continue;
    const tpl = m.template_id ? (await db().from("message_templates").select("*").eq("id", m.template_id).maybeSingle()).data : null;
    await attempt(m, tpl?.provider_status === "approved" ? tpl : null);
    done++;
  }
  return done;
}

export async function retryMessage(bos: BosUser, id: string) {
  if (!can(bos, "messaging.create")) throw new ForbiddenError();
  const { data: m } = await db().from("outbound_messages").select("*").eq("id", id).maybeSingle();
  if (!m) throw new NotFoundError();
  if (m.created_by !== bos.userId && !can(bos, "messaging.manage")) throw new ForbiddenError();
  if (!["failed", "skipped"].includes(m.status)) throw new ValidationError("يمكن إعادة المحاولة للرسائل الفاشلة أو المتوقفة فقط.");
  const consent = await consentState(m.to_phone, m.channel as MsgChannel);
  if (consent.optedOutAll) throw new ValidationError("هذا الرقم ألغى الاشتراك.");
  const tpl = m.template_id ? (await db().from("message_templates").select("*").eq("id", m.template_id).maybeSingle()).data : null;
  if (m.channel === "whatsapp" && tpl?.provider_status !== "approved" && !(await whatsappWindowOpen(m.to_phone))) throw new ValidationError("نافذة الـ24 ساعة مغلقة — أرسل قالباً معتمداً.");
  await audit({ actorId: bos.userId, action: "messaging.retry", entityType: "outbound_message", entityId: id });
  return attempt({ ...m, attempts: Math.min(m.attempts, MAX_ATTEMPTS - 1) }, tpl?.provider_status === "approved" ? tpl : null);
}

// ---------------------------------------------------------------------------
// Inbound + statuses (called by the webhook handlers)
// ---------------------------------------------------------------------------

const rank: Record<string, number> = { queued: 0, sent: 1, delivered: 2, read: 3 };

export async function applyStatus(channel: MsgChannel, providerId: string, status: "sent" | "delivered" | "read" | "failed", error?: string | null) {
  const c = db();
  const { data: m } = await c.from("outbound_messages").select("*").eq("channel", channel).eq("provider_message_id", providerId).maybeSingle();
  if (m) {
    if (status === "failed") {
      if (m.status !== "failed") {
        const { data } = await c.from("outbound_messages").update({ status: "failed", error: (error ?? "Delivery failed").slice(0, 500), next_attempt_at: null }).eq("id", m.id).select("*").single();
        await failedEvent(data!);
      }
    } else if ((rank[status] ?? 0) > (rank[m.status] ?? -1)) {
      await c.from("outbound_messages").update({ status, ...(status === "delivered" ? { delivered_at: nowIso() } : {}), ...(status === "read" ? { read_at: nowIso(), delivered_at: m.delivered_at ?? nowIso() } : {}) }).eq("id", m.id);
    }
  }
  // Mirror onto the inbox message sent through this provider id.
  const { data: cm } = await c.from("conversation_messages").select("id, delivery_status").eq("channel", channel).eq("external_id", providerId).maybeSingle();
  if (cm && (status === "failed" || (rank[status] ?? 0) > (rank[cm.delivery_status ?? "queued"] ?? 0))) {
    await c.from("conversation_messages").update({ delivery_status: status, delivery_error: status === "failed" ? (error ?? "Delivery failed").slice(0, 500) : null }).eq("id", cm.id);
  }
  return !!m || !!cm;
}

export async function receiveMessage(channel: MsgChannel, input: { from: string; name?: string | null; body: string; providerId: string }) {
  const phone = normalizePhone(input.from);
  if (!phone) return "ignored" as const;
  const { receiveInbound } = await import("@/services/bos/conversations");
  const res = await receiveInbound({
    channel,
    customer: channel === "whatsapp" ? { whatsapp: phone, phone, name: input.name ?? null } : { phone, name: input.name ?? null },
    body: input.body,
    external_message_id: input.providerId,
    external_thread_id: `${channel === "whatsapp" ? "wa" : "sms"}:${phone}`,
    threadOnly: true,
  });
  if (res && !res.duplicate && isStopKeyword(input.body)) {
    await setConsent(null, { phone, channel, purpose: "all", status: "opted_out", source: "inbound_keyword", note: input.body.slice(0, 40) });
    const { addMessage } = await import("@/services/bos/conversations");
    await addMessage(res.conversation, { direction: "internal", author_kind: "system", body: "⛔ العميل ألغى الاشتراك في الرسائل (STOP). لن تُرسل له رسائل على هذه القناة حتى يعيد الاشتراك." });
  }
  return "processed" as const;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export interface TemplateInput { channel: MsgChannel; name: string; language: string; category: "utility" | "marketing" | "authentication"; body: string; variables: string[]; is_active: boolean }

export async function saveTemplate(bos: BosUser, id: string | null, input: TemplateInput) {
  if (!can(bos, "messaging.manage")) throw new ForbiddenError();
  if (!input.name.trim() || !input.body.trim()) throw new ValidationError("الاسم والنص مطلوبان.");
  if (input.channel === "whatsapp" && !/^[a-z0-9_]{1,512}$/.test(input.name)) throw new ValidationError("اسم قالب واتساب: حروف إنجليزية صغيرة وأرقام و _ فقط (كما في Meta).", { name: "غير صالح" });
  if (!/^[a-z]{2}(_[A-Z]{2})?$/.test(input.language)) throw new ValidationError("رمز اللغة مثل ar أو en_US.", { language: "غير صالح" });
  const nums = [...input.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  if (nums.some((n) => n < 1 || n > 20) || new Set(nums).size !== Math.max(0, ...nums)) throw new ValidationError("المتغيرات يجب أن تكون {{1}}، {{2}}… بالتسلسل.");
  const row = { ...input, name: input.name.trim(), body: input.body.trim(), variables: input.variables.slice(0, 20) };
  if (id) {
    const { data: before } = await db().from("message_templates").select("provider_status, body").eq("id", id).maybeSingle();
    if (!before) throw new NotFoundError();
    // An approved WhatsApp template's text is owned by Meta; edits happen there and come back on sync.
    if (before.provider_status === "approved" && before.body !== row.body) throw new ValidationError("نص القالب المعتمد يُعدّل من Meta ثم يُزامن.");
    const { error } = await db().from("message_templates").update(row).eq("id", id);
    if (error) throw dupTpl(error);
  } else {
    const { data, error } = await db().from("message_templates").insert({ ...row, created_by: bos.userId }).select("id").single();
    if (error) throw dupTpl(error);
    id = data.id;
  }
  await audit({ actorId: bos.userId, action: "messaging.template_saved", entityType: "message_template", entityId: id, newValue: { name: row.name, channel: row.channel, language: row.language } });
  return id;
}
const dupTpl = (e: { code?: string }) => (e.code === "23505" ? new ValidationError("يوجد قالب بنفس الاسم واللغة.", { name: "مكرر" }) : e);

// Pulls the WhatsApp Business Account's templates (name, language, status,
// body text) from Meta — approval happens in Meta's WhatsApp Manager.
export async function syncWhatsAppTemplates(bos: BosUser) {
  if (!can(bos, "messaging.manage")) throw new ForbiddenError();
  const conn = await resolveConnection("whatsapp_cloud").catch(() => null);
  if (!conn) throw new ValidationError("اربط واتساب للأعمال في مركز التكاملات أولاً.");
  const cfg = conn.connection.config as Record<string, string>;
  const res = await providerFetch({ provider: "whatsapp_cloud", connectionId: conn.connection.id, operation: "whatsapp.templates", url: `https://graph.facebook.com/v21.0/${encodeURIComponent(cfg.business_account_id ?? "")}/message_templates?fields=id,name,language,status,category,components&limit=200`, init: { headers: { Authorization: `Bearer ${conn.secrets.access_token}` } }, actorId: bos.userId });
  if (!res.ok) throw new ValidationError(`تعذرت المزامنة: ${res.error ?? "خطأ"}`);
  const list = (res.body as { data?: { id: string; name: string; language: string; status: string; category: string; components?: { type: string; text?: string }[] }[] })?.data ?? [];
  const map: Record<string, string> = { APPROVED: "approved", PENDING: "pending", REJECTED: "rejected", PAUSED: "paused", DISABLED: "disabled" };
  let n = 0;
  for (const t of list) {
    const body = t.components?.find((x) => x.type === "BODY")?.text ?? "";
    const category = t.category?.toLowerCase() === "marketing" ? "marketing" : t.category?.toLowerCase() === "authentication" ? "authentication" : "utility";
    await db().from("message_templates").upsert({ channel: "whatsapp", name: t.name, language: t.language, category, body: body || t.name, provider_status: map[t.status] ?? "pending", provider_template_id: t.id, connection_id: conn.connection.id, synced_at: nowIso() }, { onConflict: "channel,name,language" });
    n++;
  }
  await audit({ actorId: bos.userId, action: "messaging.templates_synced", entityType: "message_template", entityId: null, newValue: { count: n } });
  return n;
}

// ---------------------------------------------------------------------------
// Log
// ---------------------------------------------------------------------------

export async function listMessages(bos: BosUser, f: { status?: string; channel?: string; q?: string; entity_type?: string; entity_id?: string } = {}, limit = 200) {
  if (!can(bos, "messaging.read")) throw new ForbiddenError();
  let q = db().from("outbound_messages").select("*, message_templates(name)").order("created_at", { ascending: false }).limit(limit);
  if (bos.permissions.get("messaging.read") !== "all") q = q.eq("created_by", bos.userId);
  if (f.status) q = q.eq("status", f.status);
  if (f.channel) q = q.eq("channel", f.channel);
  if (f.entity_type && f.entity_id) q = q.eq("entity_type", f.entity_type).eq("entity_id", f.entity_id);
  const digits = f.q?.replace(/[^0-9]/g, "");
  if (digits) q = q.ilike("to_phone", `%${digits}%`);
  const { data } = await q;
  return data ?? [];
}
