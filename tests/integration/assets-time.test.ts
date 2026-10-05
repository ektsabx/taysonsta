// Master upgrade Phase 15 (docs/bos/30 §21; doc 31): assets & inventory on
// the single device register (licence seats, stock, maintenance, end of life,
// event log, report).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/bos/db";
import { bosUserFor, uniq } from "@/tests/integration/helpers";
import { assignDevice, saveDevice, type DeviceInput } from "@/services/bos/devices";
import { assetReport, assignSeat, closeMaintenance, moveStock, openMaintenance, releaseSeat, setEndOfLife } from "@/services/bos/assets";
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

test("maintenance and retirement for hardware", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const id = await saveDevice(admin, null, base({ type: "laptop", model: "ThinkPad" }));
  devices.push(id);
  await openMaintenance(admin, id, { description: "Broken hinge", vendor_id: null, cost: 50 });
  await assert.rejects(openMaintenance(admin, id, { description: "again", vendor_id: null, cost: null }), ValidationError, "one open maintenance");
  await assert.rejects(assignDevice(admin, id, NOUR, null), ValidationError, "not assignable while in repair");
  const { data: m } = await db().from("asset_maintenance").select("id").eq("device_id", id).eq("status", "open").single();
  await closeMaintenance(admin, m!.id, { result: "Fixed", cost: 60, retire: false });
  assert.equal((await db().from("devices").select("status").eq("id", id).single()).data!.status, "in_stock");
  await assignDevice(admin, id, NOUR, "good");
  await assert.rejects(setEndOfLife(admin, id, "retired", "old"), ValidationError, "return first");
  const { data: ev } = await db().from("asset_events").select("kind").eq("device_id", id).order("occurred_at");
  assert.deepEqual((ev ?? []).map((e) => e.kind).filter((k) => k !== "note"), ["purchased", "maintenance_opened", "maintenance_closed", "assigned"]);
});
