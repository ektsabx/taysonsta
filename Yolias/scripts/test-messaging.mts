// Messaging & Automation end to end (D-243) against the local Supabase. No
// real email: Resend is a local capture server. Every flow made here runs in
// test mode for this test's own addresses only, so other local users are
// never touched. Covers: registry events from triggers, entry rules, once-only
// entry, waits, sending, stop on subscription (goal) with queued mail
// canceled, checkout recovery with a branch and stop on payment, payment
// failed with its limit, unsubscribe (lifecycle stops, transactional still
// goes), test mode, frequency cap, in-app notices, campaigns with segments and
// dedupe, Resend webhooks (signature, duplicate, bounce → suppression),
// trial-ending sweep, template versions kept for scheduled mail.
//   npm run test:messaging
import assert from "node:assert/strict";
import http from "node:http";
import { createHmac, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

(await import("@/lib/integrations.ts")).setIntegrationsForTests({ resend_webhook: { webhook_secret: `whsec_${Buffer.from("test-secret-123456").toString("base64")}` } });

const captured: { to: string[]; subject: string; headers?: Record<string, string>; text?: string }[] = [];
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    captured.push(JSON.parse(body));
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ id: `msg_${captured.length}_${Date.now()}` }));
  });
}).listen(4931);
process.env.RESEND_API_URL = "http://127.0.0.1:4931";
process.env.RESEND_API_KEY = "test";
process.env.EMAIL_DOMAIN = "yolias.test";
delete process.env.EMAIL_FROM;

const engine = await import("@/lib/messaging/engine.ts");
const { deliverEmail } = await import("@/lib/email/notify.ts");
const { applyResendEvent, verifySvix } = await import("@/lib/messaging/webhook.ts");
const { unsubscribeByToken } = await import("@/lib/messaging/unsubscribe.ts");
const { flowErrors } = await import("@/lib/messaging/flow.ts");
const { templateErrors } = await import("@/lib/messaging/render.ts");

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
assert.match(process.env.NEXT_PUBLIC_SUPABASE_URL!, /127\.0\.0\.1|localhost/, "local database only");

const stamp = Date.now();
const made: { users: string[]; flows: string[]; templates: string[]; segments: string[]; campaigns: string[] } = { users: [], flows: [], templates: [], segments: [], campaigns: [] };
const { data: oldSettings } = await db.from("site_settings").select("value").eq("key", "messaging").maybeSingle();
const setSettings = (patch: Record<string, unknown>) => db.from("site_settings").upsert({ key: "messaging", value: { ...(oldSettings?.value as object), ...patch } });

async function user(tag: string) {
  const email = `msg-${tag}-${stamp}@yolias.test`;
  const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  const id = data.user!.id;
  made.users.push(id);
  await db.from("profiles").update({ full_name: `Test ${tag}` }).eq("id", id);
  const ws = (await db.from("profiles").select("workspace_id").eq("id", id).single()).data!.workspace_id!;
  return { id, email, ws };
}
async function template(name: string, cls: "lifecycle" | "transactional" | "marketing", subject: string) {
  const { data } = await db.from("msg_templates").insert({ name: `${name} ${stamp}`, category: cls, subject, html: `<p>Hi {{first_name}}, ${name}.</p><p><a href="{{checkout_url}}">Go</a></p>` }).select("id, version").single();
  await db.from("msg_template_versions").insert({ template_id: data!.id, version: 1, subject, html: `<p>${name}</p>` });
  made.templates.push(data!.id);
  return data!.id as string;
}
async function flow(f: Record<string, unknown>) {
  const row: Record<string, unknown> = { kind: "sequence", status: "active", category: "lifecycle", test_mode: true, version: 1, exit_events: [], entry_rules: [], exit_rules: [], ...f, name: `${f.name} ${stamp}` };
  const { data, error } = await db.from("msg_flows").insert(row as never).select("*").single();
  if (error) throw error;
  await db.from("msg_flow_versions").insert({ flow_id: data.id, version: 1, definition: { trigger_event: row.trigger_event, entry_rules: row.entry_rules, steps: row.steps, exit_events: row.exit_events, exit_rules: row.exit_rules, goal_event: row.goal_event ?? null, exit_on_goal: true, category: row.category, kind: row.kind } });
  made.flows.push(data.id);
  return data.id as string;
}
const enrollments = async (flowId: string, userId: string) => (await db.from("msg_enrollments").select("*").eq("flow_id", flowId).eq("user_id", userId)).data ?? [];
const logs = async (flowId: string, userId: string) => (await db.from("email_log").select("*").eq("flow_id", flowId).eq("user_id", userId).order("id")).data ?? [];
async function cycle(times = 1) {
  for (let i = 0; i < times; i++) {
    await engine.ingestEvents(db as never);
    await engine.runDue(db as never);
  }
}
async function wakeUp(flowId: string) {
  await db.from("msg_enrollments").update({ next_run_at: new Date(Date.now() - 1000).toISOString(), locked_until: null }).eq("flow_id", flowId).eq("status", "active");
}
async function deliver(flowId: string) {
  const { data } = await db.from("email_log").select("id").eq("flow_id", flowId).eq("status", "queued");
  for (const r of data ?? []) await deliverEmail(r.id);
}

try {
  await setSettings({ enabled: true, frequency_hours: 0, daily_cap: 2000 });
  // Start the event cursor now: older local events never start these flows.
  await db.from("worker_state").delete().eq("key", "messaging.cursor");
  await engine.ingestEvents(db as never);

  // ── Static checks ──
  assert.deepEqual(templateErrors({ subject: "Hi {{first_name}}", html: "<p>Ok <a href=\"{{pricing_url}}\">x</a></p>" }), []);
  assert.ok(templateErrors({ subject: "Hi {{nickname}}", html: "<script>x</script>" }).length >= 2, "unknown variable and script rejected");
  assert.ok(flowErrors({ kind: "sequence", trigger_event: "user_registered", steps: [{ id: "b", type: "branch", rules: [{ field: "has_plan", op: "is", value: false }], yes: "a", no: "end" }, { id: "a", type: "wait", amount: 1, unit: "days" }], entry_rules: [], exit_rules: [], exit_events: [], goal_event: null, reentry: "never", reentry_days: null, send_window: null }, new Set()).some((e) => e.includes("إرسال")), "a flow without a send step is rejected");
  console.log("✓ templates and flows are validated");

  // ── Welcome sequence: registration → day 0 email, wait, day 1; subscription stops it ──
  const t0 = await template("welcome 0", "lifecycle", "Welcome {{first_name}}");
  const t1 = await template("welcome 1", "lifecycle", "Day one");
  const a = await user("a");
  const b = await user("b"); // not a test address: never enters
  const welcome = await flow({
    name: "Welcome", trigger_event: "user_registered", entry_rules: [{ field: "has_plan", op: "is", value: false }], test_emails: [a.email],
    steps: [{ id: "d0", type: "email", template_id: t0 }, { id: "w1", type: "wait", amount: 1, unit: "days" }, { id: "d1", type: "email", template_id: t1 }],
    exit_events: ["subscription_activated"], goal_event: "subscription_activated",
  });
  // The users were created before the flow: their user_registered events are
  // re-read by moving the cursor back (as a redelivered event would be).
  const { data: firstEv } = await db.from("funnel_events").select("id").eq("event_key", `user_registered:${a.id}`).single();
  await db.from("worker_state").upsert({ key: "messaging.cursor", value: { id: firstEv!.id - 1 } });
  await cycle();
  assert.equal((await enrollments(welcome, a.id)).length, 1, "test address entered");
  assert.equal((await enrollments(welcome, b.id)).length, 0, "test mode keeps other users out");
  await cycle();
  let mail = await logs(welcome, a.id);
  assert.equal(mail.length, 1);
  assert.equal(mail[0].subject, "Welcome Test", "variables filled");
  await deliver(welcome);
  mail = await logs(welcome, a.id);
  assert.equal(mail[0].status, "sent");
  const sentA = captured.find((c) => c.to[0] === a.email)!;
  assert.ok(sentA.headers?.["List-Unsubscribe"]?.includes("/api/unsubscribe?t="), "lifecycle mail carries one-click unsubscribe");
  // The same event read again never enrolls twice.
  await db.from("worker_state").upsert({ key: "messaging.cursor", value: { id: firstEv!.id - 1 } });
  await cycle();
  assert.equal((await enrollments(welcome, a.id)).length, 1, "once-only entry");
  // The wait holds day 1 until it's due.
  await cycle();
  assert.equal((await logs(welcome, a.id)).length, 1, "waiting");
  console.log("✓ welcome: event → enrolled once → email sent → waiting");

  // Subscribing during the wait: the run ends (goal), nothing else is sent.
  await wakeUp(welcome);
  await cycle(); // queues day 1
  assert.equal((await logs(welcome, a.id)).length, 2, "day 1 queued");
  await db.from("subscription_events").insert({ workspace_id: a.ws, plan: "pro", status: "activated", amount: 20, currency: "USD", mode: "test", created_by: a.id, billing_period: "monthly" });
  await db.from("workspaces").update({ plan: "pro", subscription_status: "active" }).eq("id", a.ws);
  await cycle();
  const [ea] = await enrollments(welcome, a.id);
  assert.ok(ea.goal_at, "the subscription counts as the flow's goal");
  mail = await logs(welcome, a.id);
  assert.equal(mail[1].status, "canceled", "queued day-1 email canceled after subscribing");
  await deliver(welcome);
  assert.equal(captured.filter((c) => c.to[0] === a.email).length, 1, "nothing more went out");
  console.log("✓ subscription during the sequence stops it and cancels queued mail");

  // ── Checkout recovery with a branch; payment stops it ──
  const r1 = await template("recovery 1", "lifecycle", "Something wrong?");
  const r2 = await template("recovery 2", "lifecycle", "Reminder");
  const c = await user("c");
  const recovery = await flow({
    name: "Recovery", trigger_event: "checkout_abandoned", entry_rules: [{ field: "has_plan", op: "is", value: false }], test_emails: [c.email], reentry: "after_exit",
    steps: [{ id: "e1", type: "email", template_id: r1 }, { id: "w", type: "wait", amount: 1, unit: "hours" }, { id: "b", type: "branch", rules: [{ field: "open_checkout", op: "is", value: true }], yes: "e2", no: "end" }, { id: "e2", type: "email", template_id: r2 }],
    exit_events: ["payment_succeeded", "subscription_activated"], goal_event: "subscription_activated",
  });
  const { data: cs } = await db.from("checkout_sessions").insert({ workspace_id: c.ws, user_id: c.id, plan: "growth", billing_period: "monthly", status: "opened", last_activity_at: new Date(Date.now() - 3 * 3_600_000).toISOString(), opened_at: new Date(Date.now() - 3 * 3_600_000).toISOString() }).select("id").single();
  await db.rpc("checkout_classify", { p_abandon_minutes: 30, p_result_minutes: 120, p_confirm_minutes: 1440 });
  await cycle(2);
  assert.equal((await logs(recovery, c.id)).length, 1, "first recovery email queued");
  assert.match((await logs(recovery, c.id))[0].html ?? "", /checkout\?plan=growth/, "link to complete the subscription");
  // Payment arrives: the run exits before the reminder.
  const { data: pay } = await db.from("payments").insert({ workspace_id: c.ws, kind: "subscription", plan: "growth", billing_period: "monthly", amount: 50, currency: "USD", provider: "paymob", mode: "test", status: "pending", created_by: c.id, checkout_id: cs!.id }).select("id").single();
  await db.from("payments").update({ status: "succeeded" }).eq("id", pay!.id);
  await cycle();
  assert.equal((await enrollments(recovery, c.id))[0].status, "exited", "confirmed payment ends recovery");
  await wakeUp(recovery);
  await cycle();
  assert.equal((await logs(recovery, c.id)).length, 1, "no reminder after paying");
  console.log("✓ checkout recovery: abandoned → email → payment confirmed → stopped");

  // Branch "no": the checkout is closed, the reminder is skipped.
  const d = await user("d");
  await db.from("msg_flows").update({ test_emails: [c.email, d.email] }).eq("id", recovery);
  const { data: cs2 } = await db.from("checkout_sessions").insert({ workspace_id: d.ws, user_id: d.id, plan: "pro", billing_period: "monthly", status: "opened", last_activity_at: new Date(Date.now() - 3 * 3_600_000).toISOString(), opened_at: new Date(Date.now() - 3 * 3_600_000).toISOString() }).select("id").single();
  await db.rpc("checkout_classify", { p_abandon_minutes: 30, p_result_minutes: 120, p_confirm_minutes: 1440 });
  await cycle(2);
  await db.from("checkout_sessions").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", cs2!.id);
  await wakeUp(recovery);
  await cycle(2);
  const [ed] = await enrollments(recovery, d.id);
  assert.equal(ed.status, "completed");
  assert.match(ed.exit_reason ?? "", /branch no/);
  assert.equal((await logs(recovery, d.id)).length, 1, "branch skipped the reminder");
  console.log("✓ branch: no open checkout → reminder skipped");

  // ── Payment failed: transactional, entry limited to ≤ 3 failures ──
  const pf = await template("payment failed", "transactional", "Payment failed");
  const e = await user("e");
  const failed = await flow({ name: "Payment failed", kind: "automation", category: "transactional", trigger_event: "payment_failed", test_emails: [e.email], reentry: "always",
    entry_rules: [{ field: "failed_payments_7d", op: "lte", value: 1 }], steps: [{ id: "e1", type: "email", template_id: pf }, { id: "n1", type: "notification", title: "Your payment didn’t go through", link: "/checkout" }] });
  for (let i = 0; i < 2; i++) {
    const { data: p } = await db.from("payments").insert({ workspace_id: e.ws, kind: "subscription", plan: "pro", billing_period: "monthly", amount: 20, currency: "USD", provider: "paymob", mode: "test", status: "pending", created_by: e.id }).select("id").single();
    await db.from("payments").update({ status: "failed", failure_reason: "declined" }).eq("id", p!.id);
    await cycle(3);
  }
  // payments without a checkout record no funnel event: use the registry directly, as the checkout trigger does.
  await db.rpc("funnel_event", { p_key: `payment_failed:test-${stamp}-1`, p_name: "payment_failed", p_user: e.id, p_workspace: e.ws, p_checkout: null, p_payment: null, p_provider: "paymob", p_plan: "pro", p_period: "monthly", p_confirmed: true, p_source: "webhook", p_props: { reason: "declined" } });
  await cycle(3);
  const ef = await enrollments(failed, e.id);
  assert.equal(ef.length, 0, "two failures in 7 days: entry rule (≤ 1) keeps the user out (support path)");
  const { data: skippedLog } = await db.from("msg_activity").select("detail").eq("flow_id", failed).eq("user_id", e.id).eq("kind", "skipped").limit(1);
  assert.match(skippedLog?.[0]?.detail ?? "", /failed_payments_7d/, "the reason is logged");
  console.log("✓ payment failed: repeated failures stop the emails, with the reason logged");

  // ── Unsubscribe: lifecycle stops, transactional still goes; notices are in-app ──
  const f = await user("f");
  await db.from("msg_flows").update({ test_emails: [f.email], entry_rules: [] }).eq("id", failed);
  await db.from("msg_flow_versions").update({ definition: { trigger_event: "payment_failed", entry_rules: [], steps: [{ id: "e1", type: "email", template_id: pf }, { id: "n1", type: "notification", title: "Your payment didn’t go through", link: "/checkout" }], exit_events: [], exit_rules: [], goal_event: null, category: "transactional", kind: "automation" } }).eq("flow_id", failed);
  const token = (await db.from("profiles").select("email_token").eq("id", f.id).single()).data!.email_token;
  assert.ok(await unsubscribeByToken(token));
  await db.rpc("funnel_event", { p_key: `payment_failed:test-${stamp}-f`, p_name: "payment_failed", p_user: f.id, p_workspace: f.ws, p_checkout: null, p_payment: null, p_provider: "paymob", p_plan: "pro", p_period: "monthly", p_confirmed: true, p_source: "webhook", p_props: {} });
  await cycle(3);
  assert.equal((await logs(failed, f.id)).length, 1, "transactional email still sent to an unsubscribed user");
  const { data: notes } = await db.from("notifications").select("title, link").eq("user_id", f.id).eq("flow_id", failed);
  assert.equal(notes?.length, 1, "in-app notice created");
  assert.equal(notes![0].link, "/checkout");
  await db.from("msg_flows").update({ test_emails: [a.email, f.email] }).eq("id", welcome);
  const { data: evF } = await db.from("funnel_events").select("id").eq("event_key", `user_registered:${f.id}`).single();
  await db.from("worker_state").upsert({ key: "messaging.cursor", value: { id: evF!.id - 1 } });
  await cycle(2);
  assert.equal((await enrollments(welcome, f.id)).length, 0, "unsubscribed user doesn't enter lifecycle mail");
  console.log("✓ unsubscribe: lifecycle stops, account email and in-app notices continue");

  // ── Frequency cap: a second lifecycle email within the cap waits ──
  await setSettings({ frequency_hours: 24 });
  const g = await user("g");
  const cap = await flow({ name: "Cap", trigger_event: "search_started", test_emails: [g.email], steps: [{ id: "e1", type: "email", template_id: t0 }, { id: "e2", type: "email", template_id: t1 }] });
  await db.from("strategies").insert({ workspace_id: g.ws, created_by: g.id, title: "Test search", prompt: "test" });
  await cycle(3);
  assert.equal((await logs(cap, g.id)).length, 1, "only one lifecycle email inside the cap");
  const [eg] = await enrollments(cap, g.id);
  assert.ok(Date.parse(eg.next_run_at!) > Date.now() + 23 * 3_600_000, "the next one waits for the cap");
  await setSettings({ frequency_hours: 0 });
  console.log("✓ frequency cap holds the next lifecycle email");

  // ── Template edits never change mail already queued ──
  const before = (await logs(cap, g.id))[0];
  await db.from("msg_templates").update({ subject: "Changed subject", version: 2 }).eq("id", t0);
  await deliver(cap);
  assert.equal(captured.find((x) => x.to[0] === g.email)?.subject, before.subject, "queued mail keeps the version it was queued with");
  console.log("✓ template versions: queued mail keeps its content");

  // ── Campaign: segment, unsubscribed users skipped, no double send ──
  const seg = (await db.from("msg_segments").insert({ name: `No plan ${stamp}`, rules: [{ field: "has_plan", op: "is", value: false }, { field: "email_like", op: "exists" }] }).select("id").single()).data!.id;
  made.segments.push(seg);
  // Only this test's users: restrict by an audience rule on the country we set.
  for (const u of [b, d, f]) await db.from("profiles").update({ country: "ZZ" }).eq("id", u.id);
  await db.from("msg_segments").update({ rules: [{ field: "has_plan", op: "is", value: false }, { field: "country", op: "is", value: "ZZ" }] }).eq("id", seg);
  const camp = (await db.from("msg_campaigns").insert({ name: `Launch ${stamp}`, category: "lifecycle", subject: "News for {{first_name}}", html: "<p>Hello {{first_name}}</p>", segment_id: seg, status: "scheduled", scheduled_at: new Date().toISOString() }).select("id").single()).data!.id;
  made.campaigns.push(camp);
  for (let i = 0; i < 400; i++) {
    await engine.dispatchMsgCampaigns(db as never);
    const st = (await db.from("msg_campaigns").select("status").eq("id", camp).single()).data!.status;
    if (st === "sent") break;
  }
  const cr = (await db.from("msg_campaigns").select("*").eq("id", camp).single()).data!;
  assert.equal(cr.status, "sent");
  const campLogs = (await db.from("email_log").select("to_email").eq("campaign_id", camp)).data!.map((x) => x.to_email).sort();
  assert.deepEqual(campLogs, [b.email, d.email].sort(), "unsubscribed user f skipped; others in the segment queued");
  assert.equal(cr.skipped, 1);
  await db.from("msg_campaigns").update({ status: "sending", cursor_user: null }).eq("id", camp);
  for (let i = 0; i < 400; i++) { await engine.dispatchMsgCampaigns(db as never); if ((await db.from("msg_campaigns").select("status").eq("id", camp).single()).data!.status === "sent") break; }
  assert.equal((await db.from("email_log").select("id").eq("campaign_id", camp)).data!.length, 2, "re-running a campaign never sends twice");
  console.log("✓ campaign: segment audience, unsubscribed skipped, no duplicates");

  // ── Resend webhook: signature, duplicate, bounce → suppression ──
  const row = (await logs(welcome, a.id))[0];
  const secret = `whsec_${Buffer.from("test-secret-123456").toString("base64")}`;
  const body = JSON.stringify({ type: "email.delivered", created_at: new Date().toISOString(), data: { email_id: row.provider_id } });
  const id = `msg_${randomUUID()}`;
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = createHmac("sha256", Buffer.from("test-secret-123456")).update(`${id}.${ts}.${body}`).digest("base64");
  assert.equal(await verifySvix(secret, { id, timestamp: ts, signature: `v1,${sig}` }, body), true, "valid signature");
  assert.equal(await verifySvix(secret, { id, timestamp: ts, signature: "v1,AAAA" }, body), false, "bad signature refused");
  assert.equal(await verifySvix(secret, { id, timestamp: String(Number(ts) - 3600), signature: `v1,${sig}` }, body), false, "old timestamp refused");
  assert.equal(await applyResendEvent(id, JSON.parse(body)), "applied");
  assert.equal(await applyResendEvent(id, JSON.parse(body)), "duplicate", "redelivery is a no-op");
  assert.equal((await db.from("email_log").select("delivery_status").eq("id", row.id).single()).data!.delivery_status, "delivered");
  await applyResendEvent(`msg_${randomUUID()}`, { type: "email.bounced", data: { email_id: row.provider_id!, bounce: { type: "Permanent", message: "mailbox does not exist" } } });
  assert.equal((await db.from("msg_suppressions").select("reason").eq("email", a.email).single()).data!.reason, "bounced", "hard bounce suppresses the address");
  await db.from("msg_suppressions").delete().eq("email", a.email);
  console.log("✓ webhook: signed, idempotent, delivery and bounce recorded");

  // ── Trial ending soon (sweep) → automation with an in-app notice ──
  const h = await user("h");
  const trialFlow = await flow({ name: "Trial ending", kind: "automation", category: "transactional", trigger_event: "trial_ending_soon", test_emails: [h.email], reentry: "always",
    entry_rules: [{ field: "subscription_status", op: "in", value: ["trialing"] }], steps: [{ id: "n1", type: "notification", title: "Your trial ends on {{trial_ends}}", link: "/checkout" }] });
  await db.from("workspaces").update({ subscription_status: "trialing", plan: "pro", trial_ends_at: new Date(Date.now() + 36 * 3_600_000).toISOString() }).eq("id", h.ws);
  assert.ok((await engine.timeEvents(db as never)) >= 1);
  await engine.timeEvents(db as never);
  await cycle(2);
  const { data: hn } = await db.from("notifications").select("title").eq("user_id", h.id).eq("flow_id", trialFlow);
  assert.equal(hn?.length, 1, "one notice, even after sweeping twice");
  assert.match(hn![0].title, /Your trial ends on \w+ \d+, \d{4}/);
  console.log("✓ trial ending soon: swept once, notice created");

  console.log("\nAll messaging checks passed.");
} finally {
  server.close();
  await setSettings({});
  for (const id of made.campaigns) await db.from("msg_campaigns").delete().eq("id", id);
  for (const id of made.flows) await db.from("msg_flows").delete().eq("id", id);
  for (const id of made.segments) await db.from("msg_segments").delete().eq("id", id);
  for (const id of made.users) {
    await db.from("email_log").delete().eq("user_id", id);
    await db.from("msg_activity").delete().eq("user_id", id);
    await db.auth.admin.deleteUser(id);
  }
  for (const id of made.templates) await db.from("msg_templates").delete().eq("id", id);
}
