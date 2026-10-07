import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDiscovery, roleOf, type LeadRow } from "../../lib/analytics/discovery.ts";

const lead = (o: Partial<LeadRow>): LeadRow => ({
  kind: "person", companyId: "c1", country: "SA", city: "Riyadh", industry: "SaaS", employees: 120, title: "CEO", seniority: "c_level",
  match: 85, confidence: 0.8, emailFound: true, emailVerified: true, phoneFound: false, missing: ["phone"], source: "src_a",
  createdAt: new Date().toISOString(), selected: false, contacted: false, ...o,
});

test("job titles fall into decision-maker groups", () => {
  assert.equal(roleOf("Co-Founder & CEO"), "ceo");
  assert.equal(roleOf("Founder"), "founder");
  assert.equal(roleOf("CFO"), "cLevel");
  assert.equal(roleOf("VP Marketing"), "vp");
  assert.equal(roleOf("Head of Sales"), "director");
  assert.equal(roleOf("Sales Manager"), "manager");
  assert.equal(roleOf("المدير التنفيذي"), "ceo");
  assert.equal(roleOf(null), "other");
});

test("quality, ICP bands, funnel and markets are counted from the leads", () => {
  const since = new Date(Date.now() - 7 * 86_400_000);
  const rows = [
    lead({}),
    lead({ title: "Sales Manager", match: 65, emailVerified: false, selected: true, contacted: true, companyId: "c2" }),
    lead({ kind: "company", title: null, match: 40, emailFound: false, emailVerified: false, confidence: null, country: "EG", source: "src_b", missing: ["phone", "website"] }),
  ];
  const r = computeDiscovery(rows, 5, { leads: 2, companies: 0, decisionMakers: 1 }, { searches: 1, enrichments: 0, exports: 2, csvExports: 2, emailsPrepared: 1, messagesPrepared: 1 }, since, 7);
  assert.equal(r.totals.leads, 3);
  assert.equal(r.totals.vsPrevious.leads, 50);
  assert.equal(r.totals.vsPrevious.companies, null);
  assert.deepEqual([r.icp.strong, r.icp.good, r.icp.weak], [1, 1, 1]);
  assert.equal(r.dataQuality.emailVerified, 1);
  assert.equal(r.dataQuality.missing[0].field, "phone");
  assert.equal(r.dataQuality.missing[0].count, 3);
  assert.equal(r.decisionMakers.perCompany, 1);
  assert.deepEqual([r.funnel.discovered, r.funnel.qualified, r.funnel.selected, r.funnel.contacted, r.funnel.engaged], [3, 1, 1, 1, null]);
  assert.equal(r.markets[0].country, "SA");
  assert.equal(r.sources.find((s) => s.source === "src_b")?.confidence, null);
  assert.equal(r.activity.qualifications, 3);
  assert.equal(r.trend.buckets.reduce((a, b) => a + b.leads, 0), 3);
});
