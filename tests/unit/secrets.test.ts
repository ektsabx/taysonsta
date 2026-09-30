import { test } from "node:test";
import assert from "node:assert/strict";
import { decryptSecrets, encryptSecrets, redact, secretHint } from "@/lib/bos/secrets";
import { signMeta, signSvix, verifyMetaSignature, verifySvix, verifyHmacBase64 } from "@/lib/bos/integrations/webhook-signatures";

// Integration Hub credential encryption and webhook signatures (docs/bos/30 §7).
const KEY = Buffer.alloc(32, 7).toString("base64");

test("AES-256-GCM: round trip, random IV, tamper detection, wrong key refused", async () => {
  const prev = process.env.BOS_SECRETS_KEY;
  process.env.BOS_SECRETS_KEY = KEY;
  try {
    const a = await encryptSecrets({ api_key: "re_live_1234567890abcdef" });
    const b = await encryptSecrets({ api_key: "re_live_1234567890abcdef" });
    assert.notEqual(a, b, "a fresh IV each time");
    assert.ok(!Buffer.from(a, "base64").toString("latin1").includes("re_live"), "no plaintext in the ciphertext");
    assert.deepEqual(await decryptSecrets(a), { api_key: "re_live_1234567890abcdef" });
    const bytes = Buffer.from(a, "base64");
    bytes[bytes.length - 1] ^= 1;
    await assert.rejects(decryptSecrets(bytes.toString("base64")), "tampered ciphertext fails authentication");
    process.env.BOS_SECRETS_KEY = Buffer.alloc(32, 9).toString("base64");
    await assert.rejects(decryptSecrets(a), "another key can't read it");
    process.env.BOS_SECRETS_KEY = "";
    await assert.rejects(encryptSecrets({ x: "y" }), /BOS_SECRETS_KEY/);
  } finally {
    process.env.BOS_SECRETS_KEY = prev;
  }
});

test("hints and redaction never expose more than 4 characters", () => {
  assert.equal(secretHint("sk-ant-api03-abcdefghijWXYZ"), "••••WXYZ");
  assert.equal(secretHint("short"), "••••");
  const msg = redact("401 for key sk-proj-ABCDEFGHIJKLMNOPQRS and Bearer abc.def.ghi", { api_key: "MyVerySecretValue" });
  assert.ok(!msg.includes("ABCDEFGHIJKLMNOPQRS") && !msg.includes("abc.def.ghi"));
  assert.equal(redact("value MyVerySecretValue here", { api_key: "MyVerySecretValue" }), "value [redacted] here");
});

test("webhook signatures: Svix (Resend) valid / tampered / stale; Meta HMAC; generic", async () => {
  const secret = `whsec_${Buffer.from("super-secret-webhook-key-32bytes!!").toString("base64")}`;
  const body = JSON.stringify({ type: "email.delivered", data: { email_id: "e1" } });
  const now = 1_800_000_000;
  const sig = await signSvix(secret, "msg_1", String(now), body);
  assert.equal(await verifySvix(secret, { id: "msg_1", timestamp: String(now), signature: `v1,bogus ${sig}` }, body, now), true, "any listed v1 signature");
  assert.equal(await verifySvix(secret, { id: "msg_1", timestamp: String(now), signature: sig }, body + " ", now), false, "body changed");
  assert.equal(await verifySvix(secret, { id: "msg_2", timestamp: String(now), signature: sig }, body, now), false, "id changed");
  assert.equal(await verifySvix(secret, { id: "msg_1", timestamp: String(now), signature: sig }, body, now + 600), false, "older than 5 minutes");
  assert.equal(await verifySvix(secret, { id: null, timestamp: String(now), signature: sig }, body, now), false);

  const m = await signMeta("app-secret", body);
  assert.equal(await verifyMetaSignature("app-secret", m, body), true);
  assert.equal(await verifyMetaSignature("other", m, body), false);
  assert.equal(await verifyMetaSignature("app-secret", null, body), false);
  assert.equal(await verifyHmacBase64("k", "nope", body), false);
});
