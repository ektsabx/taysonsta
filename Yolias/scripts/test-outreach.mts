// End-to-end test of outreach (final spec phase 8) against the local
// Supabase, with local stand-ins for Claude (drafting) and Google (token +
// Gmail send) — no email leaves this machine:
//   npm run test:outreach
// Covers: draft from Yolias data, the human-only status steps (RLS + trigger),
// approval → send from the approver's mailbox (UTF-8 RFC 2822), idempotent
// send, suppression at send time, the daily limit, and a revoked mailbox.
import assert from "node:assert/strict";
import http from "node:http";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.ts";

const PORTS = { anthropic: 4953, google: 4954 };
process.env.ANTHROPIC_API_KEY = "test-anthropic";
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${PORTS.anthropic}`;
delete process.env.OPENAI_API_KEY;
delete process.env.GEMINI_API_KEY;
process.env.GOOGLE_CLIENT_ID = "test-client";
process.env.GOOGLE_CLIENT_SECRET = "test-secret";
process.env.GOOGLE_TOKEN_URL = `http://127.0.0.1:${PORTS.google}`;
process.env.GMAIL_API_URL = `http://127.0.0.1:${PORTS.google}`;

const sent: { raw: string; auth: string }[] = [];
let refreshStatus = 200;
const servers = [
  http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ id: "msg", type: "message", role: "assistant", model: "claude-opus-5-5", stop_reason: "end_turn", stop_sequence: null,
        content: [{ type: "text", text: JSON.stringify({ subject: "سؤال سريع عن Nakhla Pay", body: "مرحبًا سارة،\nرأيت أن Nakhla Pay تخدم التجار في الرياض.\nهل يناسبك اتصال قصير؟\nعمر" }) }],
        usage: { input_tokens: 400, output_tokens: 80, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } }));
    });
  }).listen(PORTS.anthropic),
  http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      if (req.url === "/token") {
        const p = new URLSearchParams(raw);
        assert.equal(p.get("grant_type"), "refresh_token");
        assert.equal(p.get("refresh_token"), "refresh-1");
        res.statusCode = refreshStatus;
        res.end(JSON.stringify(refreshStatus === 200 ? { access_token: "access-1", expires_in: 3600 } : { error: "invalid_grant" }));
        return;
      }
      if (req.url === "/gmail/v1/users/me/messages/send") {
        sent.push({ raw: JSON.parse(raw).raw, auth: String(req.headers.authorization) });
        res.end(JSON.stringify({ id: `gmail-${sent.length}` }));
        return;
      }
      res.statusCode = 404;
      res.end("{}");
    });
  }).listen(PORTS.google),
];

const { draftOutreach, sendOutreach } = await import("@/lib/outreach/index.ts");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient<Database>(url, svc, { auth: { persistSession: false } });
const intel = createClient(url, svc, { auth: { persistSession: false }, db: { schema: "intel" } });
const tag = Date.now().toString(36);
let userId: string | null = null;
let wsId: string | null = null;
const suppressed = `blocked-${tag}@client.example`;

try {
  const email = `outreach-${tag}@yolias.local`;
  const { data: created, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  userId = created.user.id;
  wsId = (await admin.from("profiles").select("workspace_id").eq("id", userId).single()).data!.workspace_id!;
  await admin.from("profiles").update({ full_name: "Omar Sender", onboarded_at: new Date().toISOString() }).eq("id", userId);
  await admin.from("workspaces").update({ name: "Acme", offering: "Payment reconciliation software", plan: "pro", subscription_status: "test" }).eq("id", wsId);
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const db: SupabaseClient<Database> = createClient<Database>(url, anon, { auth: { persistSession: false } });
  await db.auth.verifyOtp({ type: "magiclink", token_hash: link!.properties!.hashed_token });

  const { data: c } = await admin.from("campaigns").insert({ workspace_id: wsId, name: "t", criteria: {}, quota: 5, status: "completed" }).select("id").single();
  const { data: co } = await admin.from("companies").insert({ workspace_id: wsId, campaign_id: c!.id, name: "Nakhla Pay", city: "Riyadh", source: "test" }).select("id").single();
  const person = async (mail: string | null) => (await admin.from("prospects").insert({ workspace_id: wsId!, campaign_id: c!.id, company_id: co!.id, full_name: "Sara Test", title: "CEO", email: mail, email_status: "verified", source: "test" }).select("id").single()).data!.id;
  const p1 = await person(`sara-${tag}@client.example`);

  // 1) Draft (Claude stand-in) from Yolias data, saved as a draft.
  const d = await draftOutreach({ workspaceId: wsId, userId, prospectId: p1, instruction: "offer a short call", language: "ar" });
  assert.ok(d.ok, JSON.stringify(d));
  const m1 = d.message;
  assert.equal(m1.status, "draft"); assert.equal(m1.language, "ar"); assert.match(m1.subject, /Nakhla/);
  assert.equal((await draftOutreach({ workspaceId: wsId, userId, prospectId: await person(null), instruction: null, language: "en" })).ok, false, "no email → no draft");

  // 2) Human steps only (RLS + trigger).
  assert.equal((await db.from("outreach_messages").update({ body: "Edited body" }).eq("id", m1.id)).error, null);
  assert.ok((await db.from("outreach_messages").update({ status: "sent" }).eq("id", m1.id)).error, "a member can't mark a message sent");
  const { data: box } = await admin.from("mailboxes").insert({ workspace_id: wsId, user_id: userId, provider: "gmail", email: "omar@acme.example" }).select("id").single();
  await admin.rpc("set_mailbox_token", { p_mailbox: box!.id, p_token: "refresh-1" });
  const { error: approveError } = await db.from("outreach_messages").update({ status: "approved", mailbox_id: box!.id }).eq("id", m1.id);
  assert.equal(approveError, null);
  const { data: approved } = await admin.from("outreach_messages").select("approved_by, approved_at").eq("id", m1.id).single();
  assert.equal(approved!.approved_by, userId); assert.ok(approved!.approved_at);
  assert.ok((await db.from("outreach_messages").update({ body: "sneaky" }).eq("id", m1.id)).error, "an approved message can't be edited");

  // 3) Send from the approver's Gmail; idempotent.
  assert.equal(await sendOutreach(m1.id), "sent");
  assert.equal(await sendOutreach(m1.id), null, "a sent message is never sent again");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].auth, "Bearer access-1");
  const mime = Buffer.from(sent[0].raw, "base64url").toString("utf8");
  assert.match(mime, new RegExp(`To: sara-${tag}@client\\.example`));
  assert.match(mime, /Subject: =\?UTF-8\?B\?/);
  assert.equal(Buffer.from(mime.split("\r\n\r\n")[1].replace(/\r\n/g, ""), "base64").toString("utf8"), "Edited body");
  const { data: done } = await admin.from("outreach_messages").select("status, provider_message_id, sent_at").eq("id", m1.id).single();
  assert.equal(done!.status, "sent"); assert.equal(done!.provider_message_id, "gmail-1");

  const approve = async (prospectId: string) => {
    const r = await draftOutreach({ workspaceId: wsId!, userId: userId!, prospectId, instruction: null, language: "en" });
    assert.ok(r.ok);
    await db.from("outreach_messages").update({ status: "approved", mailbox_id: box!.id }).eq("id", r.message.id);
    return r.message.id;
  };

  // 4) Suppressed after the draft → not sent.
  const p2 = await person(suppressed);
  const m2 = await approve(p2);
  await intel.from("suppression_list").insert({ kind: "email", value: suppressed, reason: "test" });
  assert.equal(await sendOutreach(m2), "failed");
  assert.equal((await admin.from("outreach_messages").select("error").eq("id", m2).single()).data!.error, "suppressed");

  // 5) Daily limit.
  await admin.from("mailboxes").update({ daily_limit: 1 }).eq("id", box!.id);
  const m3 = await approve(p1);
  assert.equal(await sendOutreach(m3), "failed");
  assert.equal((await admin.from("outreach_messages").select("error").eq("id", m3).single()).data!.error, "daily_limit");

  // 6) Revoked mailbox → failed + mailbox needs reconnecting; the slot is given back.
  await admin.from("mailboxes").update({ daily_limit: 50 }).eq("id", box!.id);
  refreshStatus = 400;
  const m4 = await approve(p1);
  assert.equal(await sendOutreach(m4), "failed");
  const { data: after } = await admin.from("mailboxes").select("status, sent_today").eq("id", box!.id).single();
  assert.equal(after!.status, "error");
  assert.equal(after!.sent_today, 1, "only the real send counts");
  assert.equal(sent.length, 1);

  console.log("✓ outreach: draft, human-only steps, approved send (UTF-8), idempotent, suppression, daily limit, revoked mailbox");
} finally {
  if (wsId) await admin.from("workspaces").delete().eq("id", wsId);
  if (userId) await admin.auth.admin.deleteUser(userId);
  await intel.from("suppression_list").delete().eq("value", suppressed);
  servers.forEach((s) => s.close());
}
