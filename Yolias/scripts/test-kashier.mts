// End-to-end test of payments through Kashier (D-235) against the local
// Supabase, with a local stand-in for Kashier's APIs (scripts/kashier-standin)
// — nothing is charged, nothing leaves this machine:
//   npm run test:kashier
// Covers: checkout creates a pending payment priced on the server and an
// embedded Kashier session (USD, card saved for subscriptions), a repeat click
// reuses it, forged / wrong-amount webhooks change nothing, the signed webhook
// starts the plan with an invoice, replays are no-ops, the card is saved to
// Vault, failures start nothing, packs grant prospects (confirmed through the
// return page, never trusting the browser), refunds void the invoice,
// renewals are charged to the saved card, a declined renewal leaves the plan
// past due with one attempt a day, paying the invoice renews it, EGP accounts
// are charged at the day's rate, the switch turns Kashier off, and the grace
// period ends an unpaid plan.
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { chargeRenewal, providerFor, startCheckout } from "@/lib/payments/index.ts";
import { billingSweep, settleSubscription } from "@/lib/billing.ts";
import { resetSwitchCache } from "@/lib/switches.ts";
import { customerReference } from "@/lib/payments/kashier.ts";
import type { Database, WorkspaceRow } from "@/types/database.ts";
import { KASHIER, signedWebhook, startKashierStandIn } from "./kashier-standin.mts";
// Never the owner's real keys from Yolias Admin → Integrations (D-132): no LLM keys in this test.
(await import("@/lib/integrations.ts")).setIntegrationsForTests({});

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = createClient<Database>(url, svc, { auth: { persistSession: false } });
const kashier = await startKashierStandIn();
const webhook = (await import("@/app/api/payments/kashier/route.ts")).POST;
const returnPage = (await import("@/app/api/payments/kashier/return/route.ts")).GET;

const { data: before } = await db.from("payment_providers").select("*").eq("id", "kashier").single();
const { data: quotas } = await db.from("plan_quotas").select("plan, price_usd");
const { data: fxBefore } = await db.from("site_settings").select("value").eq("key", "yolias_fx_usd_egp").maybeSingle();
const { data: switchesBefore } = await db.from("site_settings").select("value").eq("key", "platform_switches").maybeSingle();
// The owner's real Kashier keys are restored after the test, never wiped.
const secret = async (name: string) => (await db.rpc("payment_secret", { p_provider: "kashier", p_name: name })).data as string | null;
const savedSecrets = { api_key: await secret("api_key"), secret_key: await secret("secret_key") };
const email = `payments-test-${Date.now()}@yolias.local`;
let userId: string | null = null;
let packId: string | null = null;

const ws = async (id: string) => (await db.from("workspaces").select("*").eq("id", id).single()).data as WorkspaceRow;
const payment = async (id: string) => (await db.from("payments").select("*").eq("id", id).single()).data!;
const lastSession = () => kashier.sessions.at(-1) as Record<string, unknown> & { customer: { reference: string } };

function paid(p: { id: string; provider_ref: string | null }, amount: string, over: Record<string, unknown> = {}) {
  return { merchantOrderId: p.id, kashierOrderId: `KO-${p.provider_ref}`, transactionId: `TX-${Math.floor(Math.random() * 1e9)}`, amount, currency: "USD", status: "SUCCESS", method: "card", cardBrand: "Mastercard", maskedCard: "512345******0008", ...over };
}
async function send(event: string, data: Record<string, unknown>, key = KASHIER.apiKey) {
  const w = signedWebhook(event, data, key);
  return webhook(new NextRequest("http://localhost/api/payments/kashier", { method: "POST", headers: { "content-type": "application/json", "x-kashier-signature": w.signature }, body: w.body }));
}

try {
  await db.from("payment_providers").update({ enabled: true, mode: "test", config: { merchant_id: KASHIER.merchantId, currency: "USD", save_card: "forced" } }).eq("id", "kashier");
  await db.rpc("set_payment_secret", { p_provider: "kashier", p_name: "api_key", p_secret: KASHIER.apiKey });
  await db.rpc("set_payment_secret", { p_provider: "kashier", p_name: "secret_key", p_secret: KASHIER.secretKey });
  await db.from("site_settings").upsert({ key: "platform_switches", value: {} });
  await db.from("site_settings").upsert({ key: "yolias_fx_usd_egp", value: { fixed: 50 } });
  await db.from("plan_quotas").update({ price_usd: 9.99 }).eq("plan", "pro");
  await db.from("plan_quotas").update({ price_usd: 24.99 }).eq("plan", "growth");
  resetSwitchCache();

  const { data: created, error } = await db.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  userId = created.user.id;
  const { data: prof } = await db.from("profiles").select("workspace_id").eq("id", userId).single();
  const wsId = prof!.workspace_id!;
  await db.from("workspaces").update({ name: "Payments Test Co", billing_country: "EG" }).eq("id", wsId);
  const buyer = { userId, email, name: "Sara Ali", country: "EG", language: "ar" as const };

  // 1) Checkout: server-priced pending payment + an embedded Kashier session in USD.
  let r = await startCheckout(await ws(wsId), buyer, { kind: "subscription", plan: "pro", period: "monthly" }, null, "kashier");
  assert.ok(r.ok, "checkout starts");
  assert.ok(r.embed, "paid inside the Yolias checkout page");
  assert.match(r.url, /^https:\/\/payments\.kashier\.io\/session\/sess_\d+\?mode=test$/);
  const sub = await payment(r.paymentId);
  assert.equal(sub.status, "pending"); assert.equal(sub.provider, "kashier");
  assert.equal(Number(sub.amount), 9.99); assert.equal(sub.currency, "USD");
  assert.equal(Number(sub.charge_amount), 9.99); assert.equal(sub.charge_currency, "USD"); assert.equal(sub.fx_rate, null);
  const s1 = lastSession();
  assert.equal(s1.merchantId, KASHIER.merchantId); assert.equal(s1.order, sub.id);
  assert.equal(s1.amount, "9.99"); assert.equal(s1.currency, "USD");
  assert.equal(s1.saveCard, "forced", "subscriptions save the card for renewals");
  assert.equal(s1.allowedMethods, "card"); assert.equal(s1.display, "ar");
  assert.equal(s1.customer.reference, customerReference(wsId));
  assert.match(String(s1.serverWebhook), /\/api\/payments\/kashier$/);
  assert.match(String(s1.merchantRedirect), new RegExp(`/api/payments/kashier/return\\?payment=${sub.id}$`));

  // 1b) A second click reuses the same session: no new payment, no new session.
  const sessionCount = kashier.sessions.length;
  const again = await startCheckout(await ws(wsId), buyer, { kind: "subscription", plan: "pro", period: "monthly" }, null, "kashier");
  assert.ok(again.ok && again.url === r.url && again.paymentId === sub.id, "the same checkout is reused");
  assert.equal(kashier.sessions.length, sessionCount, "no second Kashier session");

  // 2) Forged signature / wrong amount / wrong currency change nothing.
  assert.equal((await send("pay", paid(sub, "9.99"), "wrong-key")).status, 401);
  const unsigned = await webhook(new NextRequest("http://localhost/api/payments/kashier", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: "pay", data: { ...paid(sub, "9.99"), signatureKeys: ["amount"] } }) }));
  assert.equal(unsigned.status, 401, "no signature, no change");
  assert.equal((await send("pay", paid(sub, "0.99"))).status, 200);
  assert.equal((await send("pay", paid(sub, "9.99", { currency: "EGP" }))).status, 200);
  assert.equal((await payment(sub.id)).status, "pending");
  assert.equal((await ws(wsId)).subscription_status, "none");

  // 3) Signed success → plan starts, USD invoice, card saved to Vault; replay is a no-op.
  kashier.cards.set(customerReference(wsId), { cardToken: "tok_local_card_1", number: "512345******0008", brand: "MASTERCARD" });
  const ok = paid(sub, "9.99");
  assert.equal((await send("pay", ok)).status, 200);
  assert.equal((await send("pay", ok)).status, 200);
  const paidSub = await payment(sub.id);
  assert.equal(paidSub.status, "succeeded"); assert.ok(paidSub.invoice_id); assert.ok(paidSub.fulfilled_at);
  let w = await ws(wsId);
  assert.equal(w.plan, "pro"); assert.equal(w.subscription_status, "test"); assert.equal(w.billing_provider, "kashier");
  const { data: invs } = await db.from("invoices").select("*").eq("workspace_id", wsId);
  assert.equal(invs!.length, 1, "one invoice despite the replay"); assert.equal(invs![0].currency, "USD"); assert.equal(Number(invs![0].amount), 9.99);
  const { data: card } = await db.from("billing_cards").select("*").eq("workspace_id", wsId).single();
  assert.equal(card!.last4, "0008"); assert.equal(card!.brand, "MASTERCARD"); assert.equal(card!.status, "active"); assert.ok(card!.token_secret_id);
  assert.equal((await db.rpc("card_token", { p_card: card!.id })).data, "tok_local_card_1", "the token is in Vault");
  // Only the server reads the token.
  const anon = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  assert.ok((await anon.rpc("card_token", { p_card: card!.id })).error, "the token RPC is refused outside the server");

  // 4) Failed payment → nothing starts.
  r = await startCheckout(await ws(wsId), buyer, { kind: "subscription", plan: "growth", period: "annual" }, null, "kashier");
  assert.ok(r.ok);
  const bad = await payment(r.paymentId);
  assert.equal(Number(bad.amount), 239.88, "annual = 12 × (24.99 − 20%)");
  await send("pay", paid(bad, "239.88", { status: "FAILURE", transactionResponseMessage: "Do not honour" }));
  assert.equal((await payment(bad.id)).status, "failed");
  assert.equal((await payment(bad.id)).failure_reason, "Do not honour");
  assert.equal((await ws(wsId)).plan, "pro");

  // 5) Buy More Prospects, confirmed when the customer comes back: Kashier's API is asked, not the browser.
  const { data: pack } = await db.from("prospect_packs").insert({ prospects: 100, price_usd: 2.5 }).select("id").single();
  packId = pack!.id;
  r = await startCheckout(await ws(wsId), buyer, { kind: "prospect_pack", packId }, null, "kashier");
  assert.ok(r.ok);
  const pk = await payment(r.paymentId);
  assert.equal(Number(pk.amount), 2.5);
  assert.equal(lastSession().saveCard, undefined, "packs don't save the card");
  const back = async (id: string) => (await returnPage(new NextRequest(`http://localhost/api/payments/kashier/return?payment=${id}`))).text();
  assert.match(await back(pk.id), /billing\/result\?payment=/);
  assert.equal((await payment(pk.id)).status, "pending", "still pending while Kashier says pending");
  kashier.sessionState.set(pk.provider_ref!, { paymentStatus: "SUCCESS", amount: "2.50", currency: "USD", merchantOrderId: "11111111-1111-1111-1111-111111111111", transactionId: "TX-X" });
  await back(pk.id);
  assert.equal((await payment(pk.id)).status, "pending", "a session that belongs to another order settles nothing");
  kashier.sessionState.set(pk.provider_ref!, { paymentStatus: "SUCCESS", amount: "2.50", currency: "USD", merchantOrderId: pk.id, transactionId: "TX-PACK" });
  const html = await back(pk.id);
  assert.match(html, new RegExp(`window\\.top\\.location\\.href=.*billing/result\\?payment=${pk.id}`), "breaks out of the frame to the result page");
  assert.equal((await payment(pk.id)).status, "succeeded");
  await send("pay", paid(pk, "2.50"));
  const { data: grants } = await db.from("usage_ledger").select("*").eq("workspace_id", wsId).eq("kind", "grant").eq("reason", `prospect_pack:${pk.id}`);
  assert.equal(grants!.length, 1, "granted once (return page and webhook)"); assert.equal(grants![0].prospects, 100);
  const packInvoice = (await payment(pk.id)).invoice_id!;
  assert.equal((await db.from("invoices").select("kind").eq("id", packInvoice).single()).data!.kind, "prospect_pack");

  // 6) Refund → payment refunded, invoice voided.
  await send("refund", paid(pk, "2.50"));
  assert.equal((await payment(pk.id)).status, "refunded");
  assert.equal((await db.from("invoices").select("status").eq("id", packInvoice).single()).data!.status, "void");

  // 7) Renewal: the period ends → the saved card is charged, the plan continues.
  const past = new Date(Date.now() - 3_600_000).toISOString();
  await db.from("workspaces").update({ subscription_status: "active", current_period_end: past }).eq("id", wsId);
  let sweep = await billingSweep();
  assert.ok(sweep.renewed >= 1, "renewed from the saved card");
  const charge1 = kashier.orders.at(-1) as { order: { amount: string; currency: string; reference: string }; paymentMethod: { card: { cardToken: string; enable3DS: boolean } }; interactionSource: string };
  assert.equal(charge1.paymentMethod.card.cardToken, "tok_local_card_1"); assert.equal(charge1.paymentMethod.card.enable3DS, false);
  assert.equal(charge1.interactionSource, "RECURRING"); assert.equal(charge1.order.amount, "9.99"); assert.equal(charge1.order.currency, "USD");
  w = await ws(wsId);
  assert.equal(w.subscription_status, "active");
  assert.ok(new Date(w.current_period_end!).getTime() > Date.now() + 20 * 86_400_000, "a new month");
  const renewalPay = await payment(charge1.order.reference);
  assert.equal(renewalPay.status, "succeeded");
  assert.equal((await db.from("invoices").select("status").eq("id", renewalPay.invoice_id!).single()).data!.status, "paid");
  // Kashier's webhook for the same charge arrives afterwards: nothing happens twice.
  const invoiceCount = (await db.from("invoices").select("id").eq("workspace_id", wsId)).data!.length;
  await send("pay", paid(renewalPay, "9.99"));
  assert.equal((await db.from("invoices").select("id").eq("workspace_id", wsId)).data!.length, invoiceCount);

  // 8) Declined renewal → past due with an open invoice; one automatic attempt a day.
  await db.from("workspaces").update({ current_period_end: past }).eq("id", wsId);
  kashier.declineNext.on = true;
  sweep = await billingSweep();
  assert.ok(sweep.due >= 1);
  assert.equal((await ws(wsId)).subscription_status, "past_due");
  const { data: open } = await db.from("invoices").select("*").eq("workspace_id", wsId).eq("status", "open").single();
  assert.equal(Number(open!.amount), 9.99);
  const ordersAfterDecline = kashier.orders.length;
  await billingSweep();
  assert.equal(kashier.orders.length, ordersAfterDecline, "no second charge the same day");
  assert.equal(await chargeRenewal(await ws(wsId), open!.id), "declined");

  // 9) The member pays the open invoice from the checkout → renewed.
  r = await startCheckout(await ws(wsId), buyer, { kind: "subscription", plan: "pro", period: "monthly", invoiceId: open!.id }, null, "kashier");
  assert.ok(r.ok);
  const inv = await payment(r.paymentId);
  await send("pay", paid(inv, "9.99"));
  const renewed = await ws(wsId);
  assert.equal(renewed.subscription_status, "active");
  assert.equal(new Date(renewed.current_period_end!).getTime(), new Date(open!.period_end).getTime());
  assert.equal((await db.from("invoices").select("status").eq("id", open!.id).single()).data!.status, "paid");

  // 10) An EGP Kashier account: a plan bought from Egypt is charged its EGP price.
  await db.from("payment_providers").update({ config: { merchant_id: KASHIER.merchantId, currency: "EGP", save_card: "forced" } }).eq("id", "kashier");
  r = await startCheckout(await ws(wsId), buyer, { kind: "subscription", plan: "growth", period: "monthly" }, null, "kashier");
  assert.ok(r.ok);
  const egp = await payment(r.paymentId);
  assert.equal(Number(egp.amount), 24.99); assert.equal(egp.currency, "USD");
  assert.equal(Number(egp.charge_amount), 4999, "Egypt pays the plan's EGP price (D-237)"); assert.equal(egp.charge_currency, "EGP");
  assert.equal(lastSession().amount, "4999.00"); assert.equal(lastSession().currency, "EGP");
  await db.from("payment_providers").update({ config: { merchant_id: KASHIER.merchantId, currency: "USD", save_card: "forced" } }).eq("id", "kashier");

  // 11) Switched off in Admin → no new Kashier checkout.
  await db.from("site_settings").upsert({ key: "platform_switches", value: { payments_kashier: false } });
  resetSwitchCache();
  assert.equal(await providerFor("kashier"), null, "Kashier refused while switched off");
  assert.deepEqual(await startCheckout(await ws(wsId), buyer, { kind: "prospect_pack", packId }, null, "kashier"), { ok: false, error: "not_connected" });
  await db.from("site_settings").upsert({ key: "platform_switches", value: {} });
  resetSwitchCache();
  assert.ok(await providerFor("kashier"), "available again when switched on");

  // 12) Unpaid past the grace period → the plan ends, the open invoice is voided.
  const longAgo = new Date(Date.now() - 10 * 86_400_000).toISOString();
  await db.from("workspaces").update({ subscription_status: "past_due", current_period_end: longAgo }).eq("id", wsId);
  const { data: unpaid } = await db.from("invoices").insert({ workspace_id: wsId, kind: "subscription", plan: "pro", billing_period: "monthly", amount: 9.99, currency: "USD", status: "open", mode: "live", period_start: longAgo, period_end: new Date().toISOString(), bill_to_email: email }).select("id").single();
  const ended = await settleSubscription(await ws(wsId));
  assert.equal(ended.subscription_status, "canceled");
  assert.equal((await db.from("invoices").select("status").eq("id", unpaid!.id).single()).data!.status, "void");

  console.log("✓ payments (Kashier): embedded USD checkout, reuse, signature, amount check, idempotency, saved card in Vault, failure, pack via return page, refund, auto renewal, declined renewal, paying the invoice, EGP account, switch, grace period");
} finally {
  if (userId) {
    const { data: prof } = await db.from("profiles").select("workspace_id").eq("id", userId).maybeSingle();
    if (prof?.workspace_id) {
      const { data: cards } = await db.from("billing_cards").select("id").eq("workspace_id", prof.workspace_id);
      for (const c of cards ?? []) await db.rpc("clear_card_token", { p_card: c.id });
      await db.from("workspaces").delete().eq("id", prof.workspace_id);
    }
    await db.auth.admin.deleteUser(userId);
  }
  if (packId) await db.from("prospect_packs").delete().eq("id", packId);
  if (fxBefore) await db.from("site_settings").upsert({ key: "yolias_fx_usd_egp", value: fxBefore.value });
  else await db.from("site_settings").delete().eq("key", "yolias_fx_usd_egp");
  await db.from("site_settings").upsert({ key: "platform_switches", value: switchesBefore?.value ?? {} });
  await db.from("payment_providers").update({ enabled: before!.enabled, mode: before!.mode, config: before!.config }).eq("id", "kashier");
  for (const [name, value] of Object.entries(savedSecrets)) {
    if (value) await db.rpc("set_payment_secret", { p_provider: "kashier", p_name: name, p_secret: value });
    else await db.rpc("clear_payment_secret", { p_provider: "kashier", p_name: name });
  }
  for (const row of quotas ?? []) await db.from("plan_quotas").update({ price_usd: row.price_usd }).eq("plan", row.plan);
  kashier.close();
}
