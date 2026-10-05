// Integration test for the email system (docs/05 "Emails") against the local
// Supabase, no real email sent: Resend is replaced by a local capture server.
// Covers every real trigger: plan welcome/receipt/upgrade/cancel/resume,
// renewal reminder, test-mode renewal, ending reminder, usage 80 %/100 %,
// discovery ready, new device sign-in, suspicious link requests, welcome,
// security alert, announcements, account deletion; dedupe and preferences.
//   npm run test:emails
import assert from "node:assert/strict";
import http from "node:http";
import { createClient } from "@supabase/supabase-js";

const captured: { from: string; to: string[]; subject: string }[] = [];
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    captured.push(JSON.parse(body));
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ id: `test_${captured.length}` }));
  });
}).listen(4920);
process.env.RESEND_API_URL = "http://127.0.0.1:4920";
process.env.RESEND_API_KEY = "test";
process.env.EMAIL_DOMAIN = "yolias.test";
delete process.env.EMAIL_FROM;

const { startPlan, setCancelAtPeriodEnd, billingSweep } = await import("@/lib/billing.ts");
const events = await import("@/lib/email/events.ts");
const { deliverEmail, notify } = await import("@/lib/email/notify.ts");
const { sendAnnouncement } = await import("@/lib/email/announce.ts");

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const email = `emails-test+${Date.now()}@yolias.test`;
const { data: created, error: createError } = await admin.auth.admin.createUser({ email, email_confirm: true });
if (createError) throw createError;
const userId = created.user!.id;
const { data: profile } = await admin.from("profiles").select("workspace_id").eq("id", userId).single();
const wsId = profile!.workspace_id!;
await admin.from("profiles").update({ full_name: "Email Test", onboarded_at: new Date().toISOString(), notify_product: true }).eq("id", userId);
const ws = async () => (await admin.from("workspaces").select("*").eq("id", wsId).single()).data!;
const kinds = async () => (await admin.from("email_log").select("kind").eq("to_email", email).order("id")).data!.map((r) => r.kind);

async function drain() {
  const { data } = await admin.from("email_log").select("id").eq("to_email", email).eq("status", "queued");
  for (const r of data ?? []) await deliverEmail(r.id);
}

let announcementId: string | null = null;
try {
  const payer = { userId, email, name: "Email Test" };
  // Subscription: first paid plan ⇒ receipt + welcome; then upgrade.
  assert.equal(await startPlan(await ws(), "pro", "monthly", payer), true);
  assert.deepEqual(await kinds(), ["receipt", "plan_welcome"]);
  assert.equal(await startPlan(await ws(), "growth", "monthly", payer), true);
  assert.deepEqual((await kinds()).slice(2), ["receipt", "plan_upgraded"]);
  // Cancel ⇒ canceled; resume ⇒ activated.
  await setCancelAtPeriodEnd(await ws(), true, userId);
  await setCancelAtPeriodEnd(await ws(), false, userId);
  assert.deepEqual((await kinds()).slice(4), ["subscription_canceled", "subscription_activated"]);

  // Sweep: reminder 5 days before (once only), then a test-mode renewal.
  await admin.from("workspaces").update({ current_period_end: new Date(Date.now() + 5 * 86_400_000).toISOString() }).eq("id", wsId);
  await billingSweep();
  await billingSweep();
  assert.deepEqual((await kinds()).slice(6), ["renewal_upcoming"]);
  await admin.from("workspaces").update({ current_period_end: new Date(Date.now() - 3_600_000).toISOString() }).eq("id", wsId);
  const swept = await billingSweep();
  assert.equal(swept.renewed >= 1, true);
  assert.deepEqual((await kinds()).slice(7), ["subscription_renewed", "receipt"]);
  assert.ok(new Date((await ws()).current_period_end!) > new Date(), "period moved forward");
  // Canceled and ending in 2 days ⇒ "ending" reminder.
  await admin.from("workspaces").update({ cancel_at_period_end: true, current_period_end: new Date(Date.now() + 2 * 86_400_000).toISOString() }).eq("id", wsId);
  await billingSweep();
  assert.deepEqual((await kinds()).slice(9), ["subscription_ending"]);

  // Usage: 85 % ⇒ low (once), 100 % ⇒ limit.
  const { data: u } = await admin.rpc("usage_summary", { p_ws: wsId });
  const allowance = u![0].allowance;
  const period = u![0].period_start;
  await admin.from("usage_ledger").insert({ workspace_id: wsId, kind: "consume", prospects: Math.ceil(allowance * 0.85), period_start: period, reason: "test" });
  await events.usageAlerts(wsId);
  await events.usageAlerts(wsId);
  await admin.from("usage_ledger").insert({ workspace_id: wsId, kind: "consume", prospects: allowance, period_start: period, reason: "test" });
  await events.usageAlerts(wsId);
  assert.deepEqual((await kinds()).slice(10), ["usage_low", "usage_limit"]);

  // Discovery ready to the campaign's creator.
  const { data: st } = await admin.from("strategies").insert({ workspace_id: wsId, created_by: userId, title: "Fintech in Riyadh", prompt: "x", status: "ready" }).select("id").single();
  const { data: camp } = await admin.from("campaigns").insert({ workspace_id: wsId, strategy_id: st!.id, created_by: userId, name: "Fintech", criteria: {}, quota: 10, status: "partial", prospects_found: 4, companies_found: 3 }).select("id").single();
  await events.campaignFinished(camp!.id);
  await events.campaignFinished(camp!.id);
  assert.deepEqual((await kinds()).slice(12), ["discovery_ready"]);

  // Sign-ins: first device silent, a new one alerts once.
  const chrome = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36";
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
  await events.signedIn(userId, chrome, "10.0.0.1");
  await events.signedIn(userId, chrome, "10.0.0.1");
  await events.signedIn(userId, iphone, "10.0.0.2");
  await events.signedIn(userId, iphone, "10.0.0.2");
  assert.deepEqual((await kinds()).slice(13), ["new_sign_in"]);
  // 5 link requests in an hour ⇒ one alert.
  for (let i = 0; i < 6; i++) await events.signInRequested(email);
  assert.deepEqual((await kinds()).slice(14), ["suspicious_sign_in"]);
  await events.welcome(userId, "Email Test");
  await events.securityAlert(userId, "signed_out_everywhere");
  assert.deepEqual((await kinds()).slice(15), ["welcome", "security_alert"]);

  // Preferences: billing off ⇒ no subscription email; security still goes out.
  await admin.from("profiles").update({ notify_billing: false }).eq("id", userId);
  await setCancelAtPeriodEnd(await ws(), false, userId);
  assert.equal((await kinds()).length, 17);
  await admin.from("profiles").update({ notify_billing: true }).eq("id", userId);

  // Announcement to opted-in users (this user has product updates on).
  const { data: ann } = await admin.from("announcements").insert({
    type: "new_feature", title_en: "Saved conversations", body_en: "Every search now keeps its Yolias AI conversation.\n\nOpen any search to continue.",
    title_ar: "محادثات محفوظة", body_ar: "كل بحث يحتفظ الآن بمحادثته مع Yolias AI.", status: "sending",
  }).select("id").single();
  announcementId = ann!.id;
  await sendAnnouncement(ann!.id);
  assert.ok((await kinds()).includes("announcement"));
  const { data: annRow } = await admin.from("announcements").select("status, recipients").eq("id", announcementId).single();
  assert.equal(annRow!.status, "sent");

  // Deliver everything: right sender per category, all sent.
  await drain();
  const { data: rows } = await admin.from("email_log").select("kind, status").eq("to_email", email);
  assert.ok(rows!.every((r) => r.status === "sent"), "all sent");
  const mine = captured.filter((c) => c.to[0] === email);
  const fromOf = (subject: RegExp) => mine.find((c) => subject.test(c.subject))?.from;
  assert.equal(fromOf(/Welcome to the Yolias Pro plan/), "Yolias <billing@yolias.test>");
  assert.equal(fromOf(/Payment successful/), "Yolias Billing <billing@yolias.test>");
  assert.equal(fromOf(/prospects/), "Yolias <usage@yolias.test>");
  assert.equal(fromOf(/New sign-in/), "Yolias Security <security@yolias.test>");
  assert.equal(fromOf(/Introducing Saved conversations/), "Yolias <updates@yolias.test>");
  assert.equal(fromOf(/Welcome to Yolias$/), "Yolias <no-reply@yolias.test>");

  // Account deletion confirmation (sent to the captured address).
  await notify("account_deleted", [{ userId: null, email, locale: "ar", prefs: {} }], { email });
  await drain();
  assert.ok(captured.some((c) => c.to[0] === email && /تم حذف حسابك/.test(c.subject)));

  console.log(`${mine.length + 1} emails delivered:`);
  for (const c of captured.filter((c) => c.to[0] === email)) console.log(` · ${c.from.padEnd(38)} ${c.subject}`);
  console.log("ALL PASS");
} finally {
  await admin.from("email_log").delete().eq("to_email", email);
  if (announcementId) {
    await admin.from("email_log").delete().like("dedupe_key", `announcement:${announcementId}:%`);
    await admin.from("announcements").delete().eq("id", announcementId);
  }
  await admin.from("sign_in_requests").delete().eq("email", email);
  await admin.from("workspaces").delete().eq("id", wsId);
  await admin.auth.admin.deleteUser(userId);
  server.close();
}
