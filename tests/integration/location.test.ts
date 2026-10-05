// Master upgrade Phase 19 (docs/bos/30 §28; doc 31): consented location
// (off by default, consent + purpose version, work events only, dedupe,
// permission-gated views with access log, own history deletion, retention).
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/bos/db";
import { bosUserFor, uniq } from "@/tests/integration/helpers";
import { getSetting, saveSetting } from "@/lib/bos/settings";
import { deleteMyLocations, locationStatus, purgeLocations, recordLocation, setLocationConsent, viewLocations } from "@/services/bos/location";
import { ForbiddenError, ValidationError } from "@/lib/bos/errors";

const cleanup: (() => PromiseLike<unknown>)[] = [];
after(async () => {
  for (const fn of cleanup.reverse()) await Promise.resolve(fn()).catch((e) => console.error("cleanup", e));
});

before(async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const before = await getSetting("location");
  cleanup.push(() => saveSetting("location", before, admin.userId));
  const started = new Date().toISOString();
  cleanup.push(async () => {
    await db().from("employee_locations").delete().gte("captured_at", started);
    await db().from("location_access_log").delete().gte("viewed_at", started);
  });
});

test("location: off by default, needs consent, records only work events with dedupe", async () => {
  const [admin, dev] = await Promise.all([bosUserFor("admin@taysonsta.local"), bosUserFor("youssef.dev@taysonsta.local")]);
  const cfg = await getSetting("location");
  await saveSetting("location", { ...cfg, enabled: false }, admin.userId);
  assert.equal((await recordLocation(dev, { event: "clock_in", latitude: 30.05, longitude: 31.24, accuracy: 20 })).recorded, false, "feature off");
  await assert.rejects(setLocationConsent(dev, true), ValidationError, "can't consent while off");

  await saveSetting("location", { ...cfg, enabled: true }, admin.userId);
  const { data: c0 } = await db().from("location_consents").select("*").eq("employee_id", dev.employee.id).maybeSingle();
  cleanup.push(async () => { if (c0) await db().from("location_consents").upsert(c0); else await db().from("location_consents").delete().eq("employee_id", dev.employee.id); });
  await db().from("location_consents").delete().eq("employee_id", dev.employee.id);
  assert.equal((await recordLocation(dev, { event: "clock_in", latitude: 30.05, longitude: 31.24, accuracy: 20 })).recorded, false, "no consent → nothing");

  await setLocationConsent(dev, true);
  assert.equal((await locationStatus(dev)).consented, true);
  await assert.rejects(recordLocation(dev, { event: "clock_in", latitude: 0, longitude: 0, accuracy: 5 }), ValidationError, "invalid coordinates");
  const r = await recordLocation(dev, { event: "clock_in", latitude: 30.0454, longitude: 31.2367, accuracy: 25 });
  assert.equal(r.recorded, true);
  assert.equal((await recordLocation(dev, { event: "clock_in", latitude: 30.0454, longitude: 31.2367, accuracy: 25 })).recorded, false, "dedupe within 2 minutes");
  assert.equal((await recordLocation(dev, { event: "task_checkin", latitude: 30.05, longitude: 31.24, accuracy: 10 })).recorded, false, "task check-ins off");

  // A new purpose text invalidates old consent.
  await saveSetting("location", { ...(await getSetting("location")), purpose_text: `${cfg.purpose_text} ${uniq("v")}`, purpose_version: cfg.purpose_version + 1 }, admin.userId);
  const st = await locationStatus(dev);
  assert.equal(st.consented, false);
  assert.equal(st.needsReconsent, true);
  assert.equal((await recordLocation(dev, { event: "clock_out", latitude: 30.05, longitude: 31.24, accuracy: 10 })).recorded, false);
  await setLocationConsent(dev, true);
  await setLocationConsent(dev, false);
  assert.equal((await recordLocation(dev, { event: "clock_out", latitude: 30.05, longitude: 31.24, accuracy: 10 })).recorded, false, "withdrawn");
});

test("location views: own always; others need location.read; every view logged; own deletion; retention", async () => {
  const [admin, dev, sara] = await Promise.all([bosUserFor("admin@taysonsta.local"), bosUserFor("youssef.dev@taysonsta.local"), bosUserFor("sara@taysonsta.local")]);
  const today = new Date().toISOString().slice(0, 10);
  const { data: p } = await db().from("employee_locations").insert({ employee_id: dev.employee.id, event: "clock_in", latitude: 30.1, longitude: 31.3 }).select("id").single();
  const mine = await viewLocations(dev, { employeeId: dev.employee.id, from: today, to: today });
  assert.ok(mine.some((x) => x.id === p!.id));
  if (!sara.permissions.get("location.read")) await assert.rejects(viewLocations(sara, { employeeId: dev.employee.id, from: today, to: today }), ForbiddenError, "location permission is separate from HR");
  const seen = await viewLocations(admin, { employeeId: dev.employee.id, from: today, to: today });
  assert.ok(seen.some((x) => x.id === p!.id));
  const { count } = await db().from("location_access_log").select("id", { count: "exact", head: true }).eq("viewer_user_id", admin.userId).eq("employee_id", dev.employee.id);
  assert.ok((count ?? 0) >= 1, "access logged");

  const { data: old } = await db().from("employee_locations").insert({ employee_id: dev.employee.id, event: "clock_out", latitude: 30.1, longitude: 31.3, captured_at: new Date(Date.now() - 400 * 86400_000).toISOString() }).select("id").single();
  await purgeLocations();
  assert.equal((await db().from("employee_locations").select("id").eq("id", old!.id).maybeSingle()).data, null, "past retention removed");
  assert.ok((await deleteMyLocations(dev)) >= 1);
  assert.equal((await viewLocations(dev, { employeeId: dev.employee.id, from: today, to: today })).length, 0);
});
