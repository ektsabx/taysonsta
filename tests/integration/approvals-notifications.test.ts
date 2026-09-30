// Master upgrade Phase 6 (docs/bos/30 §9, §18; doc 31): unified approvals
// (parallel, request changes/resubmit, delegation, due dates + escalation,
// thresholds) and notifications (templates per language, conditions,
// delivery queue, manual sends).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/bos/db";
import { getSetting, saveSetting } from "@/lib/bos/settings";
import { bosUserFor, uniq } from "@/tests/integration/helpers";
import { canDecide, createDelegation, decideApproval, remindOverdueApprovals, requestApproval, resubmitApproval } from "@/services/bos/approvals";
import { dispatchNotifications } from "@/lib/bos/notify";
import { processDeliveries, retryDelivery } from "@/services/bos/notification-delivery";
import { sendManualNotification } from "@/services/bos/manual-notifications";
import { ForbiddenError, ValidationError } from "@/lib/bos/errors";

const cleanup: (() => PromiseLike<unknown>)[] = [];
after(async () => {
  for (const fn of cleanup.reverse()) await Promise.resolve(fn()).catch((e) => console.error("cleanup", e));
});

// A throw-away entity id so no module handler reacts to the outcome.
function entity() {
  const id = crypto.randomUUID();
  cleanup.push(async () => {
    await db().from("approvals").delete().eq("entity_id", id);
    await db().from("notifications").delete().eq("entity_id", id);
  });
  return id;
}

test("parallel step waits for every member; the next step starts after; a rejection closes the step", async () => {
  const [admin, sara, hr, fin] = await Promise.all([bosUserFor("admin@taysonsta.local"), bosUserFor("sara@taysonsta.local"), bosUserFor("hr@taysonsta.local"), bosUserFor("finance@taysonsta.local")]);
  const id = entity();
  const a1 = await requestApproval({ type: "design", entityType: "test_entity", entityId: id, title: uniq("Parallel"), requestedBy: admin.userId, steps: [`user:${sara.userId}|user:${hr.userId}`, `user:${fin.userId}`] });
  const { data: step1 } = await db().from("approvals").select("id, approver_user_id, status, due_at").eq("group_id", a1.group_id!).eq("step", 1);
  assert.equal(step1!.length, 2, "two parallel approvals");
  assert.ok(step1!.every((r) => r.due_at), "due dates set");
  const saraRow = step1!.find((r) => r.approver_user_id === sara.userId)!;
  const hrRow = step1!.find((r) => r.approver_user_id === hr.userId)!;

  await decideApproval(saraRow.id, "approved", null, { bos: sara });
  const { count: s2a } = await db().from("approvals").select("id", { count: "exact", head: true }).eq("group_id", a1.group_id!).eq("step", 2);
  assert.equal(s2a, 0, "step 2 waits for the other parallel approver");
  await decideApproval(hrRow.id, "approved", null, { bos: hr });
  const { data: s2 } = await db().from("approvals").select("id, approver_user_id, status").eq("group_id", a1.group_id!).eq("step", 2);
  assert.equal(s2!.length, 1);
  assert.equal(s2![0].approver_user_id, fin.userId);
  await decideApproval(s2![0].id, "approved", null, { bos: fin });

  // Rejection by one parallel member cancels the other.
  const id2 = entity();
  const b = await requestApproval({ type: "design", entityType: "test_entity", entityId: id2, title: uniq("Parallel reject"), requestedBy: admin.userId, steps: [[`user:${sara.userId}`, `user:${hr.userId}`]] });
  const { data: rows } = await db().from("approvals").select("id, approver_user_id").eq("group_id", b.group_id!);
  await assert.rejects(decideApproval(rows!.find((r) => r.approver_user_id === sara.userId)!.id, "rejected", "", { bos: sara }), ValidationError, "reason required");
  await decideApproval(rows!.find((r) => r.approver_user_id === sara.userId)!.id, "rejected", "no", { bos: sara });
  const { data: other } = await db().from("approvals").select("status").eq("id", rows!.find((r) => r.approver_user_id === hr.userId)!.id).single();
  assert.equal(other!.status, "cancelled");
});

test("request changes → requester resubmits (new version from step 1); only once and only by the requester", async () => {
  const [admin, sara, hr] = await Promise.all([bosUserFor("admin@taysonsta.local"), bosUserFor("sara@taysonsta.local"), bosUserFor("hr@taysonsta.local")]);
  const id = entity();
  const a = await requestApproval({ type: "design", entityType: "test_entity", entityId: id, title: uniq("Changes"), requestedBy: sara.userId, steps: [`user:${hr.userId}`] });
  await assert.rejects(decideApproval(a.id, "changes_requested", " ", { bos: hr }), ValidationError, "what to change is required");
  await decideApproval(a.id, "changes_requested", "Add the budget", { bos: hr });
  const { data: after1 } = await db().from("approvals").select("status").eq("id", a.id).single();
  assert.equal(after1!.status, "changes_requested");

  await assert.rejects(resubmitApproval(hr, a.id, null), ForbiddenError, "only the requester");
  const again = await resubmitApproval(sara, a.id, "Budget added");
  assert.equal(again.version, 2);
  assert.equal(again.step, 1);
  assert.equal(again.status, "pending");
  await assert.rejects(resubmitApproval(sara, a.id, null), ValidationError, "can't resubmit the same round twice");
  void admin;
});

test("delegation routes new approvals to the substitute and lets them decide open ones", async () => {
  const [admin, sara, hr] = await Promise.all([bosUserFor("admin@taysonsta.local"), bosUserFor("sara@taysonsta.local"), bosUserFor("hr@taysonsta.local")]);
  const id = entity();
  const open = await requestApproval({ type: "design", entityType: "test_entity", entityId: id, title: uniq("Before delegation"), requestedBy: admin.userId, steps: [`user:${sara.userId}`] });
  assert.equal(await canDecide(hr, open), false);

  const today = new Date().toISOString().slice(0, 10);
  const delId = await createDelegation(sara, { user_id: sara.userId, delegate_user_id: hr.userId, starts_on: today, ends_on: today, approval_types: ["design"], reason: "test" });
  cleanup.push(() => db().from("approval_delegations").delete().eq("id", delId));
  await assert.rejects(createDelegation(sara, { user_id: hr.userId, delegate_user_id: sara.userId, starts_on: today, ends_on: today, approval_types: [], reason: null }), ForbiddenError, "can only delegate own approvals");

  assert.equal(await canDecide(hr, open), true, "substitute decides the open one");
  const id2 = entity();
  const routed = await requestApproval({ type: "design", entityType: "test_entity", entityId: id2, title: uniq("During delegation"), requestedBy: admin.userId, steps: [`user:${sara.userId}`] });
  assert.equal(routed.approver_user_id, hr.userId);
  assert.equal(routed.delegated_from, sara.userId);
  await decideApproval(open.id, "approved", null, { bos: hr });

  // Parallel members that resolve to the same person need one decision only.
  const id3 = entity();
  const merged = await requestApproval({ type: "design", entityType: "test_entity", entityId: id3, title: uniq("Merged"), requestedBy: admin.userId, steps: [`user:${sara.userId}|user:${hr.userId}`] });
  const { count } = await db().from("approvals").select("id", { count: "exact", head: true }).eq("group_id", merged.group_id!);
  assert.equal(count, 1, "sara's share is delegated to hr, so one approval");
  await db().from("approval_delegations").delete().eq("id", delId);
});

test("due dates: overdue reminder once per interval, escalation to the approver's manager; thresholds add steps", async () => {
  const [admin, sara, fin] = await Promise.all([bosUserFor("admin@taysonsta.local"), bosUserFor("sara@taysonsta.local"), bosUserFor("finance@taysonsta.local")]);
  const before = await getSetting("approval_workflow");
  cleanup.push(() => saveSetting("approval_workflow", before, admin.userId));
  await saveSetting("approval_workflow", { ...before, escalate_after_hours: 1, thresholds: [{ approval_type: "design", min_amount: 1000, add_steps: [`user:${fin.userId}`] }] }, admin.userId);

  const id = entity();
  const small = await requestApproval({ type: "design", entityType: "test_entity", entityId: id, title: uniq("Small"), requestedBy: admin.userId, steps: [`user:${sara.userId}`], payload: { amount_base: 500 } });
  assert.equal(small.total_steps, 1);
  const id2 = entity();
  const big = await requestApproval({ type: "design", entityType: "test_entity", entityId: id2, title: uniq("Big"), requestedBy: admin.userId, steps: [`user:${sara.userId}`], payload: { amount_base: 5000 } });
  assert.equal(big.total_steps, 2, "threshold added a step");

  await db().from("approvals").update({ due_at: new Date(Date.now() - 3 * 3600_000).toISOString() }).eq("id", small.id);
  const n1 = await remindOverdueApprovals();
  assert.ok(n1 >= 1);
  const { data: r1 } = await db().from("approvals").select("reminded_at").eq("id", small.id).single();
  assert.ok(r1!.reminded_at, "reminder recorded");
  const { data: ev } = await db().from("activity_events").select("payload").eq("event_type", "approval.overdue").eq("entity_id", id).order("id", { ascending: false }).limit(1).single();
  const p = ev!.payload as { hours_overdue: number; escalation_user_id: string | null };
  assert.ok(p.hours_overdue >= 3);
  const { data: mgr } = await db().from("employees").select("manager_id").eq("user_id", sara.userId).single();
  if (mgr!.manager_id) assert.ok(p.escalation_user_id, "escalated to the approver's manager");
  const again = await remindOverdueApprovals();
  const { data: r2 } = await db().from("approvals").select("reminded_at").eq("id", small.id).single();
  assert.equal(r2!.reminded_at, r1!.reminded_at, "no second reminder within the interval");
  void again;
});

test("notification copy follows the recipient's language; subscription conditions filter", async () => {
  const [admin, sara, hr] = await Promise.all([bosUserFor("admin@taysonsta.local"), bosUserFor("sara@taysonsta.local"), bosUserFor("hr@taysonsta.local")]);
  const c = db();
  const { data: prefBefore } = await c.from("user_preferences").select("language").eq("user_id", hr.userId).maybeSingle();
  await c.from("user_preferences").upsert({ user_id: hr.userId, language: "en" }, { onConflict: "user_id" });
  cleanup.push(() => c.from("user_preferences").update({ language: prefBefore?.language ?? null }).eq("user_id", hr.userId));

  const title = uniq("Lang");
  const id = entity();
  await requestApproval({ type: "design", entityType: "test_entity", entityId: id, title, requestedBy: admin.userId, steps: [`user:${sara.userId}|user:${hr.userId}`] });
  const { data: notes } = await c.from("notifications").select("user_id, title, priority").eq("entity_id", id).eq("event_type", "approval.requested");
  const toSara = notes!.find((n) => n.user_id === sara.userId);
  const toHr = notes!.find((n) => n.user_id === hr.userId);
  assert.ok(toSara && toHr, "both approvers notified");
  assert.equal(toSara!.title, `مطلوب موافقتك: ${title}`);
  assert.equal(toHr!.title, `Your approval is needed: ${title}`);
  assert.equal(toSara!.priority, "high", "priority from the template");

  // Conditions on a subscription.
  const eventType = "security.alert";
  const { data: sub } = await c.from("notification_subscriptions").insert({ event_type: eventType, subscriber_kind: "user", user_id: sara.userId, channels: ["in_app"], user_configurable: false, conditions: [{ field: "payload.level", op: "eq", value: "high" }] as never }).select("id").single();
  cleanup.push(() => c.from("notification_subscriptions").delete().eq("id", sub!.id));
  const ent = entity();
  const base = { id: null, event_type: eventType, entity_type: "test_entity", entity_id: ent, actor_user_id: null, actor_type: "system", summary: "Security alert test", visibility: "internal", created_at: new Date().toISOString(), processed_at: null, dedupe_key: null };
  await dispatchNotifications({ ...base, payload: { level: "low" } } as never);
  const { count: low } = await c.from("notifications").select("id", { count: "exact", head: true }).eq("entity_id", ent).eq("user_id", sara.userId);
  assert.equal(low, 0, "condition not met → no notification");
  await dispatchNotifications({ ...base, payload: { level: "high" } } as never);
  const { data: high } = await c.from("notifications").select("title, priority").eq("entity_id", ent).eq("user_id", sara.userId);
  assert.equal(high!.length, 1, "condition met → notified");
  assert.equal(high![0].priority, "urgent");
});

test("delivery queue: channels without a provider are skipped with a reason; retry re-queues", async () => {
  const sara = await bosUserFor("sara@taysonsta.local");
  const admin = await bosUserFor("admin@taysonsta.local");
  const c = db();
  const ent = entity();
  const { data: n } = await c.from("notifications").insert({ user_id: sara.userId, event_type: "security.alert", title: uniq("Delivery"), entity_type: "test_entity", entity_id: ent }).select("id").single();
  const { data: d } = await c.from("notification_deliveries").insert([{ notification_id: n!.id, channel: "whatsapp" }, { notification_id: n!.id, channel: "push" }]).select("id, channel");
  await processDeliveries(500);
  const { data: after } = await c.from("notification_deliveries").select("channel, status, last_error").in("id", d!.map((x) => x.id));
  for (const row of after!) {
    assert.equal(row.status, "skipped", `${row.channel} skipped`);
    assert.ok(row.last_error, "with a reason");
  }
  await retryDelivery(admin, d![0].id);
  await assert.rejects(retryDelivery(sara, d![0].id), ForbiddenError);
});

test("manual notifications: delivered to the chosen people, duplicate blocked, permission enforced", async () => {
  const [admin, sara, hr] = await Promise.all([bosUserFor("admin@taysonsta.local"), bosUserFor("sara@taysonsta.local"), bosUserFor("hr@taysonsta.local")]);
  const c = db();
  const title = uniq("Announcement");
  const r = await sendManualNotification(hr, { target_kind: "users", target_ids: [sara.userId, admin.userId], channels: ["in_app"], priority: "high", title, body: "Office closed tomorrow", link: "/admin/knowledge" });
  cleanup.push(async () => {
    await c.from("notifications").delete().eq("entity_id", r.id);
    await c.from("manual_notifications").delete().eq("id", r.id);
  });
  assert.equal(r.recipients, 2);
  const { data: rows } = await c.from("notifications").select("user_id, priority, link").eq("entity_id", r.id);
  assert.equal(rows!.length, 2);
  assert.ok(rows!.every((x) => x.priority === "high" && x.link === "/admin/knowledge"));
  await assert.rejects(sendManualNotification(hr, { target_kind: "users", target_ids: [sara.userId, admin.userId], channels: ["in_app"], priority: "high", title, body: "Office closed tomorrow", link: null }), ValidationError, "duplicate within 10 minutes");
  await assert.rejects(sendManualNotification(sara, { target_kind: "users", target_ids: [admin.userId], channels: ["in_app"], priority: "normal", title: "x", body: null, link: null }), ForbiddenError, "sales can't broadcast");
  await assert.rejects(sendManualNotification(hr, { target_kind: "users", target_ids: [admin.userId], channels: ["in_app"], priority: "normal", title: "x", body: null, link: "https://evil.example" }), ValidationError, "external links refused");
});
