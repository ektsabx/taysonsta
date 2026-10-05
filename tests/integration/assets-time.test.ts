// Master upgrade Phase 15 (docs/bos/30 §21–22; doc 31): assets & inventory on
// the single device register (licence seats, stock, maintenance, branch
// transfer, end of life, event log, report) and time approvals + reports
// (pending hours don't count, no self-approval, task actuals follow approval).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/bos/db";
import { bosUserFor, uniq } from "@/tests/integration/helpers";
import { getSetting, saveSetting } from "@/lib/bos/settings";
import { assignDevice, saveDevice, type DeviceInput } from "@/services/bos/devices";
import { assetReport, assignSeat, closeMaintenance, moveStock, openMaintenance, releaseSeat, setEndOfLife, transferBranch } from "@/services/bos/assets";
import { logTime } from "@/services/bos/delivery";
import { reviewTime, timeReport } from "@/services/bos/time-reports";
import { ForbiddenError, ValidationError } from "@/lib/bos/errors";

const cleanup: (() => PromiseLike<unknown>)[] = [];
after(async () => {
  for (const fn of cleanup.reverse()) await Promise.resolve(fn()).catch((e) => console.error("cleanup", e));
});
const devices: string[] = [];
cleanup.push(async () => {
  if (!devices.length) return;
  await db().from("device_assignments").delete().in("device_id", devices);
  await db().from("devices").delete().in("id", devices);
});

const base = (o: Partial<DeviceInput>): DeviceInput => ({ asset_id: uniq("AST"), type: "laptop", model: null, serial_number: null, os: null, purchase_date: null, warranty_until: null, condition: "good", location: null, mdm_provider: null, mdm_reference: null, notes: null, ...o });
// Seed employees by name (ids differ between databases).
async function employeeId(fullName: string): Promise<string> {
  const { data } = await db().from("employees").select("id").eq("full_name", fullName).is("archived_at", null).limit(1).single();
  if (!data) throw new Error(`seed employee missing: ${fullName}`);
  return data.id;
}
const NOUR = await employeeId("Nour Designer");
const DEV = await employeeId("Youssef Developer");
const OMAR = await employeeId("Omar Project Manager");

test("software licence seats: limit, no duplicates, release; logged as events", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  await assert.rejects(saveDevice(admin, null, base({ type: "software_license", name: "Figma" })), ValidationError, "seats required");
  const id = await saveDevice(admin, null, base({ type: "software_license", name: "Figma", license_seats: 2, license_expiry: "2030-01-01", purchase_value: 900, currency: "USD" }));
  devices.push(id);
  await assert.rejects(assignDevice(admin, id, NOUR, null), ValidationError, "licences use seats, not handover");
  await assignSeat(admin, id, NOUR, null);
  await assert.rejects(assignSeat(admin, id, NOUR, null), ValidationError, "no duplicate seat");
  await assignSeat(admin, id, DEV, null);
  await assert.rejects(assignSeat(admin, id, OMAR, null), ValidationError, "all seats used");
  const { data: seat } = await db().from("device_assignments").select("id").eq("device_id", id).eq("employee_id", NOUR).is("returned_at", null).single();
  await releaseSeat(admin, seat!.id);
  await assignSeat(admin, id, OMAR, null);
  const { data: ev } = await db().from("asset_events").select("kind").eq("device_id", id);
  const kinds = (ev ?? []).map((e) => e.kind);
  for (const k of ["purchased", "seat_assigned", "seat_released"]) assert.ok(kinds.includes(k), k);
  const r = await assetReport(admin);
  const lic = r.licenseUsage.find((l) => l.id === id)!;
  assert.deepEqual([lic.used, lic.seats], [2, 2]);
  await assert.rejects(setEndOfLife(admin, id, "retired", "no longer used"), ValidationError, "release seats first");
});

test("stock: movements with guard, never negative, low-stock alert; access", async () => {
  const [admin, designer] = await Promise.all([bosUserFor("admin@taysonsta.local"), bosUserFor("nour@taysonsta.local")]);
  const id = await saveDevice(admin, null, base({ type: "spare_part", name: "USB-C cables", quantity: 10, min_quantity: 5 }));
  devices.push(id);
  cleanup.push(() => db().from("activity_events").delete().eq("entity_id", id));
  await assert.rejects(moveStock(designer, id, -1, "x"), ForbiddenError);
  assert.equal(await moveStock(admin, id, -3, "handed out", NOUR), 7);
  await assert.rejects(moveStock(admin, id, -20, "too many"), ValidationError);
  await assert.rejects(moveStock(admin, id, -1, " "), ValidationError, "reason required");
  assert.equal(await moveStock(admin, id, -3, "handed out"), 4);
  const { count } = await db().from("activity_events").select("id", { count: "exact", head: true }).eq("event_type", "asset.alert").eq("entity_id", id);
  assert.equal(count, 1, "crossing the minimum alerts once");
  assert.equal(await moveStock(admin, id, 6, "restock"), 10);
  // Editing the asset doesn't overwrite stock (movements only).
  await saveDevice(admin, id, base({ asset_id: (await db().from("devices").select("asset_id").eq("id", id).single()).data!.asset_id, type: "spare_part", name: "USB-C cables", quantity: 999, min_quantity: 5 }));
  assert.equal((await db().from("devices").select("quantity").eq("id", id).single()).data!.quantity, 10);
});

test("maintenance, branch transfer and retirement for hardware", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const id = await saveDevice(admin, null, base({ type: "laptop", model: "ThinkPad" }));
  devices.push(id);
  await openMaintenance(admin, id, { description: "Broken hinge", vendor_id: null, cost: 50 });
  await assert.rejects(openMaintenance(admin, id, { description: "again", vendor_id: null, cost: null }), ValidationError, "one open maintenance");
  await assert.rejects(assignDevice(admin, id, NOUR, null), ValidationError, "not assignable while in repair");
  const { data: m } = await db().from("asset_maintenance").select("id").eq("device_id", id).eq("status", "open").single();
  await closeMaintenance(admin, m!.id, { result: "Fixed", cost: 60, retire: false });
  assert.equal((await db().from("devices").select("status").eq("id", id).single()).data!.status, "in_stock");
  const { data: br } = await db().from("branches").select("id").eq("status", "active").limit(1).single();
  await db().from("devices").update({ branch_id: null }).eq("id", id);
  await transferBranch(admin, id, br!.id, "moved");
  await assignDevice(admin, id, NOUR, "good");
  await assert.rejects(setEndOfLife(admin, id, "retired", "old"), ValidationError, "return first");
  const { data: ev } = await db().from("asset_events").select("kind").eq("device_id", id).order("occurred_at");
  assert.deepEqual((ev ?? []).map((e) => e.kind).filter((k) => k !== "note"), ["purchased", "maintenance_opened", "maintenance_closed", "branch_transfer", "assigned"]);
});

test("time approval: pending hours don't count, no self-approval, task actuals follow approval", async () => {
  const [admin, dev] = await Promise.all([bosUserFor("admin@taysonsta.local"), bosUserFor("youssef.dev@taysonsta.local")]);
  const before = await getSetting("time_tracking");
  await saveSetting("time_tracking", { approval: "manual" }, admin.userId);
  cleanup.push(() => saveSetting("time_tracking", before, admin.userId));
  const { data: task } = await db().from("tasks").select("id, project_id, actual_minutes").is("archived_at", null).not("project_id", "is", null).limit(1).single();
  const day = new Date(Date.now() - 3 * 86400_000).toISOString().slice(0, 10);
  const start = `${day}T07:00:00.000Z`;
  const end = `${day}T09:30:00.000Z`;
  await logTime(dev, { user_id: dev.userId, project_id: task!.project_id, task_id: task!.id, started_at: start, ended_at: end, description: uniq("approval test"), billable: true });
  const { data: e } = await db().from("time_entries").select("id, approval_status").eq("user_id", dev.userId).eq("started_at", start).single();
  cleanup.push(() => db().from("time_entries").delete().eq("id", e!.id));
  assert.equal(e!.approval_status, "pending");
  assert.equal((await db().from("tasks").select("actual_minutes").eq("id", task!.id).single()).data!.actual_minutes, task!.actual_minutes, "pending hours not in task actual");

  const r1 = await timeReport(admin, { from: day, to: day, user_id: dev.userId });
  assert.equal(r1.total.pending, 150);
  assert.ok(r1.pending.some((p) => p.id === e!.id));
  const counted1 = r1.total.minutes;

  await assert.rejects(reviewTime(dev, [e!.id], "approved", null), ForbiddenError, "developers can't approve");
  await assert.rejects(reviewTime(admin, [e!.id], "rejected", " "), ValidationError, "reason required");
  assert.equal(await reviewTime(admin, [e!.id], "approved", null), 1);
  const r2 = await timeReport(admin, { from: day, to: day, user_id: dev.userId });
  assert.equal(r2.total.minutes, counted1 + 150);
  assert.equal(r2.total.billable - r1.total.billable, 150);
  assert.equal((await db().from("tasks").select("actual_minutes").eq("id", task!.id).single()).data!.actual_minutes, (task!.actual_minutes ?? 0) + 150, "approved hours reach the task");
  const proj = r2.projects.find((p) => p.id === task!.project_id)!;
  assert.ok(proj.minutes >= 150);

  // Admin's own manual entry is pending too — and they can't approve it themselves.
  await logTime(admin, { user_id: admin.userId, project_id: task!.project_id, task_id: null, started_at: `${day}T10:00:00.000Z`, ended_at: `${day}T10:30:00.000Z`, description: null, billable: false });
  const { data: own } = await db().from("time_entries").select("id").eq("user_id", admin.userId).eq("started_at", `${day}T10:00:00.000Z`).single();
  cleanup.push(() => db().from("time_entries").delete().eq("id", own!.id));
  await assert.rejects(reviewTime(admin, [own!.id], "approved", null), ValidationError, "no self-approval");
});
