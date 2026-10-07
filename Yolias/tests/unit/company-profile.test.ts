import { test } from "node:test";
import assert from "node:assert/strict";
import { businessLines, companyProfileSchema } from "../../lib/company-profile.ts";

const e = { company: "company", website: "website", offering: "offering", industry: "industry", targetMarkets: "markets" };

test("company profile: required fields, cleaned website, optional ideal customer", () => {
  const ok = companyProfileSchema(e).safeParse({ name: "Nile CRM", website: "https://nilecrm.com/", industry: "B2B software", offering: "A simple CRM for small sales teams", ideal_customer: "", target_markets: "Egypt, KSA" });
  assert.ok(ok.success);
  assert.equal(ok.data.website, "nilecrm.com");
  assert.equal(ok.data.ideal_customer, null);
  const missing = companyProfileSchema(e).safeParse({ name: "Nile CRM", website: "nilecrm.com", industry: "", offering: "A simple CRM for small sales teams", ideal_customer: "", target_markets: "" });
  assert.equal(missing.success, false);
  assert.equal(missing.error?.issues[0].message, "industry");
});

test("business lines for the AI include only filled fields", () => {
  const text = businessLines({ name: "Nile CRM", website: null, industry: "B2B software", offering: "CRM", ideal_customer: "Sales directors", target_markets: "Egypt" });
  assert.equal(text, "Company: Nile CRM\nIndustry: B2B software\nProducts and services: CRM\nIdeal customer profile: Sales directors\nTarget markets: Egypt");
});
