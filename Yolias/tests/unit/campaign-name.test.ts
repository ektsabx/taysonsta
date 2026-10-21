import { test } from "node:test";
import assert from "node:assert/strict";
import { shortCampaignName } from "../../lib/outreach/campaign-name.ts";

test("campaign names: short name only, dates and agent suffixes out, stored name untouched", () => {
  assert.equal(shortCampaignName("Campaign Oct 19"), "Campaign");
  assert.equal(shortCampaignName("حملة 20 أكتوبر"), "حملة");
  assert.equal(shortCampaignName("وكالات التسويق في دبي - وكيل المبيعات بالذكاء الاصطناعي"), "وكالات التسويق في دبي");
  assert.equal(shortCampaignName("SaaS founders · AI Sales Agent"), "SaaS founders");
  assert.equal(shortCampaignName("Clinics in Riyadh"), "Clinics in Riyadh");
  assert.equal(shortCampaignName("Oct 19"), "Oct 19", "a name that is only a date stays");
  assert.equal(shortCampaignName("A".repeat(60)).length, 40);
  assert.equal(shortCampaignName(null), "");
});
