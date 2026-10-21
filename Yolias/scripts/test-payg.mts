// End-to-end test of Pay As You Go and the new pricing (D-247) against the
// local Supabase and the running app (`npm run local`), with a local stand-in
// for Paymob's Intention API: nothing is charged, nothing leaves this machine.
//   npm run test:payg
// Covers: every top-up amount ($5 / $20 / $50 / $100) gives exactly the
// prospects of the configured rate, credit only after a confirmed payment, a
// failed payment adds nothing, a repeated webhook adds nothing, a top-up never
// starts a subscription, consumption draws the credit down, emails are never
// counted or limited, PAYG ↔ monthly keeps the balance, and the public pages
// offer no annual billing and no $200 plan.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createClient } from "@supabase/supabase-js";
import { startCheckout } from "@/lib/payments/index.ts";
import { hmacStringFromTransaction, signPaymob } from "@/lib/payments/paymob.ts";
import { canUseApp, offeredPlans } from "@/lib/plans.ts";
import type { Database, WorkspaceRow } from "@/types/database.ts";
(await import("@/lib/integrations.ts")).setIntegrationsForTests({});

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const app = process.env.YOLIAS_TEST_APP_URL ?? "http://localhost:3200";
const db = createClient<Database>(url, svc, { auth: { persistSession: false } });
const HMAC = "local-test-hmac-secret";

let orderSeq = 7_000_000 + Math.floor(Math.random() * 1_000_000);
const server = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    if (req.method !== "POST" || req.url !== "/v1/intention/" || req.headers.authorization !== "Token local-secret-key") return void res.writeHead(401).end();
    res.writeHead(201, { "content-type": "application/json" }).end(JSON.stringify({ id: `pi_test_${orderSeq}`, intention_order_id: ++orderSeq, client_secret: `csk_test_${orderSeq}` }));
  });
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const port = (server.address() as AddressInfo).port;

const { data: before } = await db.from("payment_providers").select("*").eq("id", "paymob").single();
const { data: fxBefore } = await db.from("site_settings").select("value").eq("key", "yolias_fx_usd_egp").maybeSingle();
const savedSecrets = { secret_key: (await db.rpc("payment_secret", { p_provider: "paymob", p_name: "secret_key" })).data as string | null, hmac_secret: (await db.rpc("payment_secret", { p_provider: "paymob", p_name: "hmac_secret" })).data as string | null };
const email = `payg-test-${Date.now()}@yolias.local`;
let userId: string | null = null;

function txn(paymentId: string, order: string, amountCents: number, over: Record<string, unknown> = {}) {
  return {
    id: Math.floor(Math.random() * 1e9), pending: false, amount_cents: amountCents, success: true, is_auth: false, is_capture: false,
    is_standalone_payment: true, is_voided: false, is_refunded: false, is_3d_secure: true, integration_id: 222, has_parent_transaction: false,
    created_at: new Date().toISOString(), currency: "EGP", error_occured: false, owner: 1,
    order: { id: Number(order), merchant_order_id: paymentId }, source_data: { pan: "2346", type: "card", sub_type: "MasterCard" }, data: { message: "Approved" },
    ...over,
  };
}
async function callback(obj: Record<string, unknown>) {
  const sig = signPaymob(hmacStringFromTransaction(obj), HMAC);
  return fetch(`${app}/api/payments/paymob?hmac=${sig}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "TRANSACTION", obj }) });
}
const ws = async (id: string) => (await db.from("workspaces").select("*").eq("id", id).single()).data as WorkspaceRow;
const payment = async (id: string) => (await db.from("payments").select("*").eq("id", id).single()).data!;
const available = async (id: string) => ((await db.rpc("usage_summary", { p_ws: id })).data as { available: number }[])[0].available;
const grants = async (id: string) => (await db.from("usage_ledger").select("prospects, reason").eq("workspace_id", id).eq("kind", "grant").like("reason", "prospect_pack:%")).data!;

/** Starts a top-up checkout and returns the pending payment. */
async function topUp(wsId: string, buyer: { userId: string; email: string; name: string; country: string }, packId: string) {
  const r = await startCheckout(await ws(wsId), buyer, { kind: "prospect_pack", packId });
  assert.ok(r.ok, "top-up checkout starts");
  const { data } = await db.from("payments").select("*").eq("workspace_id", wsId).eq("kind", "prospect_pack").eq("status", "pending").order("created_at", { ascending: false }).limit(1).single();
  return data!;
}

try {
  await db.from("payment_providers").update({ enabled: true, mode: "test", config: { base_url: `http://127.0.0.1:${port}`, public_key: "pk_test_local", integrations: { USD: [222] } } }).eq("id", "paymob");
  await db.rpc("set_payment_secret", { p_provider: "paymob", p_name: "secret_key", p_secret: "local-secret-key" });
  await db.rpc("set_payment_secret", { p_provider: "paymob", p_name: "hmac_secret", p_secret: HMAC });
  await db.from("site_settings").upsert({ key: "yolias_fx_usd_egp", value: { fixed: 50 } });

  // ── 0. The configuration: four amounts at the system's own rate ──
  const { data: rateRow } = await db.from("site_settings").select("value").eq("key", "credits").single();
  const rate = Number((rateRow!.value as { usd_per_prospect: number }).usd_per_prospect);
  assert.ok(rate > 0, "a rate is configured");
  const { data: packs } = await db.from("prospect_packs").select("*").eq("active", true).order("price_usd");
  assert.deepEqual(packs!.map((p) => Number(p.price_usd)), [5, 20, 50, 100], "top-ups: $5, $20, $50, $100");
  for (const p of packs!) assert.equal(p.prospects, Math.floor(Number(p.price_usd) / rate), `$${p.price_usd} = price / rate prospects`);
  assert.deepEqual(offeredPlans, ["pro", "growth"], "no $200 plan offered");
  // The reference price (owner, 2026-10-21): $50 = 1,000 prospects, i.e. $0.05 each.
  assert.equal(rate, 0.05, "5 cents a prospect");
  assert.equal(packs!.find((p) => Number(p.price_usd) === 50)!.prospects, 1000, "$50 = 1,000 prospects");

  const { data: created, error } = await db.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  userId = created.user.id;
  const wsId = (await db.from("profiles").select("workspace_id").eq("id", userId).single()).data!.workspace_id!;
  await db.from("workspaces").update({ name: "PAYG Test Co" }).eq("id", wsId);
  const buyer = { userId, email, name: "Payg Tester", country: "US" };
  assert.equal(canUseApp(await ws(wsId)), false, "no free access and no free credit");
  assert.equal(await available(wsId), 0, "no free prospects");

  // ── 1. Failed payment: nothing is added ──
  const failed = await topUp(wsId, buyer, packs![0].id);
  await callback(txn(failed.id, failed.provider_ref!, Math.round(Number(failed.charge_amount) * 100), { success: false, data: { message: "Do not honour" } }));
  assert.equal((await payment(failed.id)).status, "failed");
  assert.equal((await grants(wsId)).length, 0, "a failed payment adds no credit");
  assert.equal((await ws(wsId)).credit_started_at, null);
  assert.equal(canUseApp(await ws(wsId)), false);

  // ── 2. Every amount: exact prospects, once, only after confirmation, never a subscription ──
  let expected = 0;
  for (const p of packs!) {
    const pay = await topUp(wsId, buyer, p.id);
    assert.equal(Number(pay.amount), Number(p.price_usd), `charged $${p.price_usd}`);
    assert.equal(await available(wsId), expected, "pending payment adds nothing");
    const ok = txn(pay.id, pay.provider_ref!, Math.round(Number(pay.charge_amount) * 100));
    assert.equal((await callback(ok)).status, 200);
    // The same webhook again (provider retry) and twice at once.
    await Promise.all([callback(ok), callback(ok)]);
    expected += p.prospects;
    const mine = (await grants(wsId)).filter((g) => g.reason === `prospect_pack:${pay.id}`);
    assert.equal(mine.length, 1, `$${p.price_usd}: credited exactly once`);
    assert.equal(mine[0].prospects, p.prospects, `$${p.price_usd}: ${p.prospects} prospects`);
    assert.equal(await available(wsId), expected, "balance = sum of top-ups");
    const w = await ws(wsId);
    assert.equal(w.subscription_status, "none", "a top-up never starts a subscription");
    assert.equal(w.current_period_end, null, "nothing to renew");
    assert.ok(w.credit_started_at, "credit opens the app");
    assert.ok(canUseApp(w));
    const inv = (await db.from("invoices").select("*").eq("payment_id", pay.id).single()).data!;
    assert.equal(inv.kind, "prospect_pack"); assert.equal(inv.prospects, p.prospects);
  }
  assert.equal(expected, packs!.reduce((n, p) => n + p.prospects, 0));

  // ── 3. Consumption: a delivered prospect uses one; reserved but undelivered gives it back ──
  const { data: camp } = await db.from("campaigns").insert({ workspace_id: wsId, name: "payg", criteria: {}, status: "completed", search_type: "companies" }).select("id").single();
  assert.equal((await db.rpc("reserve_usage", { p_ws: wsId, p_campaign: camp!.id, p_n: 10 })).data, 10);
  assert.equal((await db.rpc("consume_usage", { p_ws: wsId, p_campaign: camp!.id, p_n: 3 })).data, 3);
  await db.rpc("release_usage", { p_ws: wsId, p_campaign: camp!.id, p_reason: "test" });
  assert.equal(await available(wsId), expected - 3, "3 delivered = 3 used, the rest released");
  expected -= 3;

  // ── 4. Emails: writing and sending are never counted or limited ──
  const { data: co } = await db.from("companies").insert({ workspace_id: wsId, campaign_id: camp!.id, name: "Acme", source: "test" }).select("id").single();
  const now = new Date().toISOString();
  const mails = Array.from({ length: 120 }, () => ({ workspace_id: wsId, company_id: co!.id, channel: "email" as const, opened_at: now, opened_via: "gmail" as const }));
  assert.equal((await db.from("outreach_messages").insert(mails)).error, null, "no email limit");
  assert.equal(await available(wsId), expected, "emails cost no prospects");

  // ── 5. PAYG → monthly: the credit stays; monthly → canceled: the credit still works ──
  const sub = await startCheckout(await ws(wsId), buyer, { kind: "subscription", plan: "pro", period: "monthly" });
  assert.ok(sub.ok);
  const sp = (await db.from("payments").select("*").eq("workspace_id", wsId).eq("kind", "subscription").eq("status", "pending").single()).data!;
  await callback(txn(sp.id, sp.provider_ref!, Math.round(Number(sp.charge_amount) * 100)));
  let w = await ws(wsId);
  assert.equal(w.plan, "pro"); assert.equal(w.billing_period, "monthly");
  const quota = ((await db.rpc("usage_summary", { p_ws: wsId })).data as { quota: number }[])[0].quota;
  assert.ok(quota > 0, "the plan adds its monthly prospects");
  assert.equal(await available(wsId), quota + expected, "balance kept on upgrade");
  await db.from("workspaces").update({ subscription_status: "canceled" }).eq("id", wsId);
  w = await ws(wsId);
  assert.ok(canUseApp(w), "credit keeps the app open after the plan ends");

  // ── 6. Public pages: three options, no annual, no $200 plan, no email limits ──
  const html = await (await fetch(`${app}/pricing`, { headers: { "accept-language": "en" } })).text();
  assert.match(html, /Pay As You Go/);
  for (const banned of [/Annual/i, /billed yearly/i, /Scale/, /\$200/, /emails \/ month/i, /1,000 emails/i]) assert.doesNotMatch(html, banned, `pricing page has no ${banned}`);
  assert.doesNotMatch(html, /\$5 = /, "the cards don't list the top-up amounts (owner, 2026-10-21)");

  console.log("✓ payg: four amounts at the configured rate, failed payment adds nothing, duplicate webhooks credit once, no subscription, consumption, no email charge, PAYG ↔ monthly keeps the balance, no annual / $200 on the pricing page");
} finally {
  if (userId) {
    const { data: prof } = await db.from("profiles").select("workspace_id").eq("id", userId).maybeSingle();
    if (prof?.workspace_id) await db.from("workspaces").delete().eq("id", prof.workspace_id);
    await db.auth.admin.deleteUser(userId);
  }
  if (fxBefore) await db.from("site_settings").upsert({ key: "yolias_fx_usd_egp", value: fxBefore.value });
  else await db.from("site_settings").delete().eq("key", "yolias_fx_usd_egp");
  await db.from("payment_providers").update({ enabled: before!.enabled, mode: before!.mode, config: before!.config }).eq("id", "paymob");
  for (const [name, value] of Object.entries(savedSecrets)) {
    if (value) await db.rpc("set_payment_secret", { p_provider: "paymob", p_name: name, p_secret: value });
    else await db.rpc("clear_payment_secret", { p_provider: "paymob", p_name: name });
  }
  server.close();
}
