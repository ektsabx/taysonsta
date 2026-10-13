// End-to-end test of the subscription journey tracking (D-212..D-215)
// against the local Supabase and the running app, with a local stand-in for
// Paymob (nothing is charged, nothing leaves this machine):
//   YOLIAS_TEST_APP_URL=http://localhost:3201 npm run test:conversions
// Scenarios (owner brief 2026-10-13 §19): 1 success, 2 open then leave,
// 3 failed payment, 4 payment still processing, 5 come back and subscribe,
// 6 repeated webhook, plus the payment switches and data protection.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createClient } from "@supabase/supabase-js";
import { startCheckout, providerFor, paymentMethods } from "@/lib/payments/index.ts";
import { hmacStringFromTransaction, signPaymob } from "@/lib/payments/paymob.ts";
import { checkoutStep, classifyCheckouts, openCheckout } from "@/lib/funnel.ts";
import { resetSwitchCache } from "@/lib/switches.ts";
import type { Database, WorkspaceRow } from "@/types/database.ts";
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
    res.writeHead(201, { "content-type": "application/json" }).end(JSON.stringify({ id: `pi_${orderSeq}`, intention_order_id: ++orderSeq, client_secret: `csk_${orderSeq}` }));
  });
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const port = (server.address() as AddressInfo).port;

const { data: providerBefore } = await db.from("payment_providers").select("*").eq("id", "paymob").single();
const saved = {
  secret_key: (await db.rpc("payment_secret", { p_provider: "paymob", p_name: "secret_key" })).data as string | null,
  hmac_secret: (await db.rpc("payment_secret", { p_provider: "paymob", p_name: "hmac_secret" })).data as string | null,
};
const { data: fxBefore } = await db.from("site_settings").select("value").eq("key", "yolias_fx_usd_egp").maybeSingle();
const { data: switchesBefore } = await db.from("site_settings").select("value").eq("key", "platform_switches").maybeSingle();
const users: string[] = [];

function txn(paymentId: string, order: string, cents: number, over: Record<string, unknown> = {}) {
  return {
    id: Math.floor(Math.random() * 1e9), pending: false, amount_cents: cents, success: true, is_auth: false, is_capture: false, is_standalone_payment: true,
    is_voided: false, is_refunded: false, is_3d_secure: true, integration_id: 222, has_parent_transaction: false, created_at: new Date().toISOString(),
    currency: "EGP", error_occured: false, owner: 1, order: { id: Number(order), merchant_order_id: paymentId },
    source_data: { pan: "2346", type: "card", sub_type: "MasterCard" }, data: { message: "Approved" }, ...over,
  };
}
const callback = (obj: Record<string, unknown>) =>
  fetch(`${app}/api/payments/paymob?hmac=${signPaymob(hmacStringFromTransaction(obj), HMAC)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "TRANSACTION", obj }) });
const ws = async (id: string) => (await db.from("workspaces").select("*").eq("id", id).single()).data as WorkspaceRow;
const session = async (id: string) => (await db.from("checkout_sessions").select("*").eq("id", id).single()).data!;
const events = async (checkoutId: string) => (await db.from("funnel_events").select("name, confirmed").eq("checkout_id", checkoutId)).data!.map((e) => e.name);
async function member(tag: string) {
  const email = `conv-${tag}-${Date.now()}@yolias.local`;
  const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true, password: "Conv-Test-2026!" });
  if (error) throw error;
  users.push(data.user.id);
  const { data: p } = await db.from("profiles").select("workspace_id").eq("id", data.user.id).single();
  return { userId: data.user.id, email, wsId: p!.workspace_id!, buyer: { userId: data.user.id, email, name: "Test Member", country: "EG" } };
}
const backdate = (id: string, minutes: number) => db.from("checkout_sessions").update({ last_activity_at: new Date(Date.now() - minutes * 60_000).toISOString() }).eq("id", id);
async function pay(m: Awaited<ReturnType<typeof member>>, cid: string, plan: "pro" | "growth" = "pro") {
  await checkoutStep(cid, "payment_started", { userId: m.userId, workspaceId: m.wsId, provider: "paymob", plan, period: "monthly" });
  const r = await startCheckout(await ws(m.wsId), m.buyer, { kind: "subscription", plan, period: "monthly" }, cid);
  assert.ok(r.ok, `checkout opens at the provider: ${JSON.stringify(r)}`);
  await checkoutStep(cid, "redirected", { provider: "paymob" });
  const { data: p } = await db.from("payments").select("*").eq("checkout_id", cid).order("created_at", { ascending: false }).limit(1).single();
  return p!;
}

try {
  await db.from("payment_providers").update({ enabled: true, mode: "test", config: { base_url: `http://127.0.0.1:${port}`, public_key: "pk_test_local", integrations: { USD: [222] } } }).eq("id", "paymob");
  await db.rpc("set_payment_secret", { p_provider: "paymob", p_name: "secret_key", p_secret: "local-secret-key" });
  await db.rpc("set_payment_secret", { p_provider: "paymob", p_name: "hmac_secret", p_secret: HMAC });
  await db.from("site_settings").upsert({ key: "yolias_fx_usd_egp", value: { fixed: 50 } });
  await db.from("site_settings").upsert({ key: "platform_switches", value: {} });
  resetSwitchCache();

  // 1) Successful subscription: recorded once, activated once, never "abandoned".
  {
    const m = await member("success");
    const cid = (await openCheckout(await ws(m.wsId), m.userId, { plan: "pro", period: "monthly", amountUsd: 50, trialOffered: false }))!;
    assert.ok(cid, "checkout session created");
    const again = await openCheckout(await ws(m.wsId), m.userId, { plan: "pro", period: "monthly", amountUsd: 50, trialOffered: false });
    assert.equal(again, cid, "a reload continues the same checkout");
    await checkoutStep(cid, "details", { provider: "paymob" });
    const p = await pay(m, cid);
    assert.equal(p.status, "pending");
    assert.equal((await session(cid)).status, "awaiting_result");
    const ok = txn(p.id, p.provider_ref!, Math.round(Number(p.charge_amount) * 100));
    assert.equal((await callback(ok)).status, 200);
    const c = await session(cid);
    assert.equal(c.status, "activated"); assert.equal(c.outcome, "paid"); assert.ok(c.paid_at && c.activated_at); assert.equal(c.abandoned_at, null);
    const names = await events(cid);
    for (const n of ["checkout_opened", "checkout_details", "payment_started", "gateway_redirected", "payment_succeeded", "subscription_activated"]) assert.ok(names.includes(n), `event ${n}`);
    assert.equal((await ws(m.wsId)).subscription_status, "test");
    await backdate(cid, 600);
    await classifyCheckouts();
    assert.equal((await session(cid)).status, "activated", "a finished checkout is never abandoned");
    const { data: acc } = await db.from("admin_accounts_v").select("segment").eq("id", m.userId).single();
    assert.equal(acc!.segment, "test", "shown with its confirmed (test-mode) subscription");

    // 6) The same webhook again: no second payment, activation or revenue.
    assert.equal((await callback(ok)).status, 200);
    assert.equal((await callback(ok)).status, 200);
    const { count: subs } = await db.from("subscription_events").select("id", { count: "exact", head: true }).eq("workspace_id", m.wsId).eq("status", "activated");
    assert.equal(subs, 1, "activated once");
    const { count: succ } = await db.from("funnel_events").select("id", { count: "exact", head: true }).eq("checkout_id", cid).eq("name", "payment_succeeded");
    assert.equal(succ, 1, "payment_succeeded counted once");
    const { count: paidRows } = await db.from("payments").select("id", { count: "exact", head: true }).eq("workspace_id", m.wsId).eq("status", "succeeded");
    assert.equal(paidRows, 1, "one payment");
    console.log("✔ 1 success · 6 repeated webhook");
  }

  // 2) Opened, then left: abandoned only after the quiet period; no identity, payment or revenue invented.
  {
    const m = await member("leave");
    const cid = (await openCheckout(await ws(m.wsId), m.userId, { plan: "growth", period: "annual", amountUsd: 960, trialOffered: true }))!;
    await classifyCheckouts();
    assert.equal((await session(cid)).status, "opened", "not abandoned after a few seconds");
    await backdate(cid, 31);
    await classifyCheckouts();
    const c = await session(cid);
    assert.equal(c.status, "abandoned"); assert.equal(c.reason_category, "left_before_details"); assert.ok(c.abandoned_at);
    assert.equal((await db.from("payments").select("id").eq("workspace_id", m.wsId)).data!.length, 0);
    assert.equal((await ws(m.wsId)).subscription_status, "none");
    assert.ok((await events(cid)).includes("checkout_abandoned"));
    const { data: acc } = await db.from("admin_accounts_v").select("segment").eq("id", m.userId).single();
    assert.equal(acc!.segment, "checkout_no_payment");
    console.log("✔ 2 open then leave");

    // 5) Comes back later and subscribes: the old checkout is recovered, its history kept, revenue once.
    const cid2 = (await openCheckout(await ws(m.wsId), m.userId, { plan: "pro", period: "monthly", amountUsd: 50, trialOffered: false }))!;
    assert.notEqual(cid2, cid, "a checkout after abandonment is a new one");
    const p = await pay(m, cid2);
    assert.equal((await callback(txn(p.id, p.provider_ref!, Math.round(Number(p.charge_amount) * 100)))).status, 200);
    const old = await session(cid);
    assert.equal(old.status, "abandoned", "the abandoned checkout keeps its history");
    assert.ok(old.recovered_at); assert.equal(old.recovered_by, cid2);
    assert.equal((await session(cid2)).status, "activated");
    const { count: revenue } = await db.from("payments").select("id", { count: "exact", head: true }).eq("workspace_id", m.wsId).eq("status", "succeeded");
    assert.equal(revenue, 1);
    const { count: open } = await db.from("checkout_sessions").select("id", { count: "exact", head: true }).eq("workspace_id", m.wsId).eq("status", "abandoned").is("recovered_at", null);
    assert.equal(open, 0, "not counted as an unrecovered opportunity");
    console.log("✔ 5 come back and subscribe");
  }

  // 3) Failed payment: confirmed failure with its reason, no plan, not "unknown abandonment".
  {
    const m = await member("fail");
    const cid = (await openCheckout(await ws(m.wsId), m.userId, { plan: "pro", period: "monthly", amountUsd: 50, trialOffered: false }))!;
    const p = await pay(m, cid);
    await callback(txn(p.id, p.provider_ref!, Math.round(Number(p.charge_amount) * 100), { success: false, data: { message: "Do not honour" } }));
    const c = await session(cid);
    assert.equal(c.status, "payment_failed"); assert.equal(c.failure_reason, "Do not honour"); assert.equal(c.reason_category, "payment_failed");
    assert.equal((await ws(m.wsId)).subscription_status, "none");
    await backdate(cid, 600);
    await classifyCheckouts();
    assert.equal((await session(cid)).status, "payment_failed", "a confirmed failure stays a failure");
    const { data: acc } = await db.from("admin_accounts_v").select("segment").eq("id", m.userId).single();
    assert.equal(acc!.segment, "payment_failed");
    console.log("✔ 3 failed payment");
  }

  // 4) Payment still processing: waits for the result window, then the late webhook settles it.
  {
    const m = await member("pending");
    const cid = (await openCheckout(await ws(m.wsId), m.userId, { plan: "pro", period: "monthly", amountUsd: 50, trialOffered: false }))!;
    const p = await pay(m, cid);
    await backdate(cid, 45);
    await classifyCheckouts();
    assert.equal((await session(cid)).status, "awaiting_result", "not abandoned while the payment can still land");
    const { data: acc } = await db.from("admin_accounts_v").select("segment").eq("id", m.userId).single();
    assert.equal(acc!.segment, "payment_pending");
    assert.equal((await callback(txn(p.id, p.provider_ref!, Math.round(Number(p.charge_amount) * 100)))).status, 200);
    assert.equal((await session(cid)).status, "activated");
    // After the window without any result it is abandoned with the gateway as the last place seen.
    const m2 = await member("pending2");
    const cid2 = (await openCheckout(await ws(m2.wsId), m2.userId, { plan: "pro", period: "monthly", amountUsd: 50, trialOffered: false }))!;
    await pay(m2, cid2);
    await backdate(cid2, 121);
    await classifyCheckouts();
    const c2 = await session(cid2);
    assert.equal(c2.status, "abandoned"); assert.equal(c2.reason_category, "left_at_gateway");
    console.log("✔ 4 payment still processing");
  }

  // Switches: Paymob off → no new Paymob checkout and the method is hidden; back on → available.
  {
    await db.from("site_settings").upsert({ key: "platform_switches", value: { payments_paymob: false } });
    resetSwitchCache();
    assert.equal(await providerFor("USD"), null, "Paymob refused while switched off");
    assert.equal((await paymentMethods()).paymob, false);
    const m = await member("switch");
    const r = await startCheckout(await ws(m.wsId), m.buyer, { kind: "subscription", plan: "pro", period: "monthly" });
    assert.ok(!r.ok && r.error === "not_connected");
    await db.from("site_settings").upsert({ key: "platform_switches", value: {} });
    resetSwitchCache();
    assert.ok(await providerFor("USD"), "available again when switched on");
    console.log("✔ switches");
  }

  // 8) Data protection: a signed-in member can't read tracking or admin data.
  {
    const m = await member("rls");
    const client = createClient<Database>(url, anon, { auth: { persistSession: false } });
    const { error: signInError } = await client.auth.signInWithPassword({ email: m.email, password: "Conv-Test-2026!" });
    assert.equal(signInError, null);
    for (const t of ["checkout_sessions", "funnel_events", "app_sessions", "account_notes", "account_messages", "account_moderation"] as const) {
      const { data } = await client.from(t).select("*").limit(5);
      assert.equal((data ?? []).length, 0, `${t} is not readable by members`);
    }
    const { error: viewError } = await client.from("admin_accounts_v").select("id").limit(1);
    assert.ok(viewError, "the admin accounts view is refused");
    const { error: rpcError } = await client.rpc("admin_funnel", { p_since: new Date(0).toISOString(), p_until: new Date().toISOString() });
    assert.ok(rpcError, "the admin funnel is refused");
    const { error: loginError } = await client.rpc("admin_login_history", { p_user: m.userId });
    assert.ok(loginError, "login history is refused");
    const { error: insertError } = await client.from("funnel_events").insert({ event_key: `x:${Date.now()}`, name: "payment_succeeded" });
    assert.ok(insertError, "members can't write events");
    // Browser events without a valid name or id are refused.
    assert.equal((await fetch(`${app}/api/funnel`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "payment_succeeded", id: crypto.randomUUID() }) })).status, 400);
    assert.equal((await fetch(`${app}/api/activity`, { method: "POST" })).status, 401, "app sessions need a signed-in member");
    console.log("✔ 8 data protection");
  }
  console.log("\nAll conversion-tracking scenarios passed.");
} finally {
  await db.from("payment_providers").update({ enabled: providerBefore!.enabled, mode: providerBefore!.mode, config: providerBefore!.config }).eq("id", "paymob");
  for (const [k, v] of Object.entries(saved)) {
    if (v) await db.rpc("set_payment_secret", { p_provider: "paymob", p_name: k, p_secret: v });
    else await db.rpc("clear_payment_secret", { p_provider: "paymob", p_name: k });
  }
  if (fxBefore) await db.from("site_settings").upsert({ key: "yolias_fx_usd_egp", value: fxBefore.value });
  else await db.from("site_settings").delete().eq("key", "yolias_fx_usd_egp");
  await db.from("site_settings").upsert({ key: "platform_switches", value: switchesBefore?.value ?? {} });
  for (const id of users) await db.auth.admin.deleteUser(id).catch(() => {});
  server.close();
}
