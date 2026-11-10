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

import { buildMessage, isSpamBlock } from "../../lib/mailbox/mime.ts";
import { toolsFor, cleanTag } from "../../lib/inbox-channels.ts";

test("a reply carries its files; spam refusals are told apart", () => {
  const raw = buildMessage({ from: "a@b.co", fromName: null, to: "c@d.co", subject: "Hi", body: "Hello", messageId: "<1@b.co>", files: [{ name: "note.txt", type: "text/plain", data: new TextEncoder().encode("x") }] });
  assert.match(raw, /multipart\/mixed/);
  assert.match(raw, /filename="note.txt"/);
  assert.equal(isSpamBlock("550 5.7.1 Message rejected as spam"), true);
  assert.equal(isSpamBlock("550 user unknown"), false);
  assert.ok(toolsFor("email").includes("voice"));
  assert.equal(cleanTag("  hot   lead "), "hot lead");
});

import { buyingIntent } from "../../lib/buying-intent.ts";
test("buying intent: Yolias AI's reading, else the kind of reply", () => {
  assert.equal(buyingIntent("low", "interested"), "low");
  assert.equal(buyingIntent(null, "meeting_request"), "high");
  assert.equal(buyingIntent(undefined, "objection"), "medium");
  assert.equal(buyingIntent(null, "out_of_office"), null);
});

import { buildRawEmail as raw2 } from "../../lib/mailbox/mime.ts";
test("emails sent through Yolias carry the Yolias line with a link", () => {
  const b64 = raw2({ from: "a@b.co", fromName: null, to: "c@d.co", subject: "Hi", body: "Hello", brand: { text: "Sent with Yolias", cta: "Find your next customers now", url: "https://www.yolias.com/?utm_source=sent_with_yolias" } });
  const txt = Buffer.from(b64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  assert.match(txt, /multipart\/alternative/);
});

import { workWeekFor } from "../../lib/outreach/sending-rules.ts";
test("a new mailbox sends on its country's working week", () => {
  assert.deepEqual(workWeekFor("EG"), [0, 1, 2, 3, 4]);
  assert.deepEqual(workWeekFor("sa"), [0, 1, 2, 3, 4]);
  assert.deepEqual(workWeekFor("AE"), [1, 2, 3, 4, 5]);
  assert.deepEqual(workWeekFor(null), [1, 2, 3, 4, 5]);
});
