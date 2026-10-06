// End-to-end test of the entity layer and search types (final spec phase 4)
// against the local Supabase. A stand-in adapter is registered ONLY inside
// this test process (product code has no mock providers, rule 4); it is
// removed from the registry afterwards. Checks, per search type, what is
// delivered, the standard intelligence fields, usage and jobs:
//   npm run test:search-types
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { adapters } from "@/lib/intel/adapters/index.ts";
import type { ProviderAdapter } from "@/lib/intel/adapter.ts";
import { findDecisionMakers, runDiscovery } from "@/lib/discovery/pipeline.ts";
import { routeFor, syncRegistry } from "@/lib/intel/registry.ts";
import type { IcpCriteria } from "@/lib/discovery/icp.ts";
import type { CompanyCandidate } from "@/lib/discovery/types.ts";
import type { Database } from "@/types/database.ts";
// Never the owner's real keys from Yolias Admin → Integrations (D-132): no LLM keys in this test.
(await import("@/lib/integrations.ts")).setIntegrationsForTests({});

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = createClient<Database>(url, svc, { auth: { persistSession: false } });
const intel = createClient(url, svc, { auth: { persistSession: false }, db: { schema: "intel" } });
const ID = "yolias_test_stub";
const tag = Date.now().toString(36);
const seen: { lookalikeSeeds?: string[] } = {};

const company = (i: number, extra: Partial<CompanyCandidate> = {}): CompanyCandidate => ({
  name: `Test Co ${i} ${tag}`, domain: `co${i}-${tag}.yolias-test.example`, industry: "Fintech", description: "Payments", city: "Riyadh", country: "SA",
  employeeCount: 80, fundingStage: null, fundingTotalUsd: null, hiringRoles: null, signals: [], sourceRef: `c${i}-${tag}`, confidence: 0.9, ...extra,
});
const stub: ProviderAdapter = {
  id: ID, name: "Test stub (test process only)", needsCredential: false,
  handlers: {
    "company.search": async ({ limit }) => ({ data: [1, 2, 3, 4].slice(0, limit).map((i) => company(i)), units: 1 }),
    "company.lookalikes": async ({ seeds }) => {
      seen.lookalikeSeeds = seeds;
      return { data: [company(10), company(11, { domain: null, employeeCount: null })], units: 1 };
    },
    "place.search": async () => ({
      data: [
        company(20, { domain: null, industry: null, employeeCount: null, kind: "local_business", category: "Dental clinic", address: "King Fahd Rd", phone: "+966 11 000 0000", rating: 4.6, reviewsCount: 120, placeRef: `place-a-${tag}`, mapsUrl: "https://maps.example/a" }),
        company(21, { domain: null, industry: null, employeeCount: null, kind: "local_business", category: "Dental clinic", address: null, phone: null, placeRef: `place-b-${tag}` }),
      ],
      units: 1,
    }),
    "person.search": async ({ company: c }) => ({
      data: [{ fullName: `Sara ${c.name}`, title: "Head of Sales", email: `sara@${c.domain}`, phone: null, linkedinUrl: null, city: "Riyadh", country: "SA", sourceRef: null }],
      units: 1,
    }),
    "job.search": async ({ company: c }) => ({
      data: [{ title: "Sales Manager", department: "Sales", city: "Riyadh", country: "SA", url: `https://jobs.example/${c?.domain}/1`, postedAt: new Date().toISOString(), company: { name: c?.name ?? "", domain: c?.domain ?? null }, sourceRef: null }],
      units: 1,
    }),
  },
};
adapters.push(stub);

const icp = (type: IcpCriteria["search_type"], over: Partial<IcpCriteria> = {}): IcpCriteria => ({
  search_type: type, lookalike_seeds: [], campaign_name: `Test ${type}`, summary: "test", target_count: 3, target_unit: "prospects",
  countries: ["SA"], cities: ["Riyadh"], industries: ["Fintech"], keywords: [], employees_min: 10, employees_max: 200,
  job_titles: ["Head of Sales"], seniorities: [], hiring: null, hiring_roles: [], funding_stages: [], technologies: [], exclusions: [], assumptions: [], ...over,
});

let userId: string | null = null;
let wsId: string | null = null;
try {
  // Make the stub usable: enabled, storage allowed (D-113), no credential needed.
  await syncRegistry();
  const { error: provErr } = await intel.from("providers").update({ enabled: true, storage_allowed: true, display_allowed: true, customer_facing_allowed: true, redistribution_allowed: false }).eq("id", ID);
  if (provErr) throw provErr;
  const { decision } = await routeFor("company.search");
  assert.ok(decision.usable.some((u) => u.id === ID), `stub not routable: ${JSON.stringify(decision.skipped)}`);

  const { data: created, error } = await db.auth.admin.createUser({ email: `search-types-${tag}@yolias.local`, email_confirm: true });
  if (error) throw error;
  userId = created.user.id;
  wsId = (await db.from("profiles").select("workspace_id").eq("id", userId).single()).data!.workspace_id!;
  await db.from("workspaces").update({ plan: "free", subscription_status: "active" }).eq("id", wsId);

  async function run(type: IcpCriteria["search_type"], over: Partial<IcpCriteria> = {}) {
    const criteria = icp(type, over);
    const { data: c, error: e } = await db.from("campaigns").insert({ workspace_id: wsId!, name: criteria.campaign_name, criteria: criteria as never, search_type: type, quota: 3, status: "queued" }).select("id").single();
    if (e) throw e;
    await runDiscovery(c!.id);
    return (await db.from("campaigns").select("*").eq("id", c!.id).single()).data!;
  }
  const consumed = async () => (await db.rpc("usage_summary", { p_ws: wsId! })).data![0].consumed;

  // People: decision makers inside companies; companies stored as context (not billed).
  const people = await run("people", { hiring: true });
  assert.equal(people.status, "completed");
  const { data: ps } = await db.from("prospects").select("*").eq("campaign_id", people.id);
  assert.equal(ps!.length, 3);
  const p = ps![0];
  assert.ok(p.match_score! > 0);
  assert.equal(p.confidence, null);
  assert.ok(Array.isArray(p.provenance) && (p.provenance as { field: string; source: string }[]).some((x) => x.field === "email" && x.source === ID));
  assert.deepEqual([...p.missing_fields].sort(), ["linkedin_url", "phone"]);
  assert.ok(p.last_updated);
  const { data: jobs } = await db.from("jobs").select("*").eq("campaign_id", people.id);
  assert.equal(jobs!.length, 3, "one job per company (hiring search)");
  assert.equal(await consumed(), 3);

  // Companies: companies are the results and the billable unit.
  const comps = await run("companies");
  const { data: cs } = await db.from("companies").select("*").eq("campaign_id", comps.id);
  assert.equal(comps.status, "completed");
  assert.equal(cs!.length, 3);
  assert.ok(cs!.every((c) => c.kind === "company" && c.match_score != null && Number(c.confidence) === 0.9));
  assert.equal(await consumed(), 6);
  assert.equal((await db.from("jobs").select("id", { count: "exact", head: true }).eq("campaign_id", comps.id)).count, 0, "no job search unless hiring is asked");

  // Decision-maker matching on a delivered company: people saved straight to Prospects, billed, idempotent.
  const target = cs![0];
  const before = await consumed();
  await findDecisionMakers(wsId!, [target.id]);
  await findDecisionMakers(wsId!, [target.id]);
  const { data: found } = await db.from("prospects").select("*").eq("company_id", target.id);
  const fresh = found!.filter((x) => x.saved_at);
  const { data: after } = await db.from("companies").select("people_status, people_found").eq("id", target.id).single();
  assert.equal(after!.people_status, "done");
  assert.equal(after!.people_found, fresh.length);
  assert.equal(await consumed(), before + fresh.length);

  // Lookalikes: the seeds reach the provider; missing data is reported, never invented.
  const look = await run("company_lookalikes", { lookalike_seeds: ["tabby.ai", "Tamara"] });
  assert.deepEqual(seen.lookalikeSeeds, ["tabby.ai", "Tamara"]);
  const { data: ls } = await db.from("companies").select("*").eq("campaign_id", look.id).order("name");
  assert.equal(ls!.length, 2);
  assert.equal(look.status, "partial");
  assert.ok(ls![1].missing_fields.includes("domain") && ls![1].missing_fields.includes("employee_count"));

  // Local businesses: places with their own fields.
  const local = await run("local_businesses");
  const { data: lb } = await db.from("companies").select("*").eq("campaign_id", local.id).order("name");
  assert.equal(lb!.length, 2);
  assert.ok(lb!.every((c) => c.kind === "local_business"));
  assert.equal(lb![0].category, "Dental clinic"); assert.equal(Number(lb![0].rating), 4.6); assert.equal(lb![0].reviews_count, 120);
  assert.ok(lb![1].missing_fields.includes("phone") && lb![1].missing_fields.includes("address"));
  assert.ok((lb![0].match_reasons as string[]).includes("City"));

  // Paying twice for the same company is avoided across campaigns.
  const again = await run("companies");
  assert.equal((await db.from("companies").select("id", { count: "exact", head: true }).eq("campaign_id", again.id)).count, 1, "only the company not delivered before");

  console.log("✓ search types: people, companies, lookalikes, local businesses; intelligence fields; usage; jobs; no double delivery");
} finally {
  if (wsId) await db.from("workspaces").delete().eq("id", wsId);
  if (userId) await db.auth.admin.deleteUser(userId);
  const { data: ids } = await intel.from("company_identifiers").select("company_id").or(`value.like.%${tag}%`);
  const companyIds = [...new Set((ids ?? []).map((r: { company_id: string }) => r.company_id))];
  if (companyIds.length) {
    await intel.from("field_values").delete().in("entity_id", companyIds);
    await intel.from("companies").delete().in("id", companyIds);
  }
  await intel.from("search_cache").delete().eq("provider", ID);
  await intel.from("provider_calls").delete().eq("provider", ID);
  await intel.from("providers").delete().eq("id", ID);
}
