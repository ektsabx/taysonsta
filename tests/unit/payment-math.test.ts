import { test } from "node:test";
import assert from "node:assert/strict";
import { paymentStats, repeatRate, type PaymentRow } from "@/lib/yolias/payment-math";

const row = (w: string, status: string, amount = 10): PaymentRow => ({ workspace_id: w, kind: "subscription", plan: "growth", amount, status, provider: "paymob", created_at: "2026-11-01", paid_at: null, failure_reason: null });

test("payment stats", () => {
  const s = paymentStats([row("a", "succeeded", 100), row("b", "succeeded", 50), row("c", "failed"), row("d", "pending"), row("e", "refunded", 20)], new Set(["a"]));
  assert.equal(s.revenue, 150); assert.equal(s.paid, 2); assert.equal(s.average, 75);
  assert.equal(s.successRate, 2 / 3); assert.equal(s.refundedAmount, 20);
  assert.equal(s.firstTime, 1); assert.equal(s.returning, 1);
  assert.equal(paymentStats([], new Set()).average, null);
});

test("repeat rate", () => {
  assert.equal(repeatRate([row("a", "succeeded"), row("a", "succeeded"), row("b", "succeeded"), row("c", "failed")]), 0.5);
  assert.equal(repeatRate([]), null);
});
