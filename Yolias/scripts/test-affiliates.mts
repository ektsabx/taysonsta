// Affiliate program end to end (D-178), against the local Supabase and the
// running app, with the local Paymob stand-in (nothing is charged):
//   npm run test:affiliates
// Covers: one application per account, referral links and attribution rules
// (window, self-referral, visit after signup), commissions created only from
// signed payment callbacks, replays never duplicate, recurring limits,
// refunds reverse, maturation, payouts (minimum, details, one open request
// even under concurrent requests, allowed transitions, paid → clawback),
// the ledger can't be deleted or rewritten, and members only see their own rows.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createClient } from "@supabase/supabase-js";
import { startCheckout } from "@/lib/payments/index.ts";
import { hmacStringFromTransaction, signPaymob } from "@/lib/payments/paymob.ts";
import { applyAffiliate, attributeSignup, recordVisit, requestPayout, savePayoutDetails } from "@/lib/affiliates/index.ts";
import { matureCommissions } from "@/lib/affiliates/notify.ts";
import type { Database, Json, WorkspaceRow } from "@/types/database.ts";
(await import("@/lib/integrations.ts")).setIntegrationsForTests({});

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, svc = process.env.SUPABASE_SERVICE_ROLE_KEY!, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
assert.match(url, /127\.0\.0\.1|localhost/, "local database only");
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

const { data: providerBefore } = await db.from("payment_providers").select("*").eq("id", "paymob").single();
const { data: quotas } = await db.from("plan_quotas").select("plan, price_usd");
const { data: fxBefore } = await db.from("site_settings").select("value").eq("key", "yolias_fx_usd_egp").maybeSingle();
const savedSecrets = { secret_key: (await db.rpc("payment_secret", { p_provider: "paymob", p_name: "secret_key" })).data as string | null, hmac_secret: (await db.rpc("payment_secret", { p_provider: "paymob", p_name: "hmac_secret" })).data as string | null };
const { data: programBefore } = await db.from("affiliate_program_versions").select("settings, terms_version, terms_text").order("id", { ascending: false }).limit(1).single();

const stamp = Date.now();
const users: string[] = [];
let affiliateId: string | null = null;

function txn(paymentId: string, order: string, amountCents: number, over: Record<string, unknown> = {}) {
  return {
    id: Math.floor(Math.random() * 1e9), pending: false, amount_cents: amountCents, success: true, is_auth: false, is_capture: false,
    is_standalone_payment: true, is_voided: false, is_refunded: false, is_3d_secure: true, integration_id: 222, has_parent_transaction: false,
    created_at: new Date().toISOString(), currency: "EGP", error_occured: false, owner: 1,
    order: { id: Number(order), merchant_order_id: paymentId }, source_data: { pan: "2346", type: "card", sub_type: "MasterCard" }, data: { message: "Approved" }, ...over,
  };
}
async function callback(obj: Record<string, unknown>) {
  const res = await fetch(`${app}/api/payments/paymob?hmac=${signPaymob(hmacStringFromTransaction(obj), HMAC)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "TRANSACTION", obj }) });
  assert.equal(res.status, 200, "signed callback accepted");
}
async function newUser(tag: string, password?: string) {
  const { data, error } = await db.auth.admin.createUser({ email: `affiliates-test-${tag}-${stamp}@yolias.local`, email_confirm: true, ...(password ? { password } : {}) });
  if (error) throw error;
  users.push(data.user.id);
  return data.user;
}
async function setProgram(patch: Record<string, unknown>) {
  const settings = { ...(programBefore!.settings as Record<string, unknown>), ...patch };
  await db.from("affiliate_program_versions").insert({ settings: settings as Json, terms_version: programBefore!.terms_version, terms_text: programBefore!.terms_text, note: "test", created_by: "test" });
}
const ws = async (id: string) => (await db.from("workspaces").select("*").eq("id", id).single()).data as WorkspaceRow;
async function pay(wsId: string, buyer: { userId: string; email: string; name: string; country: string }, plan: "pro" | "growth") {
  const r = await startCheckout(await ws(wsId), buyer, { kind: "subscription", plan, period: "monthly" });
  assert.ok(r.ok, "checkout starts");
  const { data: p } = await db.from("payments").select("*").eq("workspace_id", wsId).eq("status", "pending").order("created_at", { ascending: false }).limit(1).single();
  const cents = Math.round(Number(p!.charge_amount) * 100);
  await callback(txn(p!.id, p!.provider_ref!, cents));
  return { id: p!.id, order: p!.provider_ref!, cents };
}
const commissionsOf = async (paymentId: string) => (await db.from("affiliate_commissions").select("*").eq("payment_id", paymentId)).data ?? [];

try {
  await db.from("payment_providers").update({ enabled: true, mode: "test", config: { base_url: `http://127.0.0.1:${port}`, public_key: "pk_test_local", integrations: { USD: [222] } } }).eq("id", "paymob");
  await db.rpc("set_payment_secret", { p_provider: "paymob", p_name: "secret_key", p_secret: "local-secret-key" });
  await db.rpc("set_payment_secret", { p_provider: "paymob", p_name: "hmac_secret", p_secret: HMAC });
  await db.from("plan_quotas").update({ price_usd: 10 }).eq("plan", "pro");
  await db.from("plan_quotas").update({ price_usd: 30 }).eq("plan", "growth");
  await db.from("site_settings").upsert({ key: "yolias_fx_usd_egp", value: { fixed: 50 } });
  // Local payments run in Paymob test mode; let them count here only.
  await setProgram({ enabled: true, auto_approve: false, include_test_payments: true, commission: { type: "percent", percent_bps: 2000, fixed_cents: 0 }, recurring: { enabled: true, max_payments: 2 }, hold_days: 30, min_payout_cents: 5000, attribution: { days: 60, model: "first_touch" } });

  // 1) Application: one per account, terms version required, pending first.
  const aff = await newUser("aff", `T3st!${crypto.randomUUID()}`);
  assert.deepEqual(await applyAffiliate({ id: aff.id, email: aff.email! }, { answers: { website: "https://example.com", audience: "Agency owners", promotion: "Newsletter" }, acceptedTerms: "wrong", ip: "10.0.0.1" }), { ok: false, error: "terms" });
  // No application questions and no review (D-206): accepting the terms approves at once.
  const applied = await applyAffiliate({ id: aff.id, email: aff.email! }, { answers: {}, acceptedTerms: programBefore!.terms_version, ip: "10.0.0.1" });
  assert.deepEqual(applied, { ok: true, status: "approved" });
  assert.deepEqual(await applyAffiliate({ id: aff.id, email: aff.email! }, { answers: { website: "https://example.com", audience: "Agency owners", promotion: "Newsletter" }, acceptedTerms: programBefore!.terms_version, ip: "10.0.0.1" }), { ok: false, error: "exists" });
  const { data: a } = await db.from("affiliates").select("*").eq("user_id", aff.id).single();
  affiliateId = a!.id;
  assert.equal(a!.terms_version, programBefore!.terms_version);

  // A suspended partner (Admin can still suspend) gets no referrals.
  await db.from("affiliates").update({ status: "suspended" }).eq("id", a!.id);
  const early = await recordVisit(a!.id, { ip: "10.0.0.9", path: "/", campaign: null, referrer: null });
  const customer0 = await newUser("c0");
  if (early) await attributeSignup(customer0.id, early, "10.0.0.9");
  assert.equal((await db.from("affiliate_referrals").select("id").eq("referred_user_id", customer0.id)).data!.length, 0, "suspended: no referral");
  await db.from("affiliates").update({ status: "approved", decided_at: new Date().toISOString(), decided_by: "test" }).eq("id", a!.id);

  // 2) Referral link → visit (deduplicated per network) → attributed signup.
  const visit = await recordVisit(a!.id, { ip: "10.0.0.2", path: "/pricing", campaign: "newsletter-oct", referrer: "https://news.example.com/x" });
  assert.equal(await recordVisit(a!.id, { ip: "10.0.0.2", path: "/", campaign: null, referrer: null }), visit, "repeat visit within 30 minutes counts once");
  const customer = await newUser("c1", `T3st!${crypto.randomUUID()}`);
  await attributeSignup(customer.id, visit!, "10.0.0.2");
  const { data: ref } = await db.from("affiliate_referrals").select("*").eq("referred_user_id", customer.id).single();
  assert.equal(ref!.affiliate_id, a!.id); assert.equal(ref!.campaign, "newsletter-oct"); assert.equal(ref!.model, "first_touch");
  await attributeSignup(customer.id, visit!, "10.0.0.2");
  assert.equal((await db.from("affiliate_referrals").select("id").eq("referred_user_id", customer.id)).data!.length, 1, "one referral per account");

  // Self-referral, expired window and a visit made after the signup are refused.
  await attributeSignup(aff.id, visit!, "10.0.0.1");
  assert.equal((await db.from("affiliate_referrals").select("id").eq("referred_user_id", aff.id)).data!.length, 0, "self-referral");
  const old = await recordVisit(a!.id, { ip: "10.0.0.3", path: "/", campaign: null, referrer: null });
  await db.from("affiliate_visits").update({ created_at: new Date(Date.now() - 90 * 86_400_000).toISOString() }).eq("id", old!);
  const late1 = await newUser("c2");
  await attributeSignup(late1.id, old!, "10.0.0.3");
  assert.equal((await db.from("affiliate_referrals").select("id").eq("referred_user_id", late1.id)).data!.length, 0, "outside the attribution window");
  const after = await recordVisit(a!.id, { ip: "10.0.0.4", path: "/", campaign: null, referrer: null });
  await db.from("affiliate_visits").update({ created_at: new Date(Date.now() + 60 * 60_000).toISOString() }).eq("id", after!);
  await attributeSignup(late1.id, after!, "10.0.0.4");
  assert.equal((await db.from("affiliate_referrals").select("id").eq("referred_user_id", late1.id)).data!.length, 0, "visit after the account was created");
  // Same network as the affiliate: attributed, but flagged for review.
  const sameNet = await newUser("c3");
  const v3 = await recordVisit(a!.id, { ip: "10.0.0.1", path: "/", campaign: null, referrer: null });
  await attributeSignup(sameNet.id, v3!, "10.0.0.1");
  assert.deepEqual((await db.from("affiliate_referrals").select("risk_flags").eq("referred_user_id", sameNet.id).single()).data!.risk_flags, ["same_network_as_affiliate"]);

  // 3) Commission from a signed, fulfilled payment: 20% of $10 = $2.00.
  const { data: prof } = await db.from("profiles").select("workspace_id").eq("id", customer.id).single();
  const wsId = prof!.workspace_id!;
  const buyer = { userId: customer.id, email: customer.email!, name: "Referred Customer", country: "EG" };
  const p1 = await pay(wsId, buyer, "pro");
  let c1 = await commissionsOf(p1.id);
  assert.equal(c1.length, 1, "one commission");
  assert.equal(Number(c1[0].base_cents), 1000); assert.equal(Number(c1[0].amount_cents), 200); assert.equal(c1[0].status, "pending"); assert.equal(c1[0].payment_seq, 1);
  assert.equal((await db.from("affiliate_referrals").select("workspace_id").eq("id", ref!.id).single()).data!.workspace_id, wsId, "referral linked to the workspace");
  // Webhook replays (and a direct re-run) never create a second one.
  await callback(txn(p1.id, p1.order, p1.cents));
  await callback(txn(p1.id, p1.order, p1.cents));
  assert.equal((await db.rpc("affiliate_record_payment", { p_payment: p1.id })).data, null);
  assert.equal((await commissionsOf(p1.id)).length, 1, "replays are no-ops");
  // A failed payment creates nothing.
  const r = await startCheckout(await ws(wsId), buyer, { kind: "subscription", plan: "growth", period: "annual" });
  assert.ok(r.ok);
  const { data: failing } = await db.from("payments").select("*").eq("workspace_id", wsId).eq("status", "pending").order("created_at", { ascending: false }).limit(1).single();
  await callback(txn(failing!.id, failing!.provider_ref!, Math.round(Number(failing!.charge_amount) * 100), { success: false, data: { message: "Do not honour" } }));
  assert.equal((await commissionsOf(failing!.id)).length, 0, "no commission on a failed payment");

  // 4) Recurring: the second payment earns (seq 2), the third is over the limit (2).
  const p2 = await pay(wsId, buyer, "growth");
  const c2 = await commissionsOf(p2.id);
  assert.equal(c2.length, 1); assert.equal(c2[0].payment_seq, 2); assert.equal(Number(c2[0].amount_cents), 600);
  const p3 = await pay(wsId, buyer, "pro");
  assert.equal((await commissionsOf(p3.id)).length, 0, "recurring limit");
  assert.ok((await db.from("affiliate_events").select("after").eq("target_id", p3.id).eq("action", "commission.skipped")).data!.length, "skip is logged");

  // 4b) Pay As You Go top-ups (D-247): each top-up earns during the customer's
  // first 12 months (the subscription limit above doesn't apply), none after.
  const { data: topPack } = await db.from("prospect_packs").select("id, price_usd").eq("active", true).order("price_usd").limit(1).single();
  const topUp = async () => {
    const t = await startCheckout(await ws(wsId), buyer, { kind: "prospect_pack", packId: topPack!.id });
    assert.ok(t.ok, "top-up checkout starts");
    const { data: tp } = await db.from("payments").select("*").eq("workspace_id", wsId).eq("kind", "prospect_pack").eq("status", "pending").order("created_at", { ascending: false }).limit(1).single();
    await callback(txn(tp!.id, tp!.provider_ref!, Math.round(Number(tp!.charge_amount) * 100)));
    return tp!.id;
  };
  await setProgram({ include_test_payments: true, commission: { type: "percent", percent_bps: 2000, fixed_cents: 0 }, hold_days: 30, eligible: { plans: ["pro", "growth"], periods: ["monthly", "annual"], packs: false }, recurring: { enabled: true, max_payments: 2 } });
  const tOff = await topUp();
  assert.equal((await commissionsOf(tOff)).length, 0, "top-ups off: no commission");
  await setProgram({ include_test_payments: true, commission: { type: "percent", percent_bps: 2000, fixed_cents: 0 }, hold_days: 30, eligible: { plans: ["pro", "growth"], periods: ["monthly", "annual"], packs: true }, recurring: { enabled: true, max_payments: 2, pack_months: 12 } });
  const t1 = await topUp();
  const ct1 = await commissionsOf(t1);
  assert.equal(ct1.length, 1, "a top-up within 12 months earns");
  assert.equal(Number(ct1[0].amount_cents), Math.round(Number(topPack!.price_usd) * 100 * 0.2), "20% of the top-up");
  assert.equal(ct1[0].payment_kind, "prospect_pack");
  const t2 = await topUp();
  assert.equal((await commissionsOf(t2)).length, 1, "every top-up in the window earns, not limited by the 2 subscription payments");
  const firstAt = c1[0].created_at;
  await db.from("affiliate_commissions").update({ created_at: new Date(Date.now() - 13 * 30 * 86_400_000).toISOString() }).eq("id", c1[0].id);
  const t3 = await topUp();
  assert.equal((await commissionsOf(t3)).length, 0, "no commission after 12 months");
  assert.ok((await db.from("affiliate_events").select("after").eq("target_id", t3).eq("action", "commission.skipped")).data!.some((e) => (e.after as { why?: string } | null)?.why === "pack_window_over"));
  await db.from("affiliate_commissions").update({ created_at: firstAt }).eq("id", c1[0].id);
  // Out of the way of the balance checks below (the ledger is never deleted).
  for (const c of [...ct1, ...(await commissionsOf(t2))]) await db.rpc("affiliate_set_commission", { p_commission: c.id, p_action: "reject", p_actor: "test", p_reason: "test cleanup" });

  // 5) Refund reverses the commission of that payment.
  await callback(txn(p1.id, p1.order, p1.cents, { is_refunded: true }));
  c1 = await commissionsOf(p1.id);
  assert.equal(c1[0].status, "reversed", "refund reverses");

  // 6) Maturation: after the waiting period the commission becomes available.
  await db.from("affiliate_commissions").update({ available_at: new Date(Date.now() - 1000).toISOString() }).eq("id", c2[0].id);
  assert.ok((await matureCommissions()) >= 1);
  assert.equal((await commissionsOf(p2.id))[0].status, "available");

  // 7) Payouts: minimum, details, one open request even when requested at once.
  assert.deepEqual(await requestPayout(a!.id, "paypal"), { ok: false, error: "details" });
  assert.equal(await savePayoutDetails(a!.id, "paypal", "payouts@example.com"), "ok");
  assert.deepEqual(await requestPayout(a!.id, "paypal"), { ok: false, error: "below_minimum" }, "$6 < $50");
  assert.equal(await savePayoutDetails(a!.id, "wise", "x@example.com"), "method", "disabled method");
  await setProgram({ include_test_payments: true, recurring: { enabled: true, max_payments: 2 }, hold_days: 30, min_payout_cents: 100 });
  const burst = await Promise.all(Array.from({ length: 6 }, () => requestPayout(a!.id, "paypal")));
  const won = burst.filter((x) => x.ok);
  assert.equal(won.length, 1, "exactly one payout from concurrent requests");
  const payoutId = (won[0] as { payoutId: string }).payoutId;
  const { data: po } = await db.from("affiliate_payouts").select("*").eq("id", payoutId).single();
  assert.equal(Number(po!.amount_cents), 600);
  assert.equal((await commissionsOf(p2.id))[0].status, "processing");
  const bal = async () => (await db.rpc("affiliate_balances", { p_affiliate: a!.id })).data![0];
  assert.equal(Number((await bal()).available_cents), 0, "the balance is taken by the request");

  // Transitions are checked in the database.
  assert.equal((await db.rpc("affiliate_set_payout", { p_payout: payoutId, p_to: "paid", p_actor: "test", p_reference: "X", p_reason: null, p_note: null })).data, "invalid");
  assert.equal((await db.rpc("affiliate_set_payout", { p_payout: payoutId, p_to: "rejected", p_actor: "test", p_reference: null, p_reason: null, p_note: null })).data, "reason_required");
  assert.equal((await db.rpc("affiliate_set_payout", { p_payout: payoutId, p_to: "approved", p_actor: "test", p_reference: null, p_reason: null, p_note: null })).data, "ok");
  assert.equal((await db.rpc("affiliate_set_payout", { p_payout: payoutId, p_to: "processing", p_actor: "test", p_reference: null, p_reason: null, p_note: null })).data, "ok");
  assert.equal((await db.rpc("affiliate_set_payout", { p_payout: payoutId, p_to: "paid", p_actor: "test", p_reference: "PP-1", p_reason: null, p_note: null })).data, "ok");
  assert.equal((await db.rpc("affiliate_set_payout", { p_payout: payoutId, p_to: "paid", p_actor: "test", p_reference: "PP-2", p_reason: null, p_note: null })).data, "invalid", "never processed twice");
  assert.equal((await commissionsOf(p2.id))[0].status, "paid");
  assert.equal(Number((await bal()).paid_cents), 600);

  // A paid commission that is reversed (e.g. a dispute) is taken back from the next payout.
  assert.equal((await db.rpc("affiliate_set_commission", { p_commission: c2[0].id, p_action: "reverse", p_actor: "test", p_reason: "Chargeback" })).data, "reversed");
  assert.equal(Number((await bal()).available_cents), -600, "clawback");
  assert.equal((await db.rpc("affiliate_set_commission", { p_commission: c2[0].id, p_action: "reverse", p_actor: "test", p_reason: "again" })).data, "already");

  // 8) The ledger can't be deleted or rewritten.
  assert.ok((await db.from("affiliate_commissions").delete().eq("id", c2[0].id)).error, "no delete");
  assert.ok((await db.from("affiliate_commissions").update({ amount_cents: 999999 }).eq("id", c2[0].id)).error, "no amount change");
  assert.ok((await db.from("affiliate_events").delete().eq("affiliate_id", a!.id)).error, "audit trail is append-only");

  // 9) Members: own rows only, no writes, no server functions.
  const affClient = createClient<Database>(url, anon, { auth: { persistSession: false } });
  const pwd = `T3st!${crypto.randomUUID()}`;
  await db.auth.admin.updateUserById(aff.id, { password: pwd });
  await db.auth.admin.updateUserById(customer.id, { password: pwd });
  assert.ok(!(await affClient.auth.signInWithPassword({ email: aff.email!, password: pwd })).error);
  assert.ok(((await affClient.from("affiliate_commissions").select("id")).data ?? []).length >= 2, "the affiliate reads own commissions");
  assert.equal(((await affClient.from("affiliate_referrals").select("id")).data ?? []).length, 0, "referrals are server-only");
  assert.ok((await affClient.rpc("affiliate_request_payout", { p_affiliate: a!.id, p_method: "paypal" })).error, "no direct RPC");
  assert.ok((await affClient.from("affiliate_commissions").insert({ affiliate_id: a!.id, kind: "adjustment", status: "available", amount_cents: 100000 })).error, "no writes");
  const custClient = createClient<Database>(url, anon, { auth: { persistSession: false } });
  assert.ok(!(await custClient.auth.signInWithPassword({ email: customer.email!, password: pwd })).error);
  assert.equal(((await custClient.from("affiliate_commissions").select("id")).data ?? []).length, 0, "others can't read them");
  assert.equal(((await custClient.from("affiliates").select("id")).data ?? []).length, 0);

  console.log("✓ affiliates: application, attribution rules, commissions from signed payments only, replay-safe, recurring limit, refund reversal, maturation, payouts (concurrency, transitions, clawback), append-only ledger, RLS");
} finally {
  await db.from("payment_providers").update({ enabled: providerBefore!.enabled, mode: providerBefore!.mode, config: providerBefore!.config }).eq("id", "paymob");
  for (const [name, value] of Object.entries(savedSecrets)) {
    if (value) await db.rpc("set_payment_secret", { p_provider: "paymob", p_name: name, p_secret: value });
    else await db.rpc("clear_payment_secret", { p_provider: "paymob", p_name: name });
  }
  for (const q of quotas ?? []) await db.from("plan_quotas").update({ price_usd: q.price_usd }).eq("plan", q.plan);
  if (fxBefore) await db.from("site_settings").upsert({ key: "yolias_fx_usd_egp", value: fxBefore.value });
  else await db.from("site_settings").delete().eq("key", "yolias_fx_usd_egp");
  // The program goes back to what it was (as a new version: history is kept).
  await db.from("affiliate_program_versions").insert({ settings: programBefore!.settings, terms_version: programBefore!.terms_version, terms_text: programBefore!.terms_text, note: "restored after test", created_by: "test" });
  // The test affiliate's ledger stays (append-only), closed and clearly named.
  if (affiliateId) await db.from("affiliates").update({ status: "disabled", decision_reason: "test data" }).eq("id", affiliateId);
  for (const id of users) {
    const { data: p } = await db.from("profiles").select("workspace_id").eq("id", id).maybeSingle();
    if (p?.workspace_id) await db.from("workspaces").delete().eq("id", p.workspace_id);
    await db.auth.admin.deleteUser(id);
  }
  server.close();
}
