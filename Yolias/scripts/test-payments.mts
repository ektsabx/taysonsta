// End-to-end test of payments (final spec phase 3) against the local
// Supabase and the running app (`npm run local`), with a local stand-in for
// Paymob's Intention API — nothing is charged, nothing leaves this machine:
//   npm run test:payments
// Covers: checkout creates a pending payment priced on the server, the signed
// webhook starts the plan with an invoice in the workspace currency, replays
// are no-ops, bad signatures and wrong amounts change nothing, failed
// payments don't start anything, packs grant prospects, refunds void the
// invoice, and the signed redirect settles too.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createClient } from "@supabase/supabase-js";
import { startCheckout } from "@/lib/payments/index.ts";
import { billingSweep, settleSubscription } from "@/lib/billing.ts";
import { hmacStringFromTransaction, signPaymob } from "@/lib/payments/paymob.ts";
import type { Database, WorkspaceRow } from "@/types/database.ts";
// Never the owner's real keys from Yolias Admin → Integrations (D-132): no LLM keys in this test.
(await import("@/lib/integrations.ts")).setIntegrationsForTests({});

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const app = process.env.YOLIAS_TEST_APP_URL ?? "http://localhost:3200";
const db = createClient<Database>(url, svc, { auth: { persistSession: false } });
const HMAC = "local-test-hmac-secret";

// ── Paymob stand-in: POST /v1/intention/ ──
let orderSeq = 9_000_000 + Math.floor(Math.random() * 1_000_000);
const intentions: Record<string, unknown>[] = [];
const server = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    if (req.method !== "POST" || req.url !== "/v1/intention/" || req.headers.authorization !== "Token local-secret-key") {
      res.writeHead(401).end();
      return;
    }
    intentions.push(JSON.parse(body));
    res.writeHead(201, { "content-type": "application/json" }).end(JSON.stringify({ id: `pi_test_${orderSeq}`, intention_order_id: ++orderSeq, client_secret: `csk_test_${orderSeq}` }));
  });
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const port = (server.address() as AddressInfo).port;

const { data: before } = await db.from("payment_providers").select("*").eq("id", "paymob").single();
const { data: quotas } = await db.from("plan_quotas").select("plan, price_usd");
// The owner's real Paymob secrets are restored after the test, never wiped.
const savedSecrets = { secret_key: (await db.rpc("payment_secret", { p_provider: "paymob", p_name: "secret_key" })).data as string | null, hmac_secret: (await db.rpc("payment_secret", { p_provider: "paymob", p_name: "hmac_secret" })).data as string | null };
const email = `payments-test-${Date.now()}@yolias.local`;
let userId: string | null = null;
let packId: string | null = null;

function txn(paymentId: string, order: string, amountCents: number, over: Record<string, unknown> = {}) {
  return {
    id: Math.floor(Math.random() * 1e9), pending: false, amount_cents: amountCents, success: true, is_auth: false, is_capture: false,
    is_standalone_payment: true, is_voided: false, is_refunded: false, is_3d_secure: true, integration_id: 222, has_parent_transaction: false,
    created_at: new Date().toISOString(), currency: "USD", error_occured: false, owner: 1,
    order: { id: Number(order), merchant_order_id: paymentId }, source_data: { pan: "2346", type: "card", sub_type: "MasterCard" }, data: { message: "Approved" },
    ...over,
  };
}
async function callback(obj: Record<string, unknown>, secret = HMAC) {
  const sig = signPaymob(hmacStringFromTransaction(obj), secret);
  return fetch(`${app}/api/payments/paymob?hmac=${sig}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "TRANSACTION", obj }) });
}
const ws = async (id: string) => (await db.from("workspaces").select("*").eq("id", id).single()).data as WorkspaceRow;
const payment = async (id: string) => (await db.from("payments").select("*").eq("id", id).single()).data!;

try {
  // Provider + prices (restored at the end).
  await db.from("payment_providers").update({ enabled: true, mode: "test", config: { base_url: `http://127.0.0.1:${port}`, public_key: "pk_test_local", integrations: { USD: [222] } } }).eq("id", "paymob");
  await db.rpc("set_payment_secret", { p_provider: "paymob", p_name: "secret_key", p_secret: "local-secret-key" });
  await db.rpc("set_payment_secret", { p_provider: "paymob", p_name: "hmac_secret", p_secret: HMAC });
  await db.from("plan_quotas").update({ price_usd: 9.99 }).eq("plan", "pro");
  await db.from("plan_quotas").update({ price_usd: 24.99 }).eq("plan", "growth");

  // A new workspace (Egypt pays the same USD price, D-131).
  const { data: created, error } = await db.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  userId = created.user.id;
  const { data: prof } = await db.from("profiles").select("workspace_id").eq("id", userId).single();
  const wsId = prof!.workspace_id!;
  await db.from("workspaces").update({ name: "Payments Test Co", billing_country: "EG" }).eq("id", wsId);
  const buyer = { userId, email, name: "Sara Ali", country: "EG" };

  // 1) Checkout: server-priced pending payment + Paymob URL.
  let r = await startCheckout(await ws(wsId), buyer, { kind: "subscription", plan: "pro", period: "monthly" });
  assert.ok(r.ok, "checkout starts");
  assert.match(r.url, /\/unifiedcheckout\/\?publicKey=pk_test_local&clientSecret=csk_test_/);
  let { data: pays } = await db.from("payments").select("*").eq("workspace_id", wsId);
  assert.equal(pays!.length, 1);
  const sub = pays![0];
  assert.equal(sub.status, "pending"); assert.equal(Number(sub.amount), 9.99); assert.equal(sub.currency, "USD");
  assert.equal((intentions.at(-1) as { amount: number }).amount, 999);
  assert.equal((intentions.at(-1) as { currency: string }).currency, "USD", "USD sent; Paymob converts (D-142)");
  assert.deepEqual((intentions.at(-1) as { payment_methods: number[] }).payment_methods, [222]);

  // 2) Bad signature / wrong amount change nothing.
  assert.equal((await callback(txn(sub.id, sub.provider_ref!, 999), "wrong-secret")).status, 401);
  assert.equal((await callback(txn(sub.id, sub.provider_ref!, 100))).status, 200);
  assert.equal((await callback(txn(sub.id, sub.provider_ref!, 999, { currency: "SAR" }))).status, 200);
  assert.equal((await payment(sub.id)).status, "pending");
  assert.equal((await ws(wsId)).subscription_status, "none");

  // 3) Signed success → plan starts, USD invoice, replay is a no-op.
  const ok = txn(sub.id, sub.provider_ref!, 999);
  assert.equal((await callback(ok)).status, 200);
  assert.equal((await callback(ok)).status, 200);
  const paid = await payment(sub.id);
  assert.equal(paid.status, "succeeded"); assert.ok(paid.invoice_id);
  const w = await ws(wsId);
  assert.equal(w.plan, "pro"); assert.equal(w.subscription_status, "test"); assert.equal(w.billing_currency, "USD");
  const { data: invs } = await db.from("invoices").select("*").eq("workspace_id", wsId);
  assert.equal(invs!.length, 1); assert.equal(invs![0].currency, "USD"); assert.equal(Number(invs![0].amount), 9.99); assert.equal(invs![0].payment_id, sub.id);

  // 4) Failed payment → nothing starts.
  r = await startCheckout(await ws(wsId), buyer, { kind: "subscription", plan: "growth", period: "annual" });
  assert.ok(r.ok);
  ({ data: pays } = await db.from("payments").select("*").eq("workspace_id", wsId).eq("plan", "growth"));
  const bad = pays![0];
  assert.equal(Number(bad.amount), 24.99 * 12);
  await callback(txn(bad.id, bad.provider_ref!, Math.round(24.99 * 12 * 100), { success: false, data: { message: "Do not honour" } }));
  assert.equal((await payment(bad.id)).status, "failed");
  assert.equal((await payment(bad.id)).failure_reason, "Do not honour");
  assert.equal((await ws(wsId)).plan, "pro");

  // 5) Buy More Prospects → grant + pack invoice; then a refund voids it.
  const { data: pack } = await db.from("prospect_packs").insert({ prospects: 100, price_usd: 2.5 }).select("id").single();
  packId = pack!.id;
  r = await startCheckout(await ws(wsId), buyer, { kind: "prospect_pack", packId });
  assert.ok(r.ok);
  ({ data: pays } = await db.from("payments").select("*").eq("workspace_id", wsId).eq("kind", "prospect_pack"));
  const pk = pays![0];
  assert.equal(Number(pk.amount), 2.5);
  // Settled through the signed redirect this time.
  const t = txn(pk.id, pk.provider_ref!, 250);
  const q = new URLSearchParams(Object.fromEntries(Object.entries({ ...t, order: t.order.id, merchant_order_id: pk.id, "source_data.pan": "2346", "source_data.type": "card", "source_data.sub_type": "MasterCard" }).filter(([, v]) => typeof v !== "object").map(([k, v]) => [k, String(v)])));
  q.set("hmac", signPaymob(hmacStringFromTransaction(t), HMAC));
  const back = await fetch(`${app}/api/payments/paymob/return?${q}`, { redirect: "manual" });
  assert.equal(back.status, 307);
  assert.match(back.headers.get("location") ?? "", new RegExp(`/billing/result\\?payment=${pk.id}`));
  assert.equal((await payment(pk.id)).status, "succeeded");
  const { data: grants } = await db.from("usage_ledger").select("*").eq("workspace_id", wsId).eq("kind", "grant");
  assert.equal(grants!.length, 1); assert.equal(grants![0].prospects, 100);
  const packInvoice = (await payment(pk.id)).invoice_id!;
  const { data: pi } = await db.from("invoices").select("*").eq("id", packInvoice).single();
  assert.equal(pi!.kind, "prospect_pack"); assert.equal(pi!.prospects, 100); assert.equal(pi!.currency, "USD");

  await callback(txn(pk.id, pk.provider_ref!, 250, { is_refunded: true }));
  assert.equal((await payment(pk.id)).status, "refunded");
  assert.equal((await db.from("invoices").select("status").eq("id", packInvoice).single()).data!.status, "void");

  // 6) Live renewal: period ends → open invoice + past due → paying it renews.
  const past = new Date(Date.now() - 86_400_000).toISOString();
  await db.from("workspaces").update({ subscription_status: "active", current_period_end: past }).eq("id", wsId);
  const sweep = await billingSweep();
  assert.ok(sweep.due >= 1);
  assert.equal((await ws(wsId)).subscription_status, "past_due");
  const { data: open } = await db.from("invoices").select("*").eq("workspace_id", wsId).eq("status", "open").single();
  assert.equal(open!.currency, "USD"); assert.equal(Number(open!.amount), 9.99);
  assert.equal((await billingSweep()).due, 0, "sweep is idempotent");
  r = await startCheckout(await ws(wsId), buyer, { kind: "subscription", plan: "pro", period: "monthly", invoiceId: open!.id });
  assert.ok(r.ok);
  const { data: renewal } = await db.from("payments").select("*").eq("invoice_id", open!.id).single();
  // Paymob converted the card charge to EGP: settled, and the EGP amount is recorded.
  await callback(txn(renewal!.id, renewal!.provider_ref!, 49_950, { currency: "EGP" }));
  const rp = await payment(renewal!.id);
  assert.equal(rp.status, "succeeded"); assert.equal(Number(rp.charge_amount), 499.5); assert.equal(rp.charge_currency, "EGP"); assert.equal(Number(rp.fx_rate), 50);
  const renewed = await ws(wsId);
  assert.equal(renewed.subscription_status, "active");
  assert.equal(new Date(renewed.current_period_end!).getTime(), new Date(open!.period_end).getTime());
  assert.equal((await db.from("invoices").select("status").eq("id", open!.id).single()).data!.status, "paid");

  // 7) Unpaid past the grace period → Free, open invoice voided.
  const longAgo = new Date(Date.now() - 10 * 86_400_000).toISOString();
  await db.from("workspaces").update({ subscription_status: "past_due", current_period_end: longAgo }).eq("id", wsId);
  const { data: unpaid } = await db.from("invoices").insert({ workspace_id: wsId, kind: "subscription", plan: "pro", billing_period: "monthly", amount: 9.99, currency: "USD", status: "open", mode: "live", period_start: longAgo, period_end: new Date().toISOString(), bill_to_email: email }).select("id").single();
  const ended = await settleSubscription(await ws(wsId));
  assert.equal(ended.plan, "free");
  assert.equal((await db.from("invoices").select("status").eq("id", unpaid!.id).single()).data!.status, "void");

  console.log("✓ payments: checkout, signature, amount check, idempotency, failure, pack, redirect, refund, live renewal, grace downgrade");
} finally {
  if (userId) {
    const { data: prof } = await db.from("profiles").select("workspace_id").eq("id", userId).maybeSingle();
    if (prof?.workspace_id) await db.from("workspaces").delete().eq("id", prof.workspace_id);
    await db.auth.admin.deleteUser(userId);
  }
  if (packId) await db.from("prospect_packs").delete().eq("id", packId);
  await db.from("payment_providers").update({ enabled: before!.enabled, mode: before!.mode, config: before!.config }).eq("id", "paymob");
  for (const [name, value] of Object.entries(savedSecrets)) {
    if (value) await db.rpc("set_payment_secret", { p_provider: "paymob", p_name: name, p_secret: value });
    else await db.rpc("clear_payment_secret", { p_provider: "paymob", p_name: name });
  }
  for (const row of quotas ?? []) await db.from("plan_quotas").update({ price_usd: row.price_usd }).eq("plan", row.plan);
  server.close();
}
