// Master upgrade Phase 13 (docs/bos/30 §17; doc 31): Deal Radar over the real
// CRM — signals from activities / proposals / contracts / risks, weighted vs
// actual value per currency, intervention threshold, scope, actions (follow-
// up, reschedule, assign, nudge, risks), AI reading marked as an estimate.
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/bos/db";
import { bosUserFor, uniq } from "@/tests/integration/helpers";
import { getSetting, saveSetting } from "@/lib/bos/settings";
import { addFollowUp, addRisk, assignDealOwner, changeFollowUpDate, dealRadar, explainDeal, nudgeOwner, radarAlerts, resolveRisk } from "@/services/bos/deal-radar";
import { ForbiddenError, ValidationError } from "@/lib/bos/errors";

const cleanup: (() => PromiseLike<unknown>)[] = [];
after(async () => {
  for (const fn of cleanup.reverse()) await Promise.resolve(fn()).catch((e) => console.error("cleanup", e));
});

let dealId = "";
let sara = "";
const iso = (d: number) => new Date(Date.now() + d * 86400_000).toISOString();

before(async () => {
  const [admin, s] = await Promise.all([bosUserFor("admin@taysonsta.local"), bosUserFor("sara@taysonsta.local")]);
  sara = s.userId;
  const before = await getSetting("deal_radar");
  await saveSetting("deal_radar", { ...before, intervention_value: 100000 }, admin.userId);
  cleanup.push(() => saveSetting("deal_radar", before, admin.userId));
  const { data: stage } = await db().from("pipeline_stages").select("id, pipeline_id").eq("key", "proposal").gt("probability", 0).limit(1).single();
  const { data: client } = await db().from("clients").select("id").is("archived_at", null).limit(1).single();
  const { data: deal } = await db().from("deals").insert({ name: uniq("Radar deal"), client_id: client!.id, pipeline_id: stage!.pipeline_id, stage_id: stage!.id, value: 150000, currency: "EGP", expected_close_date: iso(-10).slice(0, 10), assigned_to: sara, created_by: sara }).select("id").single();
  dealId = deal!.id;
  cleanup.push(async () => {
    await db().from("notifications").delete().eq("entity_id", dealId);
    await db().from("activities").delete().eq("deal_id", dealId);
    await db().from("proposals").delete().eq("deal_id", dealId);
    await db().from("deals").delete().eq("id", dealId);
  });
  await db().from("activities").insert([
    { type: "email", title: "Client asked about timeline", direction: "inbound", deal_id: dealId, client_id: client!.id, status: "completed", completed_at: iso(-3), created_by: sara, assigned_to: sara },
    { type: "follow_up", title: "Send revised quote", deal_id: dealId, client_id: client!.id, status: "pending", due_at: iso(-1), created_by: sara, assigned_to: sara },
  ]);
  await db().from("proposals").insert({ client_id: client!.id, deal_id: dealId, slug: uniq("radar-prop").toLowerCase(), title: "Proposal", status: "viewed", created_by: sara });
});

test("radar signals come from the CRM, estimate is explained, values stay per currency", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const r = await dealRadar(admin, {});
  const d = r.rows.find((x) => x.id === dealId)!;
  assert.ok(d, "on the radar");
  const keys = d.score.contributions.map((c) => c.key);
  for (const k of ["proposal_viewed", "client_replied", "recent_activity", "followup_overdue", "close_overdue", "no_next_step"]) assert.ok(keys.includes(k), k);
  assert.equal(d.flags.overdue, true);
  assert.equal(d.flags.intervention, true, "150k ≥ 100k threshold and overdue");
  assert.equal(d.weighted, Math.round(150000 * d.score.estimate) / 100);
  assert.ok(d.score.estimate % 5 === 0 && d.score.estimate >= 5 && d.score.estimate <= 95);
  const egp = r.summary.nearClosing.find((x) => x.currency === "EGP");
  assert.ok(egp && egp.value >= 150000 && egp.weighted < egp.value, "actual vs weighted apart");
  assert.ok(r.summary.nearClosing.every((x) => typeof x.currency === "string"), "grouped by currency");
  const overdueOnly = await dealRadar(admin, { flag: "overdue" });
  assert.ok(overdueOnly.rows.every((x) => x.flags.overdue));
});

test("scope: owners see their deals; others don't", async () => {
  const [s, ahmed] = await Promise.all([bosUserFor("sara@taysonsta.local"), bosUserFor("ahmed@taysonsta.local")]);
  assert.ok((await dealRadar(s, {})).rows.some((x) => x.id === dealId));
  const scope = ahmed.permissions.get("deals.read");
  if (scope !== "all") {
    assert.ok(!(await dealRadar(ahmed, {})).rows.some((x) => x.id === dealId));
    await assert.rejects(nudgeOwner(ahmed, dealId, "hi"), ForbiddenError);
  }
});

test("actions on the existing CRM: follow-up, reschedule, assign, nudge, risks; AI reading is an estimate", async () => {
  const [admin, s] = await Promise.all([bosUserFor("admin@taysonsta.local"), bosUserFor("sara@taysonsta.local")]);
  const act = await addFollowUp(s, dealId, { type: "call", title: "Call decision maker", due_at: iso(2) });
  const { data: a } = await db().from("activities").select("deal_id, status, type").eq("id", act.id).single();
  assert.equal(a!.deal_id, dealId);
  assert.equal(a!.type, "call");
  await changeFollowUpDate(s, act.id, iso(4));
  await assert.rejects(changeFollowUpDate(s, act.id, "not a date"), ValidationError);
  const r = (await dealRadar(admin, {})).rows.find((x) => x.id === dealId)!;
  assert.ok(!r.score.contributions.some((c) => c.key === "no_next_step"), "next step now scheduled");

  if (!s.permissions.get("deals.assign")) await assert.rejects(assignDealOwner(s, dealId, admin.userId), ForbiddenError);
  await assignDealOwner(admin, dealId, sara);
  await nudgeOwner(admin, dealId, "Please call the client today");
  const { count } = await db().from("notifications").select("id", { count: "exact", head: true }).eq("user_id", sara).eq("entity_id", dealId);
  assert.ok((count ?? 0) >= 1, "owner notified");

  const riskId = await addRisk(admin, dealId, "blocker", "Waiting for budget approval");
  const withRisk = (await dealRadar(admin, {})).rows.find((x) => x.id === dealId)!;
  assert.ok(withRisk.score.contributions.some((c) => c.key === "blockers"));
  await resolveRisk(admin, riskId);
  cleanup.push(() => db().from("deal_risks").delete().eq("deal_id", dealId));

  const ex = await explainDeal(admin, dealId, "en", { generate: async (req) => {
    assert.match(req.system!, /ESTIMATE/);
    assert.match(req.prompt, /Proposal viewed|العميل فتح العرض/);
    return { ok: true, text: JSON.stringify({ summary: "Warm but late.", signals_used: ["proposal viewed"], next_steps: ["Call"], caveats: [] }), provider: "anthropic", model: "stub", inputTokens: 1, outputTokens: 1, costUsd: 0, fallbackFrom: [] };
  } });
  assert.ok(ex.caveats.some((c) => c.includes("تقدير")), "always marked as an estimate");
});

test("daily radar alert reaches the owner once a day (sweep)", async () => {
  const started = new Date().toISOString();
  cleanup.push(async () => {
    const { data: ev } = await db().from("activity_events").select("id").eq("event_type", "deal.radar_alert").gte("occurred_at", started);
    const ids = (ev ?? []).map((e) => e.id);
    if (ids.length) {
      await db().from("notifications").delete().in("event_id", ids);
      await db().from("activity_events").delete().in("id", ids);
    }
  });
  await radarAlerts();
  const { count: first } = await db().from("activity_events").select("id", { count: "exact", head: true }).eq("event_type", "deal.radar_alert").eq("entity_id", dealId).gte("occurred_at", started);
  assert.equal(first, 1);
  const { count: notified } = await db().from("notifications").select("id", { count: "exact", head: true }).eq("user_id", sara).eq("entity_id", dealId).eq("event_type", "deal.radar_alert");
  assert.equal(notified, 1, "owner notified");
  await radarAlerts();
  const { count: second } = await db().from("activity_events").select("id", { count: "exact", head: true }).eq("event_type", "deal.radar_alert").eq("entity_id", dealId).gte("occurred_at", started);
  assert.equal(second, 1, "not repeated the same day");
});
