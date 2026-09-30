import { test } from "node:test";
import assert from "node:assert/strict";
import { composeText, engagementRate, extractHashtags, platforms, platformKeys, validateTarget } from "@/lib/bos/social/platforms";

// Master upgrade Phase 10 (docs/bos/30 §12): capability matrix, per-platform
// validation, hashtag composition, engagement-rate definition.
test("capability matrix: API only where an official publish API is wired", () => {
  const api = platformKeys.filter((p) => platforms[p].publish === "api").sort();
  assert.deepEqual(api, ["facebook", "instagram", "telegram"]);
  for (const p of platformKeys) {
    assert.ok(platforms[p].note.length > 10, `${p} explains itself`);
    if (platforms[p].publish === "api") assert.ok(platforms[p].provider, `${p} names its provider`);
  }
  assert.deepEqual(platforms.telegram.metrics, [], "Bot API exposes no post metrics → manual only");
});

test("validation per platform: limits, required media, https media, hashtag cap", () => {
  assert.ok(validateTarget("x", "a".repeat(281), []).errors.length);
  assert.equal(validateTarget("x", "a".repeat(280), []).errors.length, 0);
  assert.ok(validateTarget("instagram", "hello", []).errors.some((e) => e.includes("صورة")));
  assert.equal(validateTarget("instagram", "hello", [{ url: "https://cdn.example.com/a.jpg", type: "image" }]).errors.length, 0);
  assert.ok(validateTarget("facebook", "hi", [{ url: "http://insecure/a.jpg", type: "image" }]).errors.length);
  assert.ok(validateTarget("instagram", Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" "), [{ url: "https://c/a.jpg", type: "image" }]).errors.length);
  assert.ok(validateTarget("telegram", "a".repeat(1100), [{ url: "https://c/a.jpg", type: "image" }]).errors.length, "caption limit with media");
  assert.equal(validateTarget("telegram", "a".repeat(1100), []).errors.length, 0);
  assert.ok(validateTarget("linkedin", "hi", []).warnings.some((w) => w.includes("يدوي")));
  assert.ok(validateTarget("facebook", "", []).errors.length, "empty post");
});

test("hashtags appended once, per-platform version overrides the base text", () => {
  assert.equal(composeText("Launch day #Taysonsta", null, ["taysonsta", "design"]), "Launch day #Taysonsta\n\n#design");
  assert.equal(composeText("Base", "Short for X", ["a"]), "Short for X\n\n#a");
  assert.deepEqual(extractHashtags("#A #a #تصميم"), ["#a", "#تصميم"]);
});

test("engagement rate uses reach, then impressions/views; null without a base", () => {
  assert.equal(engagementRate({ likes: 40, comments: 5, shares: 3, saves: 2, reach: 1000 }), 5);
  assert.equal(engagementRate({ likes: 10, impressions: 200 }), 5);
  assert.equal(engagementRate({ likes: 10 }), null);
});
