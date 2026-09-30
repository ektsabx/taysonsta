import { test } from "node:test";
import assert from "node:assert/strict";
import { addMoney, allocateByPercent, parseMoney, percentOf, toDecimalString, formatMoney, sumPercents } from "@/lib/bos/money";

test("parseMoney handles strings, numbers, commas and rounding", () => {
  assert.equal(parseMoney("1,234.5"), BigInt(1234500));
  assert.equal(parseMoney(10), BigInt(10000));
  assert.equal(parseMoney("0.0005"), BigInt(1), "half-up on 4th decimal");
  assert.equal(parseMoney("abc"), null);
  assert.equal(parseMoney(""), null);
});

test("no float drift: 0.1 + 0.2 = 0.3", () => {
  assert.equal(toDecimalString(addMoney("0.1", "0.2")), "0.30");
});

test("40/30/30 of 25,000 allocates exactly", () => {
  const parts = allocateByPercent("25000", [40, 30, 30], "USD");
  assert.deepEqual(parts.map((p) => toDecimalString(p)), ["10000.00", "7500.00", "7500.00"]);
  assert.equal(toDecimalString(parts.reduce((a, b) => a + b, BigInt(0))), "25000.00");
});

test("allocation remainder lands so the total is preserved", () => {
  const parts = allocateByPercent("100", [33.33, 33.33, 33.34], "USD");
  assert.equal(toDecimalString(parts.reduce((a, b) => a + b, BigInt(0))), "100.00");
});

test("percentOf rounds to currency decimals (KWD 3dp)", () => {
  assert.equal(toDecimalString(percentOf("10.005", 50, "USD")), "5.00");
  assert.equal(toDecimalString(percentOf("1.001", 50, "KWD"), 3), "0.501");
});

test("sumPercents and formatting", () => {
  assert.equal(toDecimalString(sumPercents([40, 30, 30]), 0), "100");
  assert.match(formatMoney("1234.5", "USD"), /1,234\.50/);
});
