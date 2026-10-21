// Users + conversions in Admin (D-212..D-215): lists filtered on the server,
// account states (suspend / pause / ban / restore), notes, messages with
// their guards, compensation, checkout follow-up, switches — and who may do
// it. Runs ONLY against a LOCAL Yolias database (root .env.local points at
// production — run with YOLIAS_SUPABASE_URL / YOLIAS_SUPABASE_SERVICE_ROLE_KEY
// from Yolias/.env.local). Everything it creates is deleted afterwards.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { ydb, yoliasConfigured } from "@/lib/yolias/db";
import { can } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { bosUserFor } from "@/tests/integration/helpers";
import { ValidationError } from "@/lib/bos/errors";
import {
  account360, accountsOverview, addAccountNote, listAccounts, matchingAccountIds, sendAccountMessage, setAccountState, timelineOf,
} from "@/services/yolias/accounts";
import { checkoutDetail, conversionOverview, funnel, listCheckouts, reviewCheckouts, trialsOverview } from "@/services/yolias/conversions";
import { getSwitches, setSwitch } from "@/services/yolias/switches";

const local = /127\.0\.0\.1|localhost/.test(process.env.YOLIAS_SUPABASE_URL ?? "");
const skip = !yoliasConfigured() || !local;
const created: string[] = [];
let switchesBefore: unknown = null;

after(async () => {
  if (skip) return;
  for (const id of created) await ydb().auth.admin.deleteUser(id).catch(() => {});
  if (switchesBefore !== null) await ydb().from("site_settings").upsert({ key: "platform_switches", value: switchesBefore as never });
});

async function member(tag: string) {
  const email = `admin-accounts-${tag}-${Date.now()}@yolias.local`;
  const { data, error } = await ydb().auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  created.push(data.user.id);
  const { data: p } = await ydb().from("profiles").select("workspace_id").eq("id", data.user.id).single();
  return { id: data.user.id, email, ws: p!.workspace_id! };
}

test("users: lists, states, notes, messages, 360 and permissions", { skip: skip && "needs a LOCAL Yolias database" }, async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const sales = await bosUserFor("sara@taysonsta.local");
  assert.ok(can(admin, "platform.manage", "all"), "the owner/admin can manage the platform");
  assert.ok(!can(sales, "platform.manage", "all"), "a sales user can't run account actions (server actions call authorize(platform.manage, all))");

  const a = await member("a");
  const b = await member("b");

  // Server-side search and paging.
  const found = await listAccounts("all", { q: a.email }, 1);
  assert.equal(found.total, 1);
  assert.equal(found.rows[0].id, a.id);
  assert.equal(found.rows[0].segment, "registered_only");
  const reg = await listAccounts("registered", { q: "admin-accounts-" }, 1, 500);
  assert.ok(reg.rows.some((r) => r.id === a.id) && reg.rows.some((r) => r.id === b.id), "new accounts are registered, not subscribed");
  assert.ok(!(await listAccounts("subscribed", { q: a.email }, 1)).rows.length);
  const ids = await matchingAccountIds("all", { q: "admin-accounts-" });
  assert.ok(ids.includes(a.id) && ids.includes(b.id), "select-all resolves the filter on the server");

  // States: reason required, suspend ≠ ban, restore vs unban, audited.
  await assert.rejects(setAccountState(admin, a.id, "suspend", ""), ValidationError);
  assert.ok((await setAccountState(admin, a.id, "suspend", "Test suspension")).ok);
  assert.equal((await listAccounts("suspended", { q: a.email }, 1)).total, 1);
  const { data: authA } = await ydb().auth.admin.getUserById(a.id);
  assert.ok((authA.user as { banned_until?: string }).banned_until, "sign-in blocked");
  assert.equal((await setAccountState(admin, a.id, "unban", "")).ok, false, "a suspended account isn't 'unbanned'");
  assert.ok((await setAccountState(admin, a.id, "restore", "")).ok);
  assert.equal((await listAccounts("all", { q: a.email }, 1)).rows[0].account_status, "active");
  assert.ok((await setAccountState(admin, b.id, "ban", "Test ban")).ok);
  assert.equal((await listAccounts("banned", { q: b.email }, 1)).total, 1);
  assert.equal((await setAccountState(admin, b.id, "restore", "")).ok, false, "a ban is lifted only with unban");
  assert.ok((await setAccountState(admin, b.id, "unban", "")).ok);
  assert.ok((await setAccountState(admin, b.id, "pause", "Short pause", { days: 2 })).ok);
  const paused = (await listAccounts("suspended", { q: b.email }, 1)).rows[0];
  assert.equal(paused.account_status, "paused");
  assert.ok(paused.status_until && Date.parse(paused.status_until) > Date.now() + 86_400_000);
  const { data: audits } = await db().from("audit_logs").select("action").eq("entity_type", "yolias_user").eq("entity_id", b.id);
  assert.ok(["yolias.user.ban", "yolias.user.unban", "yolias.user.pause"].every((x) => audits!.some((r) => r.action === x)), "audited");

  // Notes + messages (guards: internal links only, no duplicate within 24 h, SMS not connected).
  await addAccountNote(admin, a.id, "Called the member about billing");
  await assert.rejects(sendAccountMessage(admin, a.id, { channel: "email", purpose: "service", subject: "Hi", body: "Hello there", ctaUrl: "https://evil.example" }), ValidationError);
  assert.ok((await sendAccountMessage(admin, a.id, { channel: "in_app", purpose: "service", subject: "Welcome to Yolias", body: "We are here to help." })).ok);
  const dup = await sendAccountMessage(admin, a.id, { channel: "in_app", purpose: "service", subject: "Welcome to Yolias", body: "Again" });
  assert.equal(dup.ok, false, "the same message isn't sent twice within 24 hours");
  assert.equal((await sendAccountMessage(admin, a.id, { channel: "sms", purpose: "service", subject: "Hi", body: "Hello there" })).ok, false);
  const { data: queued } = await ydb().from("account_messages").select("status, channel").eq("user_id", a.id);
  assert.equal(queued!.length, 1);

  // 360 shows it all, from real records.
  const d = await account360(a.id);
  assert.equal(d.account.id, a.id);
  assert.equal(d.notes.length, 1);
  assert.equal(d.messages.length, 1);
  assert.ok(d.adminActions.some((x) => x.action === "yolias.user.suspend"));
  const tl = timelineOf(d);
  assert.ok(tl.some((e) => e.kind === "signup") && tl.some((e) => e.kind === "note") && tl.some((e) => e.kind === "admin"));

  // Overview numbers come from the same view.
  const now = new Date();
  const o = await accountsOverview(new Date(now.getTime() - 86_400_000).toISOString(), new Date(now.getTime() + 60_000).toISOString());
  assert.ok(o.total >= 2 && o.newInPeriod >= 2 && o.suspended >= 1);

  // Deleted accounts get nothing.
  assert.ok((await setAccountState(admin, b.id, "delete", "Test cleanup")).ok);
  assert.equal((await sendAccountMessage(admin, b.id, { channel: "in_app", purpose: "service", subject: "Hello", body: "Text" })).ok, false);
});

test("conversions: checkout follow-up, funnel and switches", { skip: skip && "needs a LOCAL Yolias database" }, async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const m = await member("c");
  const { data: c } = await ydb().from("checkout_sessions").insert({ workspace_id: m.ws, user_id: m.id, plan: "pro", billing_period: "monthly", amount_usd: 50, status: "abandoned", abandoned_at: new Date().toISOString(), reason_category: "no_payment_started" }).select("id").single();
  await ydb().from("funnel_events").insert({ event_key: `checkout_opened:${c!.id}`, name: "checkout_opened", user_id: m.id, workspace_id: m.ws, checkout_id: c!.id, plan: "pro", confirmed: true });

  const list = await listCheckouts({ state: "abandoned", q: m.email }, 1);
  assert.equal(list.total, 1);
  assert.equal(list.rows[0].user?.email, m.email);
  assert.match(list.rows[0].next, /تذكير/);
  await assert.rejects(reviewCheckouts(admin, [c!.id], "excluded", { reason: "" }), ValidationError, "excluding needs a reason");
  assert.equal(await reviewCheckouts(admin, [c!.id], "excluded", { reason: "Test account" }), 1);
  assert.equal((await listCheckouts({ state: "abandoned", q: m.email }, 1)).total, 0, "excluded cases leave the default list");
  assert.equal((await listCheckouts({ state: "abandoned", q: m.email, review: "excluded" }, 1)).total, 1);
  const detail = await checkoutDetail(c!.id);
  assert.equal(detail.events.length, 1);

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const until = new Date(Date.now() + 60_000).toISOString();
  const f = await funnel(since, until);
  assert.ok((f[0]?.rows.find((r) => r.stage === "checkout_opened")?.people ?? 0) >= 1);
  const o = await conversionOverview(since, until);
  assert.ok(o.abandoned >= 1 && o.opened >= 1);
  assert.ok((await trialsOverview(since, until, 1)).rows.length >= 0);

  // Switches: audited, read back.
  switchesBefore = (await ydb().from("site_settings").select("value").eq("key", "platform_switches").maybeSingle()).data?.value ?? {};
  await setSwitch(admin, "buy_more", false);
  assert.equal((await getSwitches()).values.buy_more, false);
  await setSwitch(admin, "buy_more", true);
  assert.equal((await getSwitches()).values.buy_more, true);
  await assert.rejects(setSwitch(admin, "everything", false), ValidationError);
});
