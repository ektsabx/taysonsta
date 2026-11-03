import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze, rates } from "../../lib/ai-visibility/analyze.ts";

const competitors = [{ name: "Apollo.io" }, { name: "Clay" }, { name: "Instantly" }, { name: "Hunter" }];

test("brands in the order they first appear", () => {
  const a = analyze("Top picks: Apollo for data, then Yolias to book meetings, and Clay.", [], competitors);
  assert.deepEqual(a.brands, ["Apollo.io", "Yolias", "Clay"]);
  assert.equal(a.mentioned, true);
  assert.equal(a.firstPick, false);
});

test("ordinary words are not brands", () => {
  const a = analyze("You can instantly find a hunter of deals and clay models.", [], competitors);
  assert.deepEqual(a.brands, []);
  assert.equal(a.mentioned, false);
});

test("Arabic name and first pick", () => {
  const a = analyze("أفضل خيار هو يولياس، ثم Apollo.io.", [], competitors);
  assert.equal(a.firstPick, true);
  assert.deepEqual(a.brands, ["Yolias", "Apollo.io"]);
});

test("citation by link or by domain in the text", () => {
  assert.equal(analyze("x", ["https://www.yolias.com/pricing"], []).cited, true);
  assert.equal(analyze("x", ["https://notyolias.com"], []).cited, false);
  assert.equal(analyze("See yolias.com for details", [], []).cited, true);
});

test("rates and share", () => {
  const r = rates([
    { engine: "openai", mentioned: true, first_pick: true, cited: false, brands: ["Yolias", "Clay"] },
    { engine: "gemini", mentioned: false, first_pick: false, cited: false, brands: ["Clay"] },
  ]);
  assert.equal(r.mentionRate, 0.5);
  assert.equal(r.firstRate, 0.5);
  assert.equal(r.citationRate, 0);
  assert.deepEqual(r.share[0], { name: "Clay", mentions: 2, share: 2 / 3 });
  assert.equal(rates([]).mentionRate, null);
});
