import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDiscovery, roleOf, type LeadRow } from "../../lib/analytics/discovery.ts";

const lead = (o: Partial<LeadRow>): LeadRow => ({ kind: "person", companyId: "c1", title: "CEO", match: 85, emailFound: true, ...o });

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

test("totals, average match, emails, decision makers and activity are counted from the leads", () => {
  const rows = [
    lead({}),
    lead({ title: "Sales Manager", match: 65, companyId: "c2" }),
    lead({ kind: "company", title: null, match: 40, emailFound: false }),
    lead({ kind: "company", title: null, match: null, emailFound: false }),
  ];
  const r = computeDiscovery(rows, 5, { leads: 2, companies: 0, decisionMakers: 1 }, { searches: 1, enrichments: 0, exports: 2, csvExports: 2, emailsPrepared: 1, messagesPrepared: 1 });
  assert.equal(r.totals.leads, 4);
  assert.equal(r.totals.vsPrevious.leads, 100);
  assert.equal(r.totals.vsPrevious.companies, null);
  assert.deepEqual(r.icp, { scored: 3, avgMatch: 63 });
  assert.equal(r.emailFound, 2);
  assert.equal(r.decisionMakers.perCompany, 1);
  assert.equal(r.activity.qualifications, 3);
  // The removed panels' data is no longer computed (owner, 2026-10-20).
  for (const k of ["trend", "funnel", "markets", "distribution", "dataQuality", "sources"]) assert.equal(k in r, false, k);
});
