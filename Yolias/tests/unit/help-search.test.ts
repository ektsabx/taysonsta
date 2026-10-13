import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreDoc } from "../../lib/support/help-search-score.ts";

const doc = { title: "Exporting prospects to CSV", summary: "Download saved prospects as a spreadsheet.", blocks: [{ p: "Open Prospects, select rows and press Export." }] };

test("help search: every word must appear; titles weigh most", () => {
  assert.ok(scoreDoc(doc, ["export"]) > scoreDoc(doc, ["rows"]));
  assert.equal(scoreDoc(doc, ["export", "invoice"]), 0);
  const ar = { title: "تصدير العملاء المحتملين", summary: "تنزيل القائمة", blocks: [] };
  assert.ok(scoreDoc(ar, ["تصدير"]) > 0);
});
