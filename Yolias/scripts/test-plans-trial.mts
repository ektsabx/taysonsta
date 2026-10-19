// Plans, free trial, monthly limits, CSV import and the Polar webhook (owner
// brief 2026-10-12) against the LOCAL Supabase only. Nothing is charged and
// nothing leaves this machine (Polar is never called; webhooks are signed
// here with a throwaway secret):
//   npm run test:plans-trial
// Covers: the trial starts once with 50/50/50 limits; trial usage of an
// earlier month is carried into the first paid month; the email limit trigger
// refuses the email over the limit (and only first opens count); an unpaid
// trial and an ended paid plan close access instead of granting Free; the CSV
// import runs as the member under the uploaded-contacts limit; Polar
// webhooks: bad signature 403, trial start, first charge (plan, invoice,
// affiliate commission), renewal, cancel and end, each applied once; the six
// plan products are created in Polar by Yolias (a local stand-in for Polar's
// API), reused without calls, and repriced when plan_quotas changes.
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { setIntegrationsForTests } from "@/lib/integrations.ts";
import { settleSubscription, startPlan, startTrial } from "@/lib/billing.ts";
import { hasActivePlan } from "@/lib/plans.ts";
import { createServer } from "node:http";
import { loadPolar, planForProduct, productFor, POLAR_PRODUCTS_KEY } from "@/lib/payments/polar.ts";
import { ensurePolarProducts } from "@/lib/payments/polar-products.ts";
import type { Database, WorkspaceRow } from "@/types/database.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, svc = process.env.SUPABASE_SERVICE_ROLE_KEY!, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error("Local database only.");
const db = createClient<Database>(url, svc, { auth: { persistSession: false } });

const WH_SECRET = `whsec_${randomBytes(24).toString("base64")}`;
const PRODUCT = "11111111-2222-4333-8444-555555555555";
setIntegrationsForTests({ polar: { access_token: "polar_oat_local_test", webhook_secret: WH_SECRET } }, { polar: { server: "sandbox", product_growth_annual: PRODUCT } });

const users: string[] = [];
const ws = async (id: string) => (await db.from("workspaces").select("*").eq("id", id).single()).data as WorkspaceRow;
async function newWorkspace(tag: string, password?: string) {
  const email = `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@yolias.local`;
  const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true, ...(password ? { password } : {}) });
  if (error) throw error;
  users.push(data.user.id);
  const { data: prof } = await db.from("profiles").select("workspace_id").eq("id", data.user.id).single();
  return { userId: data.user.id, email, wsId: prof!.workspace_id! };
}
const usage = async (id: string) => (await db.rpc("usage_summary", { p_ws: id })).data![0];
const limits = async (id: string) => (await db.rpc("limits_summary", { p_ws: id })).data![0];
const monthStart = () => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1)); };
const prevMonth = () => { const m = monthStart(); return new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() - 1, 1)); };

try {
  // ── Polar settings come from the Integrations hub (here: test values) ──
  const polar = await loadPolar();
  assert.ok(polar, "Polar is configured from the hub");
  assert.equal(polar.environment, "sandbox");
  assert.equal(productFor(polar, "growth", "annual"), PRODUCT);
  assert.deepEqual(planForProduct(polar, PRODUCT), { plan: "growth", period: "annual" });
  assert.equal(planForProduct(polar, "99999999-2222-4333-8444-555555555555"), null, "unknown products are refused");

  // ── 1. Trial: starts once, trial limits ──
  const a = await newWorkspace("trial");
  const payer = { userId: a.userId, email: a.email, name: "Trial Tester" };
  assert.equal(await startTrial(await ws(a.wsId), "scale", "monthly", payer, { mode: "test", provider: "polar" }), true);
  let w = await ws(a.wsId);
  assert.equal(w.subscription_status, "trialing"); assert.equal(w.plan, "scale"); assert.ok(w.trial_ends_at);
  assert.equal(Math.round((Date.parse(w.trial_ends_at!) - Date.parse(w.trial_started_at!)) / 86_400_000), 7, "7 days");
  assert.ok(hasActivePlan(w));
  assert.equal((await usage(a.wsId)).quota, 50, "trial prospects");
  assert.equal((await limits(a.wsId)).emails_limit, 50);
  assert.ok((await limits(a.wsId)).contacts_limit >= 1_000_000_000, "uploaded contacts are unlimited (D-203)");
  assert.equal(await startTrial(w, "growth", "monthly", payer, { mode: "test", provider: "polar" }), false, "one trial per workspace");

  // ── 2. Email limit trigger (first opens only) ──
  const { data: camp } = await db.from("campaigns").insert({ workspace_id: a.wsId, name: "t", criteria: {}, status: "completed", search_type: "companies" }).select("id").single();
  const { data: co } = await db.from("companies").insert({ workspace_id: a.wsId, campaign_id: camp!.id, name: "Acme", source: "test" }).select("id").single();
  const now = new Date().toISOString();
  const rows = Array.from({ length: 50 }, () => ({ workspace_id: a.wsId, company_id: co!.id, channel: "email" as const, opened_at: now, opened_via: "gmail" as const }));
  const ins = await db.from("outreach_messages").insert(rows);
  assert.equal(ins.error, null, "50 emails fit the trial");
  const over = await db.from("outreach_messages").insert({ workspace_id: a.wsId, company_id: co!.id, channel: "email", opened_at: now, opened_via: "gmail" });
  assert.match(over.error?.message ?? "", /email_limit_reached/, "the 51st email is refused");
  const draft = await db.from("outreach_messages").insert({ workspace_id: a.wsId, company_id: co!.id, channel: "email" });
  assert.equal(draft.error, null, "a draft that isn't opened doesn't count");
  const { data: one } = await db.from("outreach_messages").select("id").eq("workspace_id", a.wsId).not("opened_at", "is", null).limit(1).single();
  assert.equal((await db.from("outreach_messages").update({ opened_at: new Date().toISOString() }).eq("id", one!.id)).error, null, "re-opening the same email in the same month doesn't count again");
  assert.equal((await db.from("outreach_messages").insert({ workspace_id: a.wsId, company_id: co!.id, channel: "whatsapp", opened_at: now, opened_via: "whatsapp" })).error, null, "other channels aren't emails");

  // ── 3. Trial spanning a month: earlier use is carried into the first paid month ──
  const b = await newWorkspace("carry");
  const bp = { userId: b.userId, email: b.email, name: "Carry Tester" };
  await startTrial(await ws(b.wsId), "growth", "monthly", bp, { mode: "test", provider: "polar" });
  const started = new Date(prevMonth().getTime() + 25 * 86_400_000).toISOString();
  await db.from("workspaces").update({ trial_started_at: started }).eq("id", b.wsId);
  const { data: bc } = await db.from("campaigns").insert({ workspace_id: b.wsId, name: "c", criteria: {}, status: "completed", search_type: "companies" }).select("id").single();
  await db.from("usage_ledger").insert({ workspace_id: b.wsId, campaign_id: bc!.id, kind: "consume", prospects: 30, period_start: prevMonth().toISOString().slice(0, 10), reason: "prospect delivered", created_at: new Date(Date.parse(started) + 3600_000).toISOString() });
  assert.equal((await usage(b.wsId)).quota, 20, "a new month doesn't refill the trial: 50 − 30");
  const charge = { mode: "test" as const, amount: 100, currency: "USD" as const };
  assert.notEqual(await startPlan(await ws(b.wsId), "growth", "monthly", bp, charge), false);
  w = await ws(b.wsId);
  assert.equal(w.subscription_status, "test");
  assert.deepEqual(w.trial_carry, { period: monthStart().toISOString().slice(0, 10), prospects: 30, emails: 0, contacts: 0 });
  assert.equal((await usage(b.wsId)).quota, 1970, "2,000 − the 30 the trial used");
  assert.equal((await limits(b.wsId)).emails_limit, 2000);
  const ev = (await db.from("subscription_events").select("status").eq("workspace_id", b.wsId)).data!.map((e) => e.status);
  assert.deepEqual(ev.sort(), ["trial_converted", "trial_started"]);

  // ── 4. A trial that ends without payment closes access (no Free) ──
  const c = await newWorkspace("expired");
  await startTrial(await ws(c.wsId), "pro", "monthly", { userId: c.userId, email: c.email, name: null }, { mode: "test", provider: "polar" });
  await db.from("workspaces").update({ trial_ends_at: new Date(Date.now() - 2 * 86_400_000).toISOString() }).eq("id", c.wsId);
  w = await settleSubscription(await ws(c.wsId));
  assert.equal(w.subscription_status, "canceled"); assert.equal(w.plan, "pro");
  assert.equal(hasActivePlan(w), false, "no access after an unpaid trial");
  assert.equal((await ws(c.wsId)).subscription_status, "canceled");

  // ── 5. An ended paid plan closes access too (no Free) ──
  const d = await newWorkspace("ended");
  await startPlan(await ws(d.wsId), "pro", "monthly", { userId: d.userId, email: d.email, name: null }, { mode: "test", amount: 50, currency: "USD" });
  await db.from("workspaces").update({ cancel_at_period_end: true, current_period_end: new Date(Date.now() - 86_400_000).toISOString() }).eq("id", d.wsId);
  w = await settleSubscription(await ws(d.wsId));
  assert.equal(w.subscription_status, "canceled"); assert.equal(w.plan, "pro", "the plan isn't swapped for Free");

  // ── 6. CSV import as the member, under the uploaded-contacts limit ──
  const e = await newWorkspace("import", "Import-Test-2026!");
  await startTrial(await ws(e.wsId), "pro", "monthly", { userId: e.userId, email: e.email, name: null }, { mode: "test", provider: "polar" });
  const member = createClient<Database>(url, anon, { auth: { persistSession: false } });
  const signIn = await member.auth.signInWithPassword({ email: e.email, password: "Import-Test-2026!" });
  assert.equal(signIn.error, null);
  const row = (i: number) => ({ kind: "person", name: `Person ${i}`, title: "CEO", company: `Co ${i % 3}`, domain: `co${i % 3}.example`, email: `p${i}@co${i % 3}.example` });
  // Uploaded contacts are unlimited now (D-203): 51 rows fit even in a trial.
  let r = (await member.rpc("import_contacts", { p_ws: e.wsId, p_name: "many.csv", p_rows: Array.from({ length: 51 }, (_, i) => row(i + 100)) })).data as { ok: boolean; error?: string; available?: number };
  assert.equal(r.ok, true, "51 rows fit: no contacts limit");
  await db.from("prospects").delete().eq("workspace_id", e.wsId);
  await db.from("campaigns").delete().eq("workspace_id", e.wsId).eq("origin", "import");
  r = (await member.rpc("import_contacts", { p_ws: e.wsId, p_name: "people.csv", p_rows: Array.from({ length: 6 }, (_, i) => row(i)) })).data as { ok: boolean };
  assert.equal(r.ok, true);
  assert.equal((await limits(e.wsId)).contacts_used, 6);
  const { data: imported } = await db.from("prospects").select("company_id, saved_at, revealed_at, source").eq("workspace_id", e.wsId);
  assert.equal(imported!.length, 6);
  assert.ok(imported!.every((p) => p.saved_at && p.revealed_at && p.source === "csv_import" && p.company_id), "in Prospects, contacts shown, linked to a company");
  assert.equal(new Set(imported!.map((p) => p.company_id)).size, 3, "one company per domain");
  assert.equal((await usage(e.wsId)).consumed, 0, "imports never use prospects");
  const other = (await member.rpc("import_contacts", { p_ws: a.wsId, p_name: "x.csv", p_rows: [row(1)] })).data as { ok: boolean; error: string };
  assert.deepEqual([other.ok, other.error], [false, "forbidden"], "another workspace is refused");
  const { data: listed } = await member.from("prospect_items").select("key").eq("workspace_id", a.wsId);
  assert.equal(listed!.length, 0, "the unified view respects RLS");

  // ── 7. Polar webhook: verified, stored once, applied once ──
  const { POST } = await import("@/app/api/webhook/polar/route.ts");
  const key = Buffer.from(WH_SECRET.slice(6), "base64");
  const send = (payload: object, id: string, sign = true) => {
    const body = JSON.stringify(payload);
    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = createHmac("sha256", sign ? key : randomBytes(24)).update(`${id}.${ts}.${body}`).digest("base64");
    return POST(new NextRequest("http://localhost/api/webhook/polar", { method: "POST", body, headers: { "content-type": "application/json", "webhook-id": id, "webhook-timestamp": ts, "webhook-signature": `v1,${sig}` } }));
  };
  const runId = `msg_test_${Date.now()}`;
  let seq = 0;
  const nextId = () => `${runId}_${++seq}`;

  // An approved affiliate who referred this customer (commissions count test payments here only).
  const p = await newWorkspace("polar");
  const affUser = await newWorkspace("aff");
  const { data: programBefore } = await db.from("affiliate_program_versions").select("*").order("id", { ascending: false }).limit(1).single();
  await db.from("affiliate_program_versions").insert({ settings: { ...(programBefore!.settings as object), enabled: true, include_test_payments: true }, terms_version: programBefore!.terms_version, terms_text: programBefore!.terms_text, note: "test", created_by: "test" });
  const { data: aff } = await db.from("affiliates").insert({ user_id: affUser.userId, email: affUser.email, code: `t${Date.now().toString(36)}`.slice(0, 16), terms_version: programBefore!.terms_version, terms_accepted_at: new Date().toISOString(), status: "approved" }).select("id").single();
  await db.from("affiliate_referrals").insert({ affiliate_id: aff!.id, referred_user_id: p.userId, workspace_id: p.wsId, model: "first_touch" });

  const sub = (over: object = {}) => ({ id: "sub_1", status: "trialing", product_id: PRODUCT, current_period_start: new Date().toISOString(), current_period_end: new Date(Date.now() + 7 * 86_400_000).toISOString(), trial_start: new Date().toISOString(), trial_end: new Date(Date.now() + 7 * 86_400_000).toISOString(), cancel_at_period_end: false, ...over });
  const order = (id: string, total: number, reason: string, over: object = {}) => ({ type: "order.paid", timestamp: new Date().toISOString(), data: { id, created_at: new Date().toISOString(), total_amount: total, currency: "usd", billing_reason: reason, product_id: PRODUCT, customer_id: "cus_1", customer: { id: "cus_1", external_id: p.wsId }, subscription: sub(over), metadata: { workspace_id: p.wsId, user_id: p.userId } } });

  // Bad signature changes nothing.
  assert.equal((await send(order("ord_0", 0, "subscription_create"), nextId(), false)).status, 403);
  assert.equal((await ws(p.wsId)).subscription_status, "none");

  // $0 first order → the trial starts, dates from Polar.
  const startId = nextId();
  assert.equal((await send(order("ord_0", 0, "subscription_create"), startId)).status, 200);
  let pw = await ws(p.wsId);
  assert.equal(pw.subscription_status, "trialing"); assert.equal(pw.plan, "growth"); assert.equal(pw.billing_period, "annual");
  assert.equal(pw.billing_provider, "polar"); assert.equal(pw.polar_subscription_id, "sub_1"); assert.equal(pw.polar_customer_id, "cus_1");
  const retry = await send(order("ord_0", 0, "subscription_create"), startId);
  assert.deepEqual(await retry.json(), { received: true, duplicate: true }, "a retry with the same webhook-id is skipped");
  // customer.state_changed for the same trial: nothing new.
  const state = (subs: object[]) => ({ type: "customer.state_changed", timestamp: new Date().toISOString(), data: { id: "cus_1", external_id: p.wsId, active_subscriptions: subs } });
  await send(state([sub()]), nextId());
  assert.equal((await db.from("subscription_events").select("id").eq("workspace_id", p.wsId).eq("status", "trial_started")).data!.length, 1, "one trial");

  // First charge after the trial ($1,200 annual) → the plan starts, invoice, commission.
  const periodEnd = new Date(Date.now() + 365 * 86_400_000).toISOString();
  const firstId = nextId();
  assert.equal((await send(order("ord_1", 120000, "subscription_cycle", { status: "active", current_period_end: periodEnd }), firstId)).status, 200);
  pw = await ws(p.wsId);
  assert.equal(pw.subscription_status, "test", "sandbox payments are test payments");
  assert.equal(new Date(pw.current_period_end!).getTime(), new Date(periodEnd).getTime(), "period from Polar");
  const { data: pays } = await db.from("payments").select("*").eq("workspace_id", p.wsId);
  assert.equal(pays!.length, 1); assert.equal(pays![0].provider, "polar"); assert.equal(Number(pays![0].amount), 1200); assert.ok(pays![0].fulfilled_at); assert.ok(pays![0].invoice_id);
  assert.ok((await db.from("subscription_events").select("status").eq("workspace_id", p.wsId)).data!.some((e) => e.status === "trial_converted"));
  const { data: comm } = await db.from("affiliate_commissions").select("amount_cents, payment_id").eq("affiliate_id", aff!.id);
  assert.equal(comm!.length, 1, "the affiliate commission is created from the Polar payment");
  // The same order again (another delivery id): applied once.
  await send(order("ord_1", 120000, "subscription_cycle", { status: "active", current_period_end: periodEnd }), nextId());
  assert.equal((await db.from("payments").select("id").eq("workspace_id", p.wsId)).data!.length, 1, "one payment per Polar order");
  assert.equal((await db.from("affiliate_commissions").select("id").eq("affiliate_id", aff!.id)).data!.length, 1, "one commission");

  // Renewal next year → new period and invoice.
  const nextEnd = new Date(Date.now() + 730 * 86_400_000).toISOString();
  await send(order("ord_2", 120000, "subscription_cycle", { status: "active", current_period_end: nextEnd }), nextId());
  pw = await ws(p.wsId);
  assert.equal(new Date(pw.current_period_end!).getTime(), new Date(nextEnd).getTime());
  assert.equal((await db.from("invoices").select("id").eq("workspace_id", p.wsId).eq("status", "paid")).data!.length, 2);
  assert.ok((await db.from("subscription_events").select("status").eq("workspace_id", p.wsId)).data!.some((e) => e.status === "renewed"));

  // Canceled in Polar's portal → mirrored; then the subscription ends → access ends.
  await send(state([sub({ status: "active", cancel_at_period_end: true, current_period_end: nextEnd })]), nextId());
  assert.equal((await ws(p.wsId)).cancel_at_period_end, true);
  await send(state([]), nextId());
  pw = await ws(p.wsId);
  assert.equal(pw.subscription_status, "canceled"); assert.equal(hasActivePlan(pw), false);

  // Unknown product / unknown customer: stored, not applied.
  const strayId = nextId();
  await send({ type: "order.paid", timestamp: new Date().toISOString(), data: { id: "ord_x", total_amount: 5000, currency: "usd", billing_reason: "subscription_create", product_id: "99999999-2222-4333-8444-555555555555", customer: { external_id: p.wsId } } }, strayId);
  assert.equal((await db.from("billing_webhook_events").select("status").eq("webhook_id", strayId).single()).data!.status, "ignored");
  const unknown = await send({ type: "not.a.real.event", data: {} }, nextId());
  assert.deepEqual(await unknown.json(), { received: true, ignored: true });

  await db.from("affiliate_program_versions").insert({ settings: programBefore!.settings, terms_version: programBefore!.terms_version, terms_text: programBefore!.terms_text, note: "restored after test", created_by: "test" });
  await db.from("affiliates").update({ status: "disabled", decision_reason: "test data" }).eq("id", aff!.id);
  await db.from("billing_webhook_events").delete().like("webhook_id", `${runId}%`);

  // ── Polar products: created by Yolias, reused, repriced (local stand-in) ──
  const { data: savedMap } = await db.from("site_settings").select("value").eq("key", POLAR_PRODUCTS_KEY).maybeSingle();
  await db.from("site_settings").delete().eq("key", POLAR_PRODUCTS_KEY);
  type FakeProduct = { id: string; name: string; metadata: Record<string, string>; recurring_interval: string; is_archived: boolean; prices: { amount_type: string; price_amount: number; is_archived: boolean }[] };
  const fake: FakeProduct[] = [];
  const calls: string[] = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      calls.push(`${req.method} ${req.url!.split("?")[0]}`);
      assert.equal(req.headers.authorization, "Bearer polar_oat_local_test");
      const send = (v: unknown) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(v)); };
      const id = req.url!.match(/^\/v1\/products\/([0-9a-f-]{36})/)?.[1];
      if (req.method === "GET") return send({ items: fake, pagination: { total_count: fake.length, max_page: 1 } });
      const b = JSON.parse(body);
      if (req.method === "POST") {
        const p: FakeProduct = { id: crypto.randomUUID(), name: b.name, metadata: b.metadata, recurring_interval: b.recurring_interval, is_archived: false, prices: b.prices.map((x: { price_amount: number }) => ({ amount_type: "fixed", price_amount: x.price_amount, is_archived: false })) };
        fake.push(p);
        return send(p);
      }
      const p = fake.find((x) => x.id === id)!;
      p.prices = [...p.prices.map((x) => ({ ...x, is_archived: true })), ...b.prices.map((x: { price_amount: number }) => ({ amount_type: "fixed", price_amount: x.price_amount, is_archived: false }))];
      send(p);
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    const first = await ensurePolarProducts({ ...polar, baseUrl });
    assert.ok(first.ok); assert.equal(first.ok && first.created, 6, "six products created");
    assert.deepEqual(fake.map((p) => `${p.metadata.yolias_plan}_${p.metadata.yolias_period}:${p.recurring_interval}`).sort(),
      ["growth_annual:year", "growth_monthly:month", "pro_annual:year", "pro_monthly:month", "scale_annual:year", "scale_monthly:month"]);
    const scaleMonthly = fake.find((p) => p.metadata.yolias_plan === "scale" && p.metadata.yolias_period === "monthly")!;
    const scaleAnnual = fake.find((p) => p.metadata.yolias_plan === "scale" && p.metadata.yolias_period === "annual")!;
    assert.equal(scaleMonthly.prices[0].price_amount, 20000, "$200 a month");
    assert.equal(scaleAnnual.prices[0].price_amount, 192000, "annual = 12 × ($200 − 20%)");
    // Ids are stored; loadPolar finds them without Polar.
    const loaded = (await loadPolar())!;
    assert.equal(productFor(loaded, "scale", "monthly"), scaleMonthly.id);
    assert.deepEqual(planForProduct(loaded, scaleAnnual.id), { plan: "scale", period: "annual" });
    // Nothing changed: no call at all.
    calls.length = 0;
    const again = await ensurePolarProducts({ ...loaded, baseUrl });
    assert.ok(again.ok && again.created === 0 && again.repriced === 0); assert.equal(calls.length, 0, "no Polar call when nothing changed");
    // A price change in Admin reprices only that plan; the product id stays.
    await db.from("plan_quotas").update({ price_usd: 210 }).eq("plan", "scale");
    const repriced = await ensurePolarProducts({ ...loaded, baseUrl });
    await db.from("plan_quotas").update({ price_usd: 200 }).eq("plan", "scale");
    assert.ok(repriced.ok && repriced.created === 0 && repriced.repriced === 2, "monthly and annual scale repriced");
    assert.equal(productFor(repriced.cfg, "scale", "monthly"), scaleMonthly.id, "same product");
    assert.deepEqual(scaleMonthly.prices.map((x) => [x.price_amount, x.is_archived]), [[20000, true], [21000, false]], "old price archived, new price active");
    // A lost map finds the existing products again instead of duplicating them.
    await db.from("site_settings").delete().eq("key", POLAR_PRODUCTS_KEY);
    const found = await ensurePolarProducts({ ...loaded, baseUrl });
    assert.ok(found.ok && found.created === 0); assert.equal(fake.length, 6, "no duplicates");
    // Polar down: checkout keeps the stored ids (none here) and reports it.
    const down = await ensurePolarProducts({ ...loaded, products: {}, baseUrl: "http://127.0.0.1:9" });
    assert.equal(down.ok, true, "stored map still current, Polar not needed");
  } finally {
    server.close();
    await db.from("site_settings").delete().eq("key", POLAR_PRODUCTS_KEY);
    if (savedMap) await db.from("site_settings").insert({ key: POLAR_PRODUCTS_KEY, value: savedMap.value });
  }

  console.log("✓ plans, trial, limits, import, Polar webhook and products: all checks passed");
} finally {
  for (const id of users) {
    const { data: prof } = await db.from("profiles").select("workspace_id").eq("id", id).maybeSingle();
    if (prof?.workspace_id) await db.from("workspaces").delete().eq("id", prof.workspace_id);
    await db.auth.admin.deleteUser(id);
  }
  setIntegrationsForTests(null);
}
