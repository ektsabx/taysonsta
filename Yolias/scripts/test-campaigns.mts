// End-to-end test of continuous campaigns (final spec phase 6) against the
// local Supabase, with a stand-in adapter registered only in this process:
//   npm run test:campaigns
// Covers: runs toward a goal across scheduled runs, later runs asking the
// source for the next candidates (offset), cumulative totals, run lineage,
// the scheduler, a pause being respected, and the deadline closing a campaign.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { adapters } from "@/lib/intel/adapters/index.ts";
import { syncRegistry } from "@/lib/intel/registry.ts";
import { runDiscovery } from "@/lib/discovery/pipeline.ts";
import { scheduleCampaigns } from "@/lib/jobs/worker.ts";
import type { IcpCriteria } from "@/lib/discovery/icp.ts";
import type { Database } from "@/types/database.ts";
// Never the owner's real keys from Yolias Admin → Integrations (D-132): no LLM keys in this test.
(await import("@/lib/integrations.ts")).setIntegrationsForTests({});

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = createClient<Database>(url, svc, { auth: { persistSession: false } });
const intel = createClient(url, svc, { auth: { persistSession: false }, db: { schema: "intel" } });
const ID = "yolias_test_campaigns";
const tag = Date.now().toString(36);
const offsets: number[] = [];

adapters.push({
  id: ID, name: "Test stub (test process only)", needsCredential: false,
  handlers: {
    // Two new companies per call, paged by offset — like a real source's next page.
    "company.search": async ({ offset = 0 }) => {
      offsets.push(offset);
      return {
        data: [offset, offset + 1].map((i) => ({
          name: `Paged Co ${i} ${tag}`, domain: `paged${i}-${tag}.yolias-test.example`, industry: "SaaS", description: null, city: "Riyadh", country: "SA",
          employeeCount: 50, fundingStage: null, fundingTotalUsd: null, hiringRoles: null, signals: [], sourceRef: `p${i}-${tag}`, phone: "+966 11 222 2222",
        })),
        units: 1,
      };
    },
  },
});

const icp: IcpCriteria = {
  search_type: "companies", lookalike_seeds: [], campaign_name: "Continuous test", summary: "t", target_count: 5, target_unit: "companies",
  countries: ["SA"], cities: [], industries: ["SaaS"], keywords: [], employees_min: null, employees_max: null, job_titles: [], seniorities: [],
  hiring: null, hiring_roles: [], funding_stages: [], technologies: [], exclusions: [], assumptions: [],
};

let userId: string | null = null;
let wsId: string | null = null;
const campaign = async (id: string) => (await db.from("campaigns").select("*").eq("id", id).single()).data!;
const runDue = async (id: string) => {
  await db.from("campaigns").update({ next_run_at: new Date(Date.now() - 1000).toISOString() }).eq("id", id);
  assert.ok((await scheduleCampaigns()) >= 1, "scheduler queues the due campaign");
  assert.equal((await campaign(id)).status, "queued");
  await runDiscovery(id);
};

try {
  await syncRegistry();
  await intel.from("providers").update({ enabled: true, storage_allowed: true }).eq("id", ID);
  const { data: created, error } = await db.auth.admin.createUser({ email: `campaigns-${tag}@yolias.local`, email_confirm: true });
  if (error) throw error;
  userId = created.user.id;
  wsId = (await db.from("profiles").select("workspace_id").eq("id", userId).single()).data!.workspace_id!;
  await db.from("workspaces").update({ plan: "free", subscription_status: "active" }).eq("id", wsId);

  // Goal 5, continuous daily: 2 per run → scheduled, scheduled, completed.
  const { data: c } = await db.from("campaigns").insert({
    workspace_id: wsId, name: icp.campaign_name, criteria: icp as never, search_type: "companies", quota: 5, status: "queued", continuous: true, run_every_hours: 24,
  }).select("id").single();
  const id = c!.id;
  await runDiscovery(id);
  let cur = await campaign(id);
  assert.equal(cur.status, "scheduled");
  assert.equal(cur.prospects_found, 2);
  assert.ok(cur.next_run_at && new Date(cur.next_run_at).getTime() > Date.now() + 23 * 3_600_000);

  // Not due yet → the scheduler leaves it alone.
  await scheduleCampaigns();
  assert.equal((await campaign(id)).status, "scheduled");

  await runDue(id);
  cur = await campaign(id);
  assert.equal(cur.prospects_found, 4);
  assert.equal(cur.status, "scheduled");

  await runDue(id);
  cur = await campaign(id);
  assert.equal(cur.prospects_found, 5);
  assert.equal(cur.status, "completed");
  assert.equal(cur.runs_count, 3);
  assert.deepEqual(offsets, [0, 2, 4], "later runs ask for the next candidates");

  // Run lineage: every result knows its run; runs know what they delivered.
  const { data: runs } = await db.from("campaign_runs").select("id, delivered").eq("campaign_id", id).order("id");
  assert.deepEqual(runs!.map((r) => r.delivered), [2, 2, 1]);
  const { data: rows } = await db.from("companies").select("run_id").eq("campaign_id", id);
  assert.equal(rows!.length, 5);
  assert.ok(rows!.every((r) => runs!.some((x) => x.id === r.run_id)));
  const { data: used } = await db.rpc("campaign_usage", { p_campaign: id });
  assert.equal(used![0].consumed, 5);
  assert.equal(used![0].reserved, 0, "nothing stays reserved between runs");

  // A paused campaign is never picked up by the scheduler.
  const { data: c2 } = await db.from("campaigns").insert({
    workspace_id: wsId, name: "Paused", criteria: { ...icp, industries: ["Paused"] } as never, search_type: "companies", quota: 10, status: "paused", continuous: true, next_run_at: new Date(Date.now() - 1000).toISOString(),
  }).select("id").single();
  await scheduleCampaigns();
  assert.equal((await campaign(c2!.id)).status, "paused");

  // Deadline passed while waiting → partial, reason "deadline".
  const { data: c3 } = await db.from("campaigns").insert({
    workspace_id: wsId, name: "Late", criteria: icp as never, search_type: "companies", quota: 10, status: "scheduled", continuous: true,
    deadline: new Date(Date.now() - 1000).toISOString(), next_run_at: new Date(Date.now() - 1000).toISOString(),
  }).select("id").single();
  await scheduleCampaigns();
  const late = await campaign(c3!.id);
  assert.equal(late.status, "partial");
  assert.equal(late.partial_reason, "deadline");

  console.log("✓ continuous campaigns: scheduled runs to the goal, next candidates, lineage, usage, pause, deadline");
} finally {
  if (wsId) await db.from("workspaces").delete().eq("id", wsId);
  if (userId) await db.auth.admin.deleteUser(userId);
  const { data: ids } = await intel.from("company_identifiers").select("company_id").like("value", `%${tag}%`);
  const companyIds = [...new Set((ids ?? []).map((r: { company_id: string }) => r.company_id))];
  if (companyIds.length) {
    await intel.from("field_values").delete().in("entity_id", companyIds);
    await intel.from("companies").delete().in("id", companyIds);
  }
  await intel.from("search_cache").delete().eq("provider", ID);
  await intel.from("provider_calls").delete().eq("provider", ID);
  await intel.from("providers").delete().eq("id", ID);
}
