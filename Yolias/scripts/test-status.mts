// Status page (D-181) against the local Supabase: npm run test:status
// Checks run and are recorded with a daily rollup; one failed check isn't an
// outage, two are; a stopped checker shows "no data", never green; an open
// incident sets its impact; the public data has no internal check details.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_STATUS_SETTINGS, rateStatus, runStatusChecks } from "@/lib/status/checks.ts";
import { incidentActive, measured, statusPage, worst } from "@/lib/status/index.ts";
import type { Database } from "@/types/database.ts";
(await import("@/lib/integrations.ts")).setIntegrationsForTests({});

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
assert.match(url, /127\.0\.0\.1|localhost/, "local database only");
const db = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const s = DEFAULT_STATUS_SETTINGS;
const now = Date.now();
const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
let incidentId: string | null = null;

try {
  // Rules (pure).
  const comp = { check_kind: "database" as const, check_enabled: true };
  assert.equal(measured({ ...comp, last_status: "major_outage", last_checked_at: iso(60_000), fail_streak: 1 }, s, now), "operational", "one failed check is transient");
  assert.equal(measured({ ...comp, last_status: "major_outage", last_checked_at: iso(60_000), fail_streak: 2 }, s, now), "major_outage");
  assert.equal(measured({ ...comp, last_status: "operational", last_checked_at: iso(3 * 3600_000), fail_streak: 0 }, s, now), "no_data", "stale checks are not green");
  assert.equal(measured({ ...comp, last_status: null, last_checked_at: null, fail_streak: 0 }, s, now), "no_data");
  assert.equal(worst(["operational", "degraded", "no_data"]), "degraded");
  assert.equal(rateStatus(0, 2, s), "no_data", "too little traffic to judge");
  assert.equal(rateStatus(6, 10, s), "partial_outage");
  assert.equal(rateStatus(1, 20, s), "operational");
  assert.equal(incidentActive({ kind: "maintenance", status: "scheduled", scheduled_for: iso(-3600_000), scheduled_until: null }, now), false, "future maintenance isn't active yet");
  assert.equal(incidentActive({ kind: "incident", status: "monitoring", scheduled_for: null, scheduled_until: null }, now), true);

  // Real checks against the local services.
  const n = await runStatusChecks();
  assert.ok(n >= 5, `checks recorded (${n})`);
  const { data: dbComp } = await db.from("status_components").select("*").eq("id", "database").single();
  assert.equal(dbComp!.last_status, "operational", "the database answers");
  assert.ok(dbComp!.last_latency_ms !== null);
  const { data: day } = await db.from("status_daily").select("total").eq("component_id", "database").eq("day", new Date().toISOString().slice(0, 10)).single();
  assert.ok(day!.total >= 1, "daily rollup");

  // An incident on discovery shows on the page with its update.
  const { data: inc } = await db.from("status_incidents").insert({ title: "Searches are slow (test)", impact: "partial_outage", status: "investigating", components: ["discovery"], created_by: "test" }).select("id").single();
  incidentId = inc!.id;
  await db.from("status_incident_updates").insert({ incident_id: inc!.id, status: "investigating", body: "We are looking into slow searches.", created_by: "test" });
  const page = await statusPage("en");
  const disc = page.components.find((c) => c.id === "discovery")!;
  assert.equal(disc.status, "partial_outage", "incident impact applies");
  assert.equal(page.active.length >= 1, true);
  assert.equal(page.active.find((i) => i.id === inc!.id)!.updates[0].body, "We are looking into slow searches.");
  assert.equal(page.components.find((c) => c.id === "database")!.days.length, 90);
  assert.ok(!JSON.stringify(page.components).includes("queue_age"), "internal check details stay private");

  // Resolved: off the active list, in the history.
  await db.from("status_incidents").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", inc!.id);
  const after = await statusPage("en");
  assert.ok(!after.active.some((i) => i.id === inc!.id));
  assert.ok(after.past.some((i) => i.id === inc!.id));
  console.log("✓ status: transient failures, stale = no data, real checks + daily rollup, incidents override and resolve, no internal details");
} finally {
  if (incidentId) {
    await db.from("status_incident_updates").delete().eq("incident_id", incidentId);
    await db.from("status_incidents").delete().eq("id", incidentId);
  }
}
