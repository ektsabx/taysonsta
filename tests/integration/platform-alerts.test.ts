// Platform alerts (2026-10-12, services/yolias/alerts.ts): real measurements
// from the local Yolias database, a crossed threshold raises one
// "platform.alert" event that notifies Super Admins / Admins, and the same
// alert isn't sent twice in the same incident (same day and severity).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/bos/db";
import { getSetting, saveSetting } from "@/lib/bos/settings";
import { checkPlatformAlerts, measureAlerts } from "@/services/yolias/alerts";

const before = await getSetting("platform_alerts");
let actor: string | null = null;
after(async () => {
  await saveSetting("platform_alerts", before, actor ?? "00000000-0000-0000-0000-000000000000").catch(() => {});
});

test("alerts: measured from real data, raised once per incident, delivered to admins", async () => {
  assert.match(process.env.YOLIAS_SUPABASE_URL ?? "", /127\.0\.0\.1|localhost/, "local Yolias database only");
  const c = db();
  const { data: admin } = await c.from("employees").select("user_id").eq("email", "admin@taysonsta.local").single();
  actor = admin!.user_id;

  // Real numbers: the database size is what Postgres reports (> 1 MB locally).
  const measured = await measureAlerts({ ...before, db_limit_mb: 100_000 });
  const db1 = measured.find((a) => a.key === "db_size")!;
  assert.ok(db1.value > 1, "database size measured");
  assert.equal(db1.severity, "ok");
  assert.equal(measured.length, 5);

  // A limit below the real size → critical, one event, notifications for admins.
  await saveSetting("platform_alerts", { ...before, enabled: true, db_limit_mb: 1, db_warn_pct: 80 }, actor!);
  const day = new Date().toISOString().slice(0, 10);
  const key = `platform.alert:db_size:critical:${day}`;
  await c.from("activity_events").delete().eq("dedupe_key", key);
  await checkPlatformAlerts();
  const { data: ev } = await c.from("activity_events").select("id, payload").eq("dedupe_key", key);
  assert.equal(ev!.length, 1, "one alert");
  const p = ev![0].payload as Record<string, unknown>;
  assert.equal(p.severity, "critical"); assert.equal(p.service, "Supabase"); assert.ok(p.at && p.detail_en && p.detail_ar);
  assert.ok(!JSON.stringify(p).match(/key|secret|token|@/i), "no secrets or personal data in the alert");
  const { data: notes } = await c.from("bos_notifications").select("id").eq("user_id", actor!).eq("event_id", ev![0].id);
  assert.ok((notes ?? []).length >= 1, "an admin is notified");

  // The same incident again: nothing new.
  await checkPlatformAlerts();
  const { data: again } = await c.from("activity_events").select("id").eq("dedupe_key", key);
  assert.equal(again!.length, 1, "not repeated");

  // Switched off: nothing is raised.
  await saveSetting("platform_alerts", { ...before, enabled: false, db_limit_mb: 1 }, actor!);
  assert.equal(await checkPlatformAlerts(), 0);
  await c.from("activity_events").delete().eq("dedupe_key", key);
});
