// Master upgrade Phase 9 (docs/bos/30 §11; doc 31): WhatsApp + SMS — consent,
// blocked-by-provider, real adapter requests (provider HTTP stubbed at fetch),
// dedupe, retry, signed Twilio/Meta webhooks (statuses, inbound, STOP),
// WhatsApp 24-hour window, conversation replies, access.
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/bos/db";
import { bosUserFor, uniq } from "@/tests/integration/helpers";
import { applyStatus, consentState, processOutbound, retryMessage, saveTemplate, sendMessage, setConsent } from "@/services/bos/messaging";
import { saveConnection } from "@/services/bos/integrations";
import { receiveWebhook } from "@/services/bos/webhooks";
import { replyToConversation } from "@/services/bos/conversations";
import { signMeta, signTwilio } from "@/lib/bos/integrations/webhook-signatures";
import { ForbiddenError, ValidationError } from "@/lib/bos/errors";

const cleanup: (() => PromiseLike<unknown>)[] = [];
after(async () => {
  globalThis.fetch = realFetch;
  for (const fn of cleanup.reverse()) await Promise.resolve(fn()).catch((e) => console.error("cleanup", e));
});

const realFetch = globalThis.fetch;
type Stub = { status: number; body: unknown };
let twilioReply: Stub = { status: 201, body: { sid: "SM-default" } };
let metaReply: Stub = { status: 200, body: { messages: [{ id: "wamid.default" }] } };
const calls: { url: string; body: string }[] = [];

const rand = () => `2010${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
const phones: string[] = [];
const phone = () => {
  const p = rand();
  phones.push(p);
  return p;
};
const TW_TOKEN = uniq("tw-token");
const APP_SECRET = uniq("app-secret");
const HOOK_URL = "https://bos.example.com/api/bos/webhooks/twilio";

before(async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  // Only provider hosts are stubbed; Supabase calls pass through.
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.startsWith("https://api.twilio.com/") || url.startsWith("https://graph.facebook.com/")) {
      calls.push({ url, body: String(init?.body ?? "") });
      const r = url.includes("twilio") ? twilioReply : metaReply;
      // Real providers return a new id per message.
      const body = r.status < 300 ? (url.includes("twilio") ? { sid: `SM${uniq("s")}` } : { messages: [{ id: `wamid.${uniq("w")}` }] }) : r.body;
      return new Response(JSON.stringify(body), { status: r.status, headers: { "content-type": "application/json" } });
    }
    return realFetch(input, init);
  }) as typeof fetch;

  const ids = [
    await saveConnection(admin, null, { provider: "twilio", label: uniq("SMS"), config: { account_sid: "AC_test", from: "+15550001111" }, secrets: { auth_token: TW_TOKEN } }),
    await saveConnection(admin, null, { provider: "whatsapp_cloud", label: uniq("WA"), config: { phone_number_id: "PN1", business_account_id: "WABA1" }, secrets: { access_token: "EAAtest", app_secret: APP_SECRET, verify_token: "vt" } }),
  ];
  cleanup.push(async () => {
    const c = db();
    await c.from("outbound_messages").delete().in("to_phone", phones);
    await c.from("messaging_consents").delete().in("phone", phones);
    const { data: custs } = await c.from("support_customers").select("id").in("normalized_phone", phones);
    const cids = (custs ?? []).map((x) => x.id);
    if (cids.length) {
      await c.from("conversations").delete().in("customer_id", cids);
      await c.from("support_customers").delete().in("id", cids);
    }
    await c.from("webhook_events").delete().in("provider", ["twilio", "whatsapp_cloud"]);
    await c.from("integration_logs").delete().in("connection_id", ids);
    await c.from("integration_connections").delete().in("id", ids);
  });
});

test("consent rules, blocked-by-provider is never faked, access", async () => {
  const [admin, dev] = await Promise.all([bosUserFor("admin@taysonsta.local"), bosUserFor("youssef.dev@taysonsta.local")]);
  await assert.rejects(sendMessage(dev, { channel: "sms", to: phone(), text: "hi" }), ForbiddenError);
  const p = phone();
  await assert.rejects(sendMessage(admin, { channel: "sms", to: p, text: "promo", purpose: "marketing" }), ValidationError, "marketing needs opt-in");
  await setConsent(admin.userId, { phone: `+${p}`, channel: "sms", purpose: "all", status: "opted_out" });
  await assert.rejects(sendMessage(admin, { channel: "sms", to: p, text: "hello" }), ValidationError, "opted out");
  assert.deepEqual(await consentState(p, "sms"), { optedOutAll: true, marketingOptIn: false });
  await assert.rejects(sendMessage(admin, { channel: "sms", to: "12", text: "x" }), ValidationError, "bad phone");

  // Disable the test connection → logged as skipped, not sent.
  await db().from("integration_connections").update({ status: "disabled" }).eq("provider", "twilio");
  const skipped = await sendMessage(admin, { channel: "sms", to: phone(), text: "hello" });
  assert.equal(skipped.status, "skipped");
  assert.match(skipped.error ?? "", /Blocked by provider/);
  await db().from("integration_connections").update({ status: "active" }).eq("provider", "twilio");
});

test("SMS: real Twilio request, dedupe, retry with backoff, signed status + inbound + STOP", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const p = phone();
  twilioReply = { status: 201, body: { sid: `SM${uniq("a")}` } };
  const m = await sendMessage(admin, { channel: "sms", to: `+${p}`, text: "Your invoice is ready" });
  assert.equal(m.status, "sent");
  const call = calls.at(-1)!;
  assert.match(call.url, /Accounts\/AC_test\/Messages\.json$/);
  const form = new URLSearchParams(call.body);
  assert.equal(form.get("To"), `+${p}`);
  assert.equal(form.get("From"), "+15550001111");

  const { sendAsSystem } = await import("@/services/bos/messaging");
  const key = uniq("dedupe");
  const d1 = await sendAsSystem({ channel: "sms", to: p, text: "once", dedupe_key: key }, null);
  const d2 = await sendAsSystem({ channel: "sms", to: p, text: "once", dedupe_key: key }, null);
  assert.equal(d1.id, d2.id, "same dedupe key → one message");

  // Provider 500 → failed with a retry time; the sweep retries and succeeds.
  twilioReply = { status: 500, body: { message: "Twilio down" } };
  const f = await sendMessage(admin, { channel: "sms", to: p, text: "retry me" });
  assert.equal(f.status, "failed");
  assert.ok(f.next_attempt_at);
  await db().from("outbound_messages").update({ next_attempt_at: new Date(Date.now() - 1000).toISOString() }).eq("id", f.id);
  twilioReply = { status: 201, body: { sid: `SM${uniq("r")}` } };
  assert.ok((await processOutbound(20)) >= 1);
  assert.equal((await db().from("outbound_messages").select("status").eq("id", f.id).single()).data!.status, "sent");

  // 400 → failed without retry; manual retry allowed.
  twilioReply = { status: 400, body: { message: "Invalid To" } };
  const bad = await sendMessage(admin, { channel: "sms", to: p, text: "nope" });
  assert.equal(bad.status, "failed");
  assert.equal(bad.next_attempt_at, null);
  twilioReply = { status: 201, body: { sid: `SM${uniq("m")}` } };
  assert.equal((await retryMessage(admin, bad.id)).status, "sent");

  // Signed status callback → delivered; forged → 401.
  const statusParams = { MessageSid: m.provider_message_id!, MessageStatus: "delivered", To: `+${p}` };
  const ok = await receiveWebhook("twilio", new Headers({ "x-twilio-signature": await signTwilio(TW_TOKEN, HOOK_URL, statusParams) }), new URLSearchParams(statusParams).toString(), HOOK_URL);
  assert.equal(ok.status, 200);
  assert.equal((await db().from("outbound_messages").select("status, delivered_at").eq("id", m.id).single()).data!.status, "delivered");
  const forged = await receiveWebhook("twilio", new Headers({ "x-twilio-signature": "AAAA" }), new URLSearchParams(statusParams).toString(), HOOK_URL);
  assert.equal(forged.status, 401);
  await applyStatus("sms", m.provider_message_id!, "sent");
  assert.equal((await db().from("outbound_messages").select("status").eq("id", m.id).single()).data!.status, "delivered", "statuses never go backwards");

  // Inbound SMS → inbox conversation; "STOP" → opted out.
  const inbound = { MessageSid: `SM${uniq("in")}`, From: `+${p}`, Body: "Hello, question about my invoice" };
  await receiveWebhook("twilio", new Headers({ "x-twilio-signature": await signTwilio(TW_TOKEN, HOOK_URL, inbound) }), new URLSearchParams(inbound).toString(), HOOK_URL);
  const { data: conv } = await db().from("conversations").select("id, channel").eq("external_thread_id", `sms:${p}`).single();
  assert.equal(conv!.channel, "sms");
  const stop = { MessageSid: `SM${uniq("stop")}`, From: `+${p}`, Body: "STOP" };
  await receiveWebhook("twilio", new Headers({ "x-twilio-signature": await signTwilio(TW_TOKEN, HOOK_URL, stop) }), new URLSearchParams(stop).toString(), HOOK_URL);
  assert.equal((await consentState(p, "sms")).optedOutAll, true);
  await assert.rejects(sendMessage(admin, { channel: "sms", to: p, text: "after stop" }), ValidationError);
});

test("WhatsApp: 24-hour window, approved templates, signed inbound + read status, inbox reply", async () => {
  const [admin, support] = await Promise.all([bosUserFor("admin@taysonsta.local"), bosUserFor("support@taysonsta.local")]);
  const p = phone();
  await assert.rejects(sendMessage(admin, { channel: "whatsapp", to: p, text: "hi" }), ValidationError, "window closed, no template");

  // Approved template → template request with body parameters.
  const tplName = `order_update_${Date.now().toString(36)}`;
  const tplId = await saveTemplate(admin, null, { channel: "whatsapp", name: tplName, language: "en", category: "utility", body: "Hi {{1}}, order {{2}} shipped", variables: ["name", "order"], is_active: true });
  cleanup.push(() => db().from("message_templates").delete().eq("id", tplId));
  await assert.rejects(sendMessage(admin, { channel: "whatsapp", to: p, template_id: tplId, variables: ["Mona", "A1"] }), ValidationError, "local (unapproved) template outside window");
  await db().from("message_templates").update({ provider_status: "approved" }).eq("id", tplId);
  await assert.rejects(saveTemplate(admin, tplId, { channel: "whatsapp", name: tplName, language: "en", category: "utility", body: "changed {{1}}", variables: [], is_active: true }), ValidationError, "approved text is owned by Meta");
  await assert.rejects(sendMessage(admin, { channel: "whatsapp", to: p, template_id: tplId, variables: ["Mona"] }), ValidationError, "all variables required");
  metaReply = { status: 200, body: { messages: [{ id: `wamid.${uniq("t")}` }] } };
  const t = await sendMessage(admin, { channel: "whatsapp", to: p, template_id: tplId, variables: ["Mona", "A1"] });
  assert.equal(t.status, "sent");
  assert.equal(t.body, "Hi Mona, order A1 shipped");
  const req = JSON.parse(calls.at(-1)!.body);
  assert.equal(req.type, "template");
  assert.equal(req.template.name, tplName);
  assert.deepEqual(req.template.components[0].parameters.map((x: { text: string }) => x.text), ["Mona", "A1"]);
  assert.match(calls.at(-1)!.url, /\/PN1\/messages$/);

  // Signed inbound message opens the window and a conversation.
  const inbound = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ value: { contacts: [{ wa_id: p, profile: { name: "Mona WA" } }], messages: [{ from: p, id: `wamid.${uniq("in")}`, type: "text", text: { body: "Where is my order?" } }] } }] }] });
  assert.equal((await receiveWebhook("whatsapp_cloud", new Headers({ "x-hub-signature-256": await signMeta(APP_SECRET, inbound) }), inbound)).status, 200);
  assert.equal((await receiveWebhook("whatsapp_cloud", new Headers({ "x-hub-signature-256": "sha256=00" }), inbound)).status, 401);
  const { data: conv } = await db().from("conversations").select("id").eq("external_thread_id", `wa:${p}`).single();

  // Inside the window: agent reply goes out as free text through the log.
  metaReply = { status: 200, body: { messages: [{ id: `wamid.${uniq("r")}` }] } };
  const r = await replyToConversation(support, conv!.id, "It ships today.", { internal: false });
  assert.equal(r.delivery, "sent");
  assert.equal(JSON.parse(calls.at(-1)!.body).type, "text");
  const { data: cm } = await db().from("conversation_messages").select("id, external_id").eq("conversation_id", conv!.id).eq("direction", "outbound").single();
  const { data: out } = await db().from("outbound_messages").select("conversation_message_id").eq("provider_message_id", cm!.external_id!).single();
  assert.equal(out!.conversation_message_id, cm!.id, "log row linked to the inbox message");

  // Read receipt updates both the log and the inbox bubble.
  const status = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ value: { statuses: [{ id: cm!.external_id, status: "read", recipient_id: p }] } }] }] });
  await receiveWebhook("whatsapp_cloud", new Headers({ "x-hub-signature-256": await signMeta(APP_SECRET, status), "x-request-id": uniq("st") }), status);
  assert.equal((await db().from("conversation_messages").select("delivery_status").eq("id", cm!.id).single()).data!.delivery_status, "read");
  assert.equal((await db().from("outbound_messages").select("status").eq("provider_message_id", cm!.external_id!).single()).data!.status, "read");
});
