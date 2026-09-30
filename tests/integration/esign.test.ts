// Master upgrade Phase 14 (docs/bos/30 §19; doc 31): e-signatures —
// DocuSign (JWT grant, envelope with per-signer anchors, signed Connect
// webhook, contract signatures, signed PDF stored, polling fallback, void)
// with DocuSign HTTP stubbed at fetch; offline signing with an attached copy.
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { createHmac, generateKeyPairSync } from "node:crypto";
import { db } from "@/lib/bos/db";
import { bosUserFor, uniq } from "@/tests/integration/helpers";
import { saveConnection } from "@/services/bos/integrations";
import { generateDocument, setDocumentStatus } from "@/services/bos/documents";
import { completeOffline, createSignatureRequest, getSignatureRequest, markOfflineSigned, pollSignatureRequests, voidSignatureRequest } from "@/services/bos/esign";
import { receiveWebhook } from "@/services/bos/webhooks";
import { ValidationError } from "@/lib/bos/errors";

const realFetch = globalThis.fetch;
const cleanup: (() => PromiseLike<unknown>)[] = [];
after(async () => {
  globalThis.fetch = realFetch;
  for (const fn of cleanup.reverse()) await Promise.resolve(fn()).catch((e) => console.error("cleanup", e));
});

const HMAC = uniq("hmac");
const ACCOUNT = `acc-${uniq("a")}`;
let envCounter = 0;
let envelopeState: { status: string; recipients: { signers: { recipientId: string; status: string; signedDateTime?: string }[] } } = { status: "sent", recipients: { signers: [] } };
const created: { body: Record<string, unknown> }[] = [];
const voided: string[] = [];
const contracts: string[] = [];
const docs: string[] = [];

before(async () => {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
    if (url === "https://account-d.docusign.com/oauth/token") {
      const assertion = new URLSearchParams(String(init?.body)).get("assertion") ?? "";
      assert.equal(assertion.split(".").length, 3, "JWT assertion");
      return json({ access_token: "ds-token", expires_in: 3600 });
    }
    if (url === "https://account-d.docusign.com/oauth/userinfo") return json({ accounts: [{ account_id: ACCOUNT, base_uri: "https://demo.docusign.net", is_default: true }] });
    if (url.startsWith("https://demo.docusign.net/restapi/v2.1/accounts/")) {
      if (url.endsWith("/envelopes") && init?.method === "POST") {
        created.push({ body: JSON.parse(String(init.body)) });
        return json({ envelopeId: `env-${++envCounter}-${ACCOUNT}`, status: "sent" }, 201);
      }
      if (url.includes("/documents/combined")) return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]), { status: 200, headers: { "content-type": "application/pdf" } });
      if (init?.method === "PUT") { voided.push(url); return json({}); }
      return json(envelopeState);
    }
    return realFetch(input, init);
  }) as typeof fetch;

  const admin = await bosUserFor("admin@taysonsta.local");
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const conn = await saveConnection(admin, null, { provider: "docusign", label: uniq("DocuSign"), config: { integration_key: "ik", account_id: ACCOUNT, user_id: "uid", environment: "demo" }, secrets: { private_key: privateKey.export({ type: "pkcs1", format: "pem" }).toString(), hmac_key: HMAC } });
  cleanup.push(async () => {
    const c = db();
    const { data: reqs } = await c.from("signature_requests").select("id, signed_file_id").in("document_id", docs.length ? docs : ["00000000-0000-0000-0000-000000000000"]);
    for (const r of reqs ?? []) {
      if (r.signed_file_id) {
        const { data: f } = await c.from("files").select("storage_path").eq("id", r.signed_file_id).single();
        if (f) await c.storage.from("bos-files").remove([f.storage_path]);
        await c.from("signature_requests").update({ signed_file_id: null }).eq("id", r.id);
        await c.from("files").delete().eq("id", r.signed_file_id);
      }
      await c.from("signature_requests").delete().eq("id", r.id);
    }
    for (const d of docs) await setDocumentStatus(admin, d, "void", { void_reason: "test cleanup" }).catch(() => {});
    await c.from("contract_signatures").delete().in("contract_id", contracts);
    await c.from("contracts").delete().in("id", contracts);
    await c.from("webhook_events").delete().eq("provider", "docusign");
    await c.from("integration_logs").delete().eq("connection_id", conn);
    await c.from("integration_connections").delete().eq("id", conn);
  });
});

async function contractDoc() {
  const admin = await bosUserFor("admin@taysonsta.local");
  const { data: client } = await db().from("clients").select("id").is("archived_at", null).limit(1).single();
  const { data: k } = await db().from("contracts").insert({ title: uniq("E-sign contract"), client_id: client!.id, value: 1000, currency: "USD", created_by: admin.userId }).select("id").single();
  contracts.push(k!.id);
  const { data: tpl } = await db().from("document_templates").select("id").eq("key", "client_contract_en").single();
  const doc = await generateDocument(admin, tpl!.id, "contract", k!.id);
  docs.push(doc.id);
  return { contractId: k!.id, docId: doc.id };
}

const signedBody = (b: string) => createHmac("sha256", HMAC).update(b).digest("base64");

test("DocuSign: envelope with anchors, Connect webhook drives signer + contract status, signed PDF stored", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const { contractId, docId } = await contractDoc();
  await assert.rejects(createSignatureRequest(admin, { document_id: docId, provider: "docusign", signing_order: "sequential", subject: null, message: null, expires_days: 14, signers: [{ name: "A", email: "bad", role: "client" }] }), ValidationError);
  const req = await createSignatureRequest(admin, { document_id: docId, provider: "docusign", signing_order: "sequential", subject: "Please sign", message: "Thanks", expires_days: 14, signers: [{ name: "Client Person", email: "client@example.com", role: "client" }, { name: "Company Signer", email: "ceo@taysonsta.local", role: "company" }] });
  assert.equal(req.status, "sent");
  const env = created.at(-1)!.body as { recipients: { signers: { routingOrder: string; tabs: { signHereTabs: { anchorString: string }[] } }[] }; documents: { fileExtension: string; documentBase64: string }[]; notification: unknown };
  assert.deepEqual(env.recipients.signers.map((s) => s.routingOrder), ["1", "2"], "sequential order");
  assert.deepEqual(env.recipients.signers.map((s) => s.tabs.signHereTabs[0].anchorString), ["/sn1/", "/sn2/"]);
  assert.equal(env.documents[0].fileExtension, "docx");
  assert.ok(env.notification, "expiry set");
  const { data: k } = await db().from("contracts").select("status, esign_provider, esign_reference, required_signers").eq("id", contractId).single();
  assert.equal(k!.status, "sent");
  assert.equal(k!.esign_reference, req.external_id);
  assert.equal(k!.required_signers, 2);
  await assert.rejects(createSignatureRequest(admin, { document_id: docId, provider: "offline", signing_order: "parallel", subject: null, message: null, expires_days: null, signers: [{ name: "X", email: "x@example.com", role: "client" }] }), ValidationError, "one open request per document");

  // First signer signs (webhook), then completion.
  const hook = async (status: string, signers: { recipientId: string; status: string }[]) => {
    const body = JSON.stringify({ event: `envelope-${status}`, data: { envelopeId: req.external_id, envelopeSummary: { status, recipients: { signers } } } });
    return receiveWebhook("docusign", new Headers({ "x-docusign-signature-1": signedBody(body) }), body);
  };
  assert.equal((await receiveWebhook("docusign", new Headers({ "x-docusign-signature-1": "forged" }), JSON.stringify({ data: { envelopeId: req.external_id } }))).status, 401);
  await hook("delivered", [{ recipientId: "1", status: "completed" }, { recipientId: "2", status: "sent" }]);
  let d = await getSignatureRequest(admin, req.id);
  assert.equal(d.request.status, "partially_signed");
  assert.equal(d.signers.find((s) => s.recipient_id === 1)!.status, "signed");
  assert.equal((await db().from("contracts").select("status").eq("id", contractId).single()).data!.status, "partially_signed", "contract signature recorded (method esign)");
  const { data: sig } = await db().from("contract_signatures").select("method, provider_reference").eq("contract_id", contractId);
  assert.equal(sig![0].method, "esign");

  await hook("completed", [{ recipientId: "1", status: "completed" }, { recipientId: "2", status: "completed" }]);
  d = await getSignatureRequest(admin, req.id);
  assert.equal(d.request.status, "completed");
  assert.ok(d.request.signed_file_id, "signed PDF stored");
  const { data: f } = await db().from("files").select("entity_type, entity_id, mime_type").eq("id", d.request.signed_file_id!).single();
  assert.equal(f!.entity_type, "contract");
  assert.equal(f!.entity_id, contractId);
  assert.equal((await db().from("contracts").select("status").eq("id", contractId).single()).data!.status, "signed");
  assert.equal((await db().from("generated_documents").select("status").eq("id", docId).single()).data!.status, "signed");
  assert.ok(d.events.some((e) => e.event === "completed"));
  // Replayed webhook is harmless.
  await hook("completed", [{ recipientId: "1", status: "completed" }, { recipientId: "2", status: "completed" }]);
  assert.equal((await db().from("contract_signatures").select("id", { count: "exact", head: true }).eq("contract_id", contractId)).count, 2);
});

test("polling fallback (declined) and void", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const a = await contractDoc();
  const r1 = await createSignatureRequest(admin, { document_id: a.docId, provider: "docusign", signing_order: "parallel", subject: null, message: null, expires_days: null, signers: [{ name: "Client", email: "c1@example.com", role: "client" }] });
  envelopeState = { status: "declined", recipients: { signers: [{ recipientId: "1", status: "declined" }] } };
  await db().from("signature_requests").update({ last_checked_at: null }).eq("id", r1.id);
  assert.ok((await pollSignatureRequests(50)) >= 1);
  assert.equal((await getSignatureRequest(admin, r1.id)).request.status, "declined");

  const b = await contractDoc();
  const r2 = await createSignatureRequest(admin, { document_id: b.docId, provider: "docusign", signing_order: "parallel", subject: null, message: null, expires_days: null, signers: [{ name: "Client", email: "c2@example.com", role: "client" }] });
  await assert.rejects(voidSignatureRequest(admin, r2.id, " "), ValidationError);
  await voidSignatureRequest(admin, r2.id, "Wrong version");
  assert.ok(voided.some((u) => u.includes(r2.external_id!)), "voided at DocuSign");
  assert.equal((await getSignatureRequest(admin, r2.id)).request.status, "voided");
});

test("offline signing: record each party, then attach the signed copy from the record's files", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const { contractId, docId } = await contractDoc();
  const r = await createSignatureRequest(admin, { document_id: docId, provider: "offline", signing_order: "parallel", subject: null, message: null, expires_days: null, signers: [{ name: "Paper Client", email: "paper@example.com", role: "client" }] });
  const { data: f } = await db().from("files").insert({ storage_path: `test/${uniq("signed")}.pdf`, name: "scan.pdf", entity_type: "contract", entity_id: contractId, uploaded_by: admin.userId, is_finalized: true }).select("id").single();
  cleanup.push(async () => { await db().from("signature_requests").update({ signed_file_id: null }).eq("id", r.id); await db().from("files").delete().eq("id", f!.id); });
  await assert.rejects(completeOffline(admin, r.id, f!.id), ValidationError, "all parties must be recorded first");
  const signer = (await getSignatureRequest(admin, r.id)).signers[0];
  await markOfflineSigned(admin, signer.id, "2026-09-29");
  const done = await completeOffline(admin, r.id, f!.id);
  assert.equal(done, "completed");
  assert.equal((await db().from("contracts").select("status").eq("id", contractId).single()).data!.status, "signed");
});
