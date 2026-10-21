// Plans, trial (test mode), monthly limits and CSV import (owner brief
// 2026-10-12) against the LOCAL Supabase only. Nothing is charged and nothing
// leaves this machine. Polar and its webhook were removed (D-254).
//   npm run test:plans-trial
// Covers: the trial starts once with its limits; trial usage of an earlier
// month is carried into the first paid month; emails are never limited; an
// unpaid trial and an ended paid plan close access instead of granting Free;
// the CSV import runs as the member under the uploaded-contacts limit.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { setIntegrationsForTests } from "@/lib/integrations.ts";
import { settleSubscription, startPlan, startTrial } from "@/lib/billing.ts";
import { hasActivePlan } from "@/lib/plans.ts";
import type { Database, WorkspaceRow } from "@/types/database.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, svc = process.env.SUPABASE_SERVICE_ROLE_KEY!, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error("Local database only.");
const db = createClient<Database>(url, svc, { auth: { persistSession: false } });

setIntegrationsForTests({});

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
  // ── 1. Trial: starts once, trial limits ──
  const a = await newWorkspace("trial");
  const payer = { userId: a.userId, email: a.email, name: "Trial Tester" };
  assert.equal(await startTrial(await ws(a.wsId), "scale", "monthly", payer, { mode: "test", provider: "paymob" }), true);
  let w = await ws(a.wsId);
  assert.equal(w.subscription_status, "trialing"); assert.equal(w.plan, "scale"); assert.ok(w.trial_ends_at);
  assert.equal(Math.round((Date.parse(w.trial_ends_at!) - Date.parse(w.trial_started_at!)) / 86_400_000), 7, "7 days");
  assert.ok(hasActivePlan(w));
  assert.equal((await usage(a.wsId)).quota, 50, "trial prospects");
  assert.equal((await limits(a.wsId)).emails_limit, 50, "the legacy trial setting (shown nowhere, not enforced since D-247)");
  assert.ok((await limits(a.wsId)).contacts_limit >= 1_000_000_000, "uploaded contacts are unlimited (D-203)");
  assert.equal(await startTrial(w, "growth", "monthly", payer, { mode: "test", provider: "paymob" }), false, "one trial per workspace");

  // ── 2. Emails are never limited or counted (D-247: the limit trigger is gone) ──
  const { data: camp } = await db.from("campaigns").insert({ workspace_id: a.wsId, name: "t", criteria: {}, status: "completed", search_type: "companies" }).select("id").single();
  const { data: co } = await db.from("companies").insert({ workspace_id: a.wsId, campaign_id: camp!.id, name: "Acme", source: "test" }).select("id").single();
  const now = new Date().toISOString();
  const rows = Array.from({ length: 50 }, () => ({ workspace_id: a.wsId, company_id: co!.id, channel: "email" as const, opened_at: now, opened_via: "gmail" as const }));
  const ins = await db.from("outreach_messages").insert(rows);
  assert.equal(ins.error, null, "50 emails");
  const over = await db.from("outreach_messages").insert({ workspace_id: a.wsId, company_id: co!.id, channel: "email", opened_at: now, opened_via: "gmail" });
  assert.equal(over.error, null, "the 51st email is sent too: no email limit");
  const draft = await db.from("outreach_messages").insert({ workspace_id: a.wsId, company_id: co!.id, channel: "email" });
  assert.equal(draft.error, null, "a draft that isn't opened doesn't count");
  const { data: one } = await db.from("outreach_messages").select("id").eq("workspace_id", a.wsId).not("opened_at", "is", null).limit(1).single();
  assert.equal((await db.from("outreach_messages").update({ opened_at: new Date().toISOString() }).eq("id", one!.id)).error, null, "re-opening the same email in the same month doesn't count again");
  assert.equal((await db.from("outreach_messages").insert({ workspace_id: a.wsId, company_id: co!.id, channel: "whatsapp", opened_at: now, opened_via: "whatsapp" })).error, null, "other channels aren't emails");

  // ── 3. Trial spanning a month: earlier use is carried into the first paid month ──
  const b = await newWorkspace("carry");
  const bp = { userId: b.userId, email: b.email, name: "Carry Tester" };
  await startTrial(await ws(b.wsId), "growth", "monthly", bp, { mode: "test", provider: "paymob" });
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
  assert.ok((await limits(b.wsId)).emails_limit >= 1_000_000, "emails aren't limited (D-247)");
  const ev = (await db.from("subscription_events").select("status").eq("workspace_id", b.wsId)).data!.map((e) => e.status);
  assert.deepEqual(ev.sort(), ["trial_converted", "trial_started"]);

  // ── 4. A trial that ends without payment closes access (no Free) ──
  const c = await newWorkspace("expired");
  await startTrial(await ws(c.wsId), "pro", "monthly", { userId: c.userId, email: c.email, name: null }, { mode: "test", provider: "paymob" });
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
  await startTrial(await ws(e.wsId), "pro", "monthly", { userId: e.userId, email: e.email, name: null }, { mode: "test", provider: "paymob" });
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

  console.log("✓ plans, trial, limits, import: all checks passed (Polar removed, D-254)");
} finally {
  for (const id of users) {
    const { data: prof } = await db.from("profiles").select("workspace_id").eq("id", id).maybeSingle();
    if (prof?.workspace_id) await db.from("workspaces").delete().eq("id", prof.workspace_id);
    await db.auth.admin.deleteUser(id);
  }
  setIntegrationsForTests(null);
}
