import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkoutUrl, hmacMatches, hmacStringFromQuery, hmacStringFromTransaction, intentionBody, outcomeFromQuery, outcomeFromTransaction, signPaymob, toMinor,
} from "../../lib/payments/paymob.ts";

// A "transaction processed" callback obj, shaped like Paymob's docs.
const obj = {
  id: 192036465, pending: false, amount_cents: 99900, success: true, is_auth: false, is_capture: false, is_standalone_payment: true,
  is_voided: false, is_refunded: false, is_3d_secure: true, integration_id: 4097558, has_parent_transaction: false,
  created_at: "2026-10-06T10:00:00.000000", currency: "EGP", error_occured: false, owner: 302852,
  order: { id: 217503754, merchant_order_id: "5f0e8f7e-2f5b-4d0e-9a3c-111111111111" },
  source_data: { pan: "2346", type: "card", sub_type: "MasterCard" },
  data: { message: "Approved" },
};

test("HMAC string follows Paymob's 20 fields in order, booleans lowercase", () => {
  assert.equal(
    hmacStringFromTransaction(obj),
    "99900" + "2026-10-06T10:00:00.000000" + "EGP" + "false" + "false" + "192036465" + "4097558" + "true" + "false" + "false" + "false" + "true" + "false" + "217503754" + "302852" + "false" + "2346" + "MasterCard" + "card" + "true",
  );
});

test("a correctly signed callback verifies; tampering or a wrong secret doesn't", () => {
  const secret = "test-hmac-secret";
  const sig = signPaymob(hmacStringFromTransaction(obj), secret);
  assert.equal(sig.length, 128);
  assert.ok(hmacMatches(hmacStringFromTransaction(obj), secret, sig));
  assert.ok(hmacMatches(hmacStringFromTransaction(obj), secret, sig.toUpperCase()));
  assert.ok(!hmacMatches(hmacStringFromTransaction({ ...obj, amount_cents: 1 }), secret, sig));
  assert.ok(!hmacMatches(hmacStringFromTransaction(obj), "other", sig));
  assert.ok(!hmacMatches(hmacStringFromTransaction(obj), secret, null));
});

test("the GET redirect signs the same fields with flat keys", () => {
  const q = new URLSearchParams({
    id: "192036465", pending: "false", amount_cents: "99900", success: "true", is_auth: "false", is_capture: "false", is_standalone_payment: "true",
    is_voided: "false", is_refunded: "false", is_3d_secure: "true", integration_id: "4097558", has_parent_transaction: "false",
    created_at: "2026-10-06T10:00:00.000000", currency: "EGP", error_occured: "false", owner: "302852", order: "217503754",
    "source_data.pan": "2346", "source_data.type": "card", "source_data.sub_type": "MasterCard", merchant_order_id: obj.order.merchant_order_id,
  });
  assert.equal(hmacStringFromQuery(q), hmacStringFromTransaction(obj));
  const o = outcomeFromQuery(q);
  assert.equal(o.status, "succeeded");
  assert.equal(o.providerRef, "217503754");
  assert.equal(o.merchantRef, obj.order.merchant_order_id);
});

test("outcomes: succeeded, failed, pending, refunded", () => {
  assert.equal(outcomeFromTransaction(obj).status, "succeeded");
  assert.equal(outcomeFromTransaction(obj).amountMinor, 99900);
  const failed = outcomeFromTransaction({ ...obj, success: false, data: { message: "Do not honour" } });
  assert.equal(failed.status, "failed");
  assert.equal(failed.reason, "Do not honour");
  assert.equal(outcomeFromTransaction({ ...obj, pending: true, success: false }).status, "pending");
  assert.equal(outcomeFromTransaction({ ...obj, is_refunded: true }).status, "refunded");
});

test("intention body: minor units, integrations for the currency, our payment id", () => {
  const body = intentionBody({
    paymentId: "pay-1", amount: 999, currency: "USD", description: "Yolias Pro — Monthly",
    customer: { email: "a@b.co", name: "Sara Ali Hassan", country: "EG" }, returnUrl: "https://x/return", notifyUrl: "https://x/hook",
  }, { integrations: { USD: [4097558, 4097559] } });
  assert.equal(body.amount, 99900);
  assert.equal(body.items[0].amount, 99900);
  assert.deepEqual(body.payment_methods, [4097558, 4097559]);
  assert.equal(body.special_reference, "pay-1");
  assert.equal(body.billing_data.first_name, "Sara");
  assert.equal(body.billing_data.last_name, "Ali Hassan");
  assert.equal(body.billing_data.phone_number, "NA");
  assert.equal(toMinor(19.99), 1999);
});

test("unified checkout URL", () => {
  assert.equal(checkoutUrl("https://accept.paymob.com", "egy_pk_test_x", "egy_csk_test_y"), "https://accept.paymob.com/unifiedcheckout/?publicKey=egy_pk_test_x&clientSecret=egy_csk_test_y");
});
