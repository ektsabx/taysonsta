import "server-only";
import { db } from "@/lib/bos/db";
import { nowIso } from "@/lib/bos/clock";
import { providerMap } from "@/lib/bos/integrations/catalog";
import { verifyHmacBase64, verifyMetaSignature, verifySvix, verifyTwilio } from "@/lib/bos/integrations/webhook-signatures";
import { listConnections, resolveConnection } from "@/services/bos/integrations";

// Inbound webhooks (docs/bos/30 §7, doc 31 Phase 4): verify the signature
// against the provider's connections, store once per (provider, event id),
// then hand the payload to the handler registered for that provider.
// Later phases register handlers (WhatsApp messages, e-sign status, …).

export type WebhookHandler = (payload: unknown, ctx: { connectionId: string; eventType: string | null }) => Promise<"processed" | "ignored">;
const handlers = new Map<string, WebhookHandler>();
export function registerWebhookHandler(provider: string, fn: WebhookHandler) {
  handlers.set(provider, fn);
}

// Resend delivery events: kept as integration log entries (status per message id).
registerWebhookHandler("resend", async (payload, ctx) => {
  const p = payload as { type?: string; data?: { email_id?: string; to?: string[] } };
  if (!p?.type?.startsWith("email.")) return "ignored";
  await db().from("integration_logs").insert({ connection_id: ctx.connectionId, provider: "resend", direction: "inbound", operation: p.type, ok: !/bounced|complained|failed/.test(p.type), meta: { email_id: p.data?.email_id ?? null } as never });
  return "processed";
});

// Support inbound email (docs/bos/30 §10.2): the sender's Email Worker posts
// { message_id, from: { email, name }, subject, text } signed with the
// account's secret; the message joins (or opens) a conversation.
registerWebhookHandler("support_email", async (payload) => {
  const p = payload as { message_id?: string; from?: { email?: string; name?: string } | string; subject?: string; text?: string; in_reply_to?: string };
  const from = typeof p.from === "string" ? { email: p.from } : p.from ?? {};
  if (!from.email || !(p.text ?? "").trim()) return "ignored";
  const { receiveInbound } = await import("@/services/bos/conversations");
  await receiveInbound({ channel: "email", customer: { email: from.email, name: from.name ?? null }, subject: p.subject ?? null, body: p.text!, external_message_id: p.message_id ?? null });
  return "processed";
});

// WhatsApp Cloud API (docs/bos/30 §11): inbound messages join the inbox;
// sent/delivered/read/failed statuses update the outbound log.
registerWebhookHandler("whatsapp_cloud", async (payload) => {
  const p = payload as { entry?: { changes?: { value?: { contacts?: { wa_id?: string; profile?: { name?: string } }[]; messages?: { from?: string; id?: string; type?: string; text?: { body?: string }; button?: { text?: string }; interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } } }[]; statuses?: { id?: string; status?: string; errors?: { title?: string; message?: string }[] }[] } }[] }[] };
  const { receiveMessage, applyStatus } = await import("@/services/bos/messaging");
  let handled = false;
  for (const e of p?.entry ?? []) {
    for (const ch of e.changes ?? []) {
      const v = ch.value ?? {};
      for (const m of v.messages ?? []) {
        if (!m.from || !m.id) continue;
        const name = v.contacts?.find((x) => x.wa_id === m.from)?.profile?.name ?? null;
        const body = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? `[${m.type ?? "message"}]`;
        await receiveMessage("whatsapp", { from: m.from, name, body, providerId: m.id });
        handled = true;
      }
      for (const st of v.statuses ?? []) {
        if (!st.id || !["sent", "delivered", "read", "failed"].includes(st.status ?? "")) continue;
        await applyStatus("whatsapp", st.id, st.status as "sent", st.errors?.[0] ? `${st.errors[0].title ?? ""} ${st.errors[0].message ?? ""}`.trim() : null);
        handled = true;
      }
    }
  }
  return handled ? "processed" : "ignored";
});

// Twilio SMS: inbound (From/Body) and status callbacks (MessageStatus).
registerWebhookHandler("twilio", async (payload) => {
  const p = payload as Record<string, string>;
  const { receiveMessage, applyStatus } = await import("@/services/bos/messaging");
  if (p.MessageSid && p.MessageStatus && !p.Body) {
    const map: Record<string, "sent" | "delivered" | "read" | "failed"> = { sent: "sent", delivered: "delivered", read: "read", failed: "failed", undelivered: "failed" };
    const st = map[p.MessageStatus];
    if (!st) return "ignored";
    await applyStatus("sms", p.MessageSid, st, p.ErrorCode ? `Twilio error ${p.ErrorCode}` : null);
    return "processed";
  }
  if (p.MessageSid && p.From && (p.Body ?? "").trim()) {
    return receiveMessage("sms", { from: p.From, body: p.Body, providerId: p.MessageSid });
  }
  return "ignored";
});

// DocuSign Connect (docs/bos/30 §19): envelope / recipient status → signature requests.
registerWebhookHandler("docusign", async (payload) => {
  const { handleDocusignWebhook } = await import("@/services/bos/esign");
  return handleDocusignWebhook(payload);
});

async function sha256Hex(text: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface InboundResult { status: number; body: string }

// Form-encoded bodies (Twilio) become a flat object; JSON otherwise.
function parseBody(rawBody: string, form: boolean): unknown {
  if (form) return Object.fromEntries(new URLSearchParams(rawBody));
  try {
    return JSON.parse(rawBody);
  } catch {
    return {};
  }
}

export async function receiveWebhook(provider: string, headers: Headers, rawBody: string, url: string | null = null): Promise<InboundResult> {
  const def = providerMap.get(provider);
  if (!def?.webhook) return { status: 404, body: "unknown provider" };
  if (rawBody.length > 1_000_000) return { status: 413, body: "too large" };
  const form = def.webhook.kind === "twilio";
  let payload: unknown = parseBody(rawBody, form);

  // Verify against each active connection of the provider (multi-account).
  let matched: string | null = null;
  for (const c of await listConnections(provider)) {
    if (c.status === "disabled") continue;
    const r = await resolveConnection(provider, c.id).catch(() => null);
    const secret = r?.secrets[def.webhook.secretField];
    if (!r || !secret) continue;
    const ok =
      def.webhook.kind === "svix"
        ? await verifySvix(secret, { id: headers.get("svix-id"), timestamp: headers.get("svix-timestamp"), signature: headers.get("svix-signature") }, rawBody)
        : def.webhook.kind === "meta_hmac"
          ? await verifyMetaSignature(secret, headers.get("x-hub-signature-256"), rawBody)
          : def.webhook.kind === "twilio"
            ? await verifyTwilio(secret, headers.get("x-twilio-signature"), url, payload as Record<string, string>)
            : await verifyHmacBase64(secret, headers.get("x-docusign-signature-1") ?? headers.get("x-signature"), rawBody);
    if (ok) {
      matched = c.id;
      break;
    }
  }

  payload = payload ?? {};
  const eventId = headers.get("svix-id") ?? headers.get("i-twilio-idempotency-token") ?? headers.get("x-request-id") ?? (await sha256Hex(rawBody));
  const eventType = (payload as { type?: string; event?: string; object?: string })?.type ?? (payload as { event?: string })?.event ?? (payload as { object?: string })?.object ?? null;

  if (!matched) {
    // Unsigned / wrong signature: keep a trace (no payload) and refuse.
    await db().from("webhook_events").insert({ provider, event_id: `rejected:${eventId}:${Date.now()}`, event_type: eventType, signature_ok: false, status: "failed", error: "invalid signature" });
    return { status: 401, body: "invalid signature" };
  }

  const { data: inserted, error } = await db().from("webhook_events").insert({ provider, connection_id: matched, event_id: eventId, event_type: eventType, signature_ok: true, payload: payload as never }).select("id").single();
  if (error) {
    if (error.code === "23505") return { status: 200, body: "duplicate" }; // idempotent: already received
    throw error;
  }

  const handler = handlers.get(provider);
  try {
    const status = handler ? await handler(payload, { connectionId: matched, eventType }) : "ignored";
    await db().from("webhook_events").update({ status, attempts: 1, processed_at: nowIso() }).eq("id", inserted.id);
  } catch (e) {
    await db().from("webhook_events").update({ status: "failed", attempts: 1, error: e instanceof Error ? e.message.slice(0, 500) : "handler error" }).eq("id", inserted.id);
  }
  return { status: 200, body: "ok" };
}

// Meta webhook subscription check (GET hub.challenge) against a stored verify token.
export async function verifyMetaSubscription(provider: string, mode: string | null, token: string | null, challenge: string | null): Promise<InboundResult> {
  if (mode !== "subscribe" || !token || !challenge) return { status: 400, body: "bad request" };
  for (const c of await listConnections(provider)) {
    const r = await resolveConnection(provider, c.id).catch(() => null);
    if (r?.secrets.verify_token && r.secrets.verify_token === token) return { status: 200, body: challenge };
  }
  return { status: 403, body: "forbidden" };
}
