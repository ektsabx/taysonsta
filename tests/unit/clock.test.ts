import { test } from "node:test";
import assert from "node:assert/strict";
import { formatSystemDate, formatSystemTime, nowIso, nowMs } from "@/lib/bos/clock";
import { todayIn } from "@/lib/bos/format";

// Global date & time (docs/bos/28 §29): one source, overridable for tests.
test("BOS_NOW fixes the system clock outside production", () => {
  const prev = process.env.BOS_NOW;
  process.env.BOS_NOW = "2026-09-28T18:31:00Z";
  try {
    assert.equal(nowIso(), "2026-09-28T18:31:00.000Z");
    assert.equal(todayIn("Africa/Cairo"), "2026-09-28", "format helpers read the same clock");
    assert.equal(formatSystemDate(nowMs(), "Africa/Cairo"), "Monday, September 28, 2026");
    assert.equal(formatSystemTime(nowMs(), "Africa/Cairo"), "09:31 PM");
  } finally {
    if (prev === undefined) delete process.env.BOS_NOW;
    else process.env.BOS_NOW = prev;
  }
});

test("without an override the clock follows real time", () => {
  const prev = process.env.BOS_NOW;
  delete process.env.BOS_NOW;
  try {
    assert.ok(Math.abs(nowMs() - Date.now()) < 1000);
  } finally {
    if (prev !== undefined) process.env.BOS_NOW = prev;
  }
});
