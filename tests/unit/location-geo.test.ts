import { test } from "node:test";
import assert from "node:assert/strict";
import { bbox, haversineMeters, osmEmbedUrl, validCoords } from "@/lib/bos/location/geo";

// Master upgrade Phase 19 (docs/bos/30 §28): distance, coordinate validation, map embed.
test("haversine distance and coordinate validation", () => {
  const tahrir = { lat: 30.0444, lng: 31.2357 };
  const giza = { lat: 29.9792, lng: 31.1342 };
  const d = haversineMeters(tahrir, giza);
  assert.ok(d > 11500 && d < 12800, String(d));
  assert.equal(haversineMeters(tahrir, tahrir), 0);
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
