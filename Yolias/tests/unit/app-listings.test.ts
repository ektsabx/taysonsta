import { test } from "node:test";
import assert from "node:assert/strict";
import { listingOf, isAppKey } from "../../lib/app-listings.ts";

test("an integration keeps its defaults until Admin changes them", () => {
  const d = listingOf("pixel-helper", null, "ar");
  assert.deepEqual(d.screenshots, ["/integrations/pixel-helper-ar.png"]);
  assert.equal(d.downloadUrl, "/downloads/yolias-pixel-helper.zip");
  assert.equal(d.storeUrl, null);
  const s = listingOf("pixel-helper", { "pixel-helper": { screenshots: ["https://x/a.png"], version: "1.2.0", download_url: "https://x/a.zip", store_url: "https://chromewebstore.google.com/detail/x" } }, "en");
  assert.deepEqual(s, { screenshots: ["https://x/a.png"], version: "1.2.0", downloadUrl: "https://x/a.zip", storeUrl: "https://chromewebstore.google.com/detail/x" });
  assert.equal(isAppKey("gmail"), true);
  assert.equal(isAppKey("nope"), false);
});
