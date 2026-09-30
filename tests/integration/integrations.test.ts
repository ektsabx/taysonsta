// Master upgrade Phase 4 (docs/bos/30 §7, doc 31): Integration Hub —
// encrypted storage, keep-on-blank secrets, default account, retry/backoff
// and redacted logging, signed + idempotent webhooks, AI client fallback.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { db } from "@/lib/bos/db";
import { getSetting, saveSetting } from "@/lib/bos/settings";
import { bosUserFor, uniq } from "@/tests/integration/helpers";
import { listConnections, providerFetch, resolveConnection, saveConnection, setDefaultConnection, deleteConnection } from "@/services/bos/integrations";
import { receiveWebhook } from "@/services/bos/webhooks";
import { aiGenerate } from "@/services/bos/ai";
import { signSvix } from "@/lib/bos/integrations/webhook-signatures";
import { ValidationError } from "@/lib/bos/errors";

const cleanup: (() => PromiseLike<unknown>)[] = [];
after(async () => {
  for (const fn of cleanup.reverse()) await Promise.resolve(fn()).catch((e) => console.error("cleanup", e));
});

test("connections: secrets encrypted at rest, never listed, kept when left blank; one default per provider", async () => {
  assert.ok(process.env.BOS_SECRETS_KEY, "local BOS_SECRETS_KEY present");
  const admin = await bosUserFor("admin@taysonsta.local");
  const c = db();
  const label = uniq("Resend test");
  const id = await saveConnection(admin, null, { provider: "resend", label, config: { from: "BOS <no-reply@example.com>", reply_to: "" }, secrets: { api_key: "re_test_ABCDEFGHIJKLMNOP1234", webhook_secret: "" } });
  cleanup.push(() => c.from("integration_connections").delete().eq("id", id));

  const { data: raw } = await c.from("integration_connections").select("*").eq("id", id).single();
  assert.ok(raw!.secret_ciphertext && !raw!.secret_ciphertext.includes("re_test"), "ciphertext only");
  assert.equal((raw!.secret_hint as Record<string, string>).api_key, "••••1234");
  const listed = (await listConnections("resend")).find((x) => x.id === id)!;
  assert.ok(!("secret_ciphertext" in listed), "list never carries the ciphertext");

  await saveConnection(admin, id, { provider: "resend", label, config: { from: "BOS <no-reply@example.com>" }, secrets: { api_key: "", webhook_secret: "whsec_dGVzdA==" } });
  const r = await resolveConnection("resend", id);
  assert.equal(r!.secrets.api_key, "re_test_ABCDEFGHIJKLMNOP1234", "blank secret keeps the stored one");
  assert.equal(r!.secrets.webhook_secret, "whsec_dGVzdA==");

  await assert.rejects(saveConnection(admin, null, { provider: "resend", label: "x", config: {}, secrets: {} }), ValidationError, "required fields");
  await assert.rejects(saveConnection(admin, null, { provider: "nope", label: "x", config: {}, secrets: {} }), ValidationError);

  const id2 = await saveConnection(admin, null, { provider: "resend", label: uniq("Resend 2"), config: { from: "b@example.com" }, secrets: { api_key: "re_second_ZZZZZZZZZZZZ9999" } });
  cleanup.push(() => c.from("integration_connections").delete().eq("id", id2));
  await setDefaultConnection(admin, id2);
  const { data: defaults } = await c.from("integration_connections").select("id").eq("provider", "resend").eq("is_default", true);
  assert.deepEqual(defaults!.map((d) => d.id), [id2], "exactly one default");
  assert.equal((await resolveConnection("resend"))!.connection.id, id2);
});

test("providerFetch retries 5xx/429 with backoff, stops on 4xx, and logs without secrets", async () => {
  let hits = 0;
  const server: Server = createServer((req, res) => {
    hits++;
    if (req.url === "/flaky" && hits < 3) {
      res.writeHead(hits === 1 ? 503 : 429, { "retry-after": "0" });
      return res.end(JSON.stringify({ error: { message: "busy sk-live-SECRETSECRETSECRET" } }));
    }
    if (req.url === "/bad") {
      res.writeHead(401);
      return res.end(JSON.stringify({ error: { message: "invalid key MySecretKeyValue" } }));
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  cleanup.push(() => new Promise((r) => server.close(() => r(null))));
  const port = (server.address() as { port: number }).port;
  const op = uniq("op");

  const ok = await providerFetch({ provider: "test_provider", operation: op, url: `http://127.0.0.1:${port}/flaky`, retries: 3 });
  assert.equal(ok.ok, true);
  assert.equal(hits, 3, "two retries then success");

  hits = 0;
  const bad = await providerFetch({ provider: "test_provider", operation: op, url: `http://127.0.0.1:${port}/bad`, retries: 3, secrets: { api_key: "MySecretKeyValue" } });
  assert.equal(bad.ok, false);
  assert.equal(hits, 1, "4xx is not retried");
  assert.ok(!bad.error!.includes("MySecretKeyValue"), "error redacted");

  const { data: logs } = await db().from("integration_logs").select("ok, attempts, error").eq("operation", op).order("id");
  cleanup.push(() => db().from("integration_logs").delete().eq("operation", op));
  assert.deepEqual(logs!.map((l) => [l.ok, l.attempts]), [[true, 3], [false, 1]]);
  assert.ok(!logs!.some((l) => (l.error ?? "").includes("MySecretKeyValue")));
});

test("webhooks: valid signature processed once, duplicates ignored, bad signature refused", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const c = db();
  const secret = `whsec_${Buffer.from(uniq("webhook-secret-value")).toString("base64")}`;
  const id = await saveConnection(admin, null, { provider: "resend", label: uniq("Resend hooks"), config: { from: "h@example.com" }, secrets: { api_key: "re_hooks_QQQQQQQQQQQQ0000", webhook_secret: secret } });
  cleanup.push(() => c.from("integration_connections").delete().eq("id", id));
  const eventId = uniq("msg");
  cleanup.push(() => c.from("webhook_events").delete().like("event_id", `%${eventId}%`));
  const body = JSON.stringify({ type: "email.delivered", data: { email_id: "e-1" } });
  const ts = String(Math.floor(Date.now() / 1000));
  const headers = new Headers({ "svix-id": eventId, "svix-timestamp": ts, "svix-signature": await signSvix(secret, eventId, ts, body) });

  assert.deepEqual(await receiveWebhook("resend", headers, body), { status: 200, body: "ok" });
  assert.deepEqual(await receiveWebhook("resend", headers, body), { status: 200, body: "duplicate" }, "idempotent");
  const { data: ev } = await c.from("webhook_events").select("status, signature_ok, connection_id").eq("provider", "resend").eq("event_id", eventId).single();
  assert.equal(ev!.status, "processed");
  assert.equal(ev!.connection_id, id);

  const forged = new Headers({ "svix-id": `${eventId}-x`, "svix-timestamp": ts, "svix-signature": "v1,AAAA" });
  assert.equal((await receiveWebhook("resend", forged, body)).status, 401);
  assert.equal((await receiveWebhook("unknown_provider", headers, body)).status, 404);
});

test("AI client: budget stop and clear message when no provider is configured", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const before = await getSetting("ai");
  cleanup.push(() => saveSetting("ai", before, admin.userId));
  const configured = (await listConnections()).filter((x) => ["openai", "gemini", "anthropic"].includes(x.provider) && x.status !== "disabled");
  if (!configured.length) {
    const r = await aiGenerate({ feature: "test.none", prompt: "hi" });
    assert.equal(r.ok, false);
    assert.match((r as { error: string }).error, /لا يوجد مزود/);
  }
  // Budget reached → no call at all.
  const marker = uniq("budget");
  await db().from("ai_usage_log").insert({ provider: "openai", model: marker, feature: "test.budget", cost_micros: 5_000_000, ok: true });
  cleanup.push(() => db().from("ai_usage_log").delete().eq("model", marker));
  await saveSetting("ai", { ...before, monthly_budget_usd: 1 }, admin.userId);
  const stopped = await aiGenerate({ feature: "test.budget", prompt: "hi" });
  assert.equal(stopped.ok, false);
  assert.match((stopped as { error: string }).error, /ميزانية/);
});

test("deleting a connection removes its credentials", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const id = await saveConnection(admin, null, { provider: "gemini", label: uniq("Gemini del"), config: { model: "gemini-2.5-flash" }, secrets: { api_key: "AIza_TEST_DELETE_ME_1234" } });
  await deleteConnection(admin, id);
  const { data } = await db().from("integration_connections").select("id").eq("id", id).maybeSingle();
  assert.equal(data, null);
});
