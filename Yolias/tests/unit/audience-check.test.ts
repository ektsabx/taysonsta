import { test } from "node:test";
import assert from "node:assert/strict";
import { audienceIssues } from "../../lib/campaigns/audience-check.ts";

test("audience checks", () => {
  const good = { countries: { include: ["SA"] }, industries: { include: ["Real estate"] }, titles: { include: ["Head of Sales"] } };
  assert.deepEqual(audienceIssues(good, "people"), []);
  assert.deepEqual(audienceIssues({ ...good, countries: { include: ["SA"], exclude: ["sa"] } }, "people"), ["overlap"]);
  assert.deepEqual(audienceIssues({ countries: good.countries, industries: good.industries }, "people"), ["no_titles"]);
  assert.deepEqual(audienceIssues({ countries: good.countries, industries: good.industries }, "companies"), []);
  assert.deepEqual(audienceIssues({ titles: good.titles }, "people"), ["too_broad"]);
});
