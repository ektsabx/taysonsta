import { test } from "node:test";
import assert from "node:assert/strict";
import { addTotals, bucket, cpa, cpc, cpm, ctr, derive, emptyTotals, roas } from "@/lib/bos/ads/metrics";
import { parseAdsCsv, parseCsv } from "@/lib/bos/ads/csv";

// Master upgrade Phase 12 (docs/bos/30 §14): metric definitions (null when
// inputs are missing), totals, buckets, CSV import validation.
test("derived metrics follow the documented definitions and are null without inputs", () => {
  assert.equal(ctr({ clicks: 25, impressions: 1000 }), 2.5);
  assert.equal(cpc({ spend: 50, clicks: 25 }), 2);
  assert.equal(cpm({ spend: 50, impressions: 10000 }), 5);
  assert.equal(cpa({ spend: 100, conversions: 4 }), 25);
  assert.equal(roas({ spend: 100, conversionValue: 450 }), 4.5);
  assert.equal(ctr({ clicks: 0, impressions: 0 }), null);
  assert.equal(cpa({ spend: 100, conversions: null }), null, "no conversions reported → not available");
  assert.equal(cpa({ spend: 100, conversions: 0 }), null);
  assert.equal(roas({ spend: 0, conversionValue: 10 }), null, "ROAS only when value and spend exist");
  assert.equal(roas({ spend: 10, conversionValue: null }), null);
});

test("totals keep 'not reported' distinct from zero", () => {
  let t = emptyTotals();
  t = addTotals(t, { spend: 10.005, impressions: 100, clicks: 5, conversions: null, conversionValue: null });
  assert.equal(t.conversions, null);
  t = addTotals(t, { spend: 5, impressions: 50, clicks: 1, conversions: 2, conversionValue: 80 });
  assert.equal(t.conversions, 2);
  assert.equal(derive(t).cpa, Math.round((t.spend / 2) * 100) / 100);
});

test("trend buckets: ISO week starts Monday, month = YYYY-MM", () => {
  assert.equal(bucket("2026-09-30", "week"), "2026-09-28");
  assert.equal(bucket("2026-09-28", "week"), "2026-09-28");
  assert.equal(bucket("2026-10-04", "week"), "2026-09-28");
  assert.equal(bucket("2026-09-30", "month"), "2026-09");
});

test("CSV: quotes, required columns, dates, numbers, one currency only", () => {
  assert.deepEqual(parseCsv('a,"b,c","d ""q"""\n1,2,3'), [["a", "b,c", 'd "q"'], ["1", "2", "3"]]);
  const ok = parseAdsCsv("Date,Campaign,Spend,Impressions,Clicks,Conversions,Currency\n2026-09-01,Launch,\"1,200.50\",10000,300,,USD\n", "USD");
  assert.equal(ok.errors.length, 0);
  assert.equal(ok.rows[0].spend, 1200.5);
  assert.equal(ok.rows[0].conversions, null, "empty conversions stay unknown");
  assert.match(parseAdsCsv("date,campaign,spend\n2026-09-01,x,1", "USD").errors[0], /impressions/);
  const bad = parseAdsCsv("date,campaign,spend,impressions,clicks,currency\n09/01/2026,x,1,1,1,USD\n2026-09-02,x,-5,1,1,USD\n2026-09-03,x,1,1,1,EUR", "USD");
  assert.equal(bad.errors.length, 3);
  assert.ok(bad.errors.some((e) => e.includes("EUR")), "mixed currency refused");
});
