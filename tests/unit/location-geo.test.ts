import { test } from "node:test";
import assert from "node:assert/strict";
import { bbox, osmEmbedUrl, validCoords } from "@/lib/bos/location/geo";

// Master upgrade Phase 19 (docs/bos/30 §28): coordinate validation, map embed.
test("coordinate validation", () => {
  assert.equal(validCoords(30.1, 31.2), true);
  assert.equal(validCoords(0, 0), false, "null island refused");
  assert.equal(validCoords(91, 0), false);
  assert.equal(validCoords("30", 31), false);
});

test("bbox + OSM embed (no API key needed)", () => {
  assert.equal(bbox([]), null);
  const url = osmEmbedUrl([{ lat: 30, lng: 31 }])!;
  assert.match(url, /^https:\/\/www\.openstreetmap\.org\/export\/embed\.html\?bbox=/);
  assert.match(url, /marker=30,31/);
});
