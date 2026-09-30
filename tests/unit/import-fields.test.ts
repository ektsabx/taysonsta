import { test } from "node:test";
import assert from "node:assert/strict";
import { excelSerialToDate, normalise, normaliseDate, type FieldSpec } from "@/lib/bos/import/fields";

// Master upgrade Phase 18 (docs/bos/30 §27): value normalisation.
const f = (o: Partial<FieldSpec>): FieldSpec => ({ key: "k", label: "الحقل", type: "text", ...o });

test("dates: ISO, DD/MM/YYYY, Excel serials; impossible dates refused", () => {
  assert.equal(normaliseDate("2026-02-28"), "2026-02-28");
  assert.equal(normaliseDate("5/3/2026"), "2026-03-05");
  assert.equal(normaliseDate("2026/3/5"), "2026-03-05");
  assert.equal(excelSerialToDate(46082), "2026-03-01");
  assert.equal(normaliseDate("46082"), "2026-03-01");
  assert.equal(normaliseDate("31/02/2026"), null);
  assert.equal(normaliseDate("tomorrow"), null);
});

test("numbers accept Arabic digits and separators; required and enum rules", () => {
  assert.deepEqual(normalise(f({ type: "number" }), "١٬٢٥٠٫٥"), { ok: true, value: 1250.5 });
  assert.deepEqual(normalise(f({ type: "number" }), "1,200"), { ok: true, value: 1200 });
  assert.equal(normalise(f({ type: "number" }), "-5").ok, false);
  assert.equal(normalise(f({ type: "text", required: true }), "  ").ok, false);
  assert.deepEqual(normalise(f({ type: "text" }), ""), { ok: true, value: null });
  assert.deepEqual(normalise(f({ type: "enum", values: { "دوام كامل": "full_time", "full time": "full_time" } }), "Full Time"), { ok: true, value: "full_time" });
  assert.equal(normalise(f({ type: "enum", values: { a: "a" } }), "b").ok, false);
  assert.deepEqual(normalise(f({ type: "email" }), "A@X.COM"), { ok: true, value: "a@x.com" });
  assert.deepEqual(normalise(f({ type: "currency" }), "egp"), { ok: true, value: "EGP" });
  assert.deepEqual(normalise(f({ type: "list" }), "a، b; c"), { ok: true, value: ["a", "b", "c"] });
  assert.deepEqual(normalise(f({ type: "bool" }), "نعم"), { ok: true, value: true });
});
