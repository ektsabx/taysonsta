import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPayout, parsePayout, payoutFields, serializePayout } from "../../lib/affiliates/payout-fields.ts";

// Yolias Partners payout details (D-210): each method has its own fields.

test("payout: each method asks for its own fields; unknown methods get one details box", () => {
  assert.deepEqual(payoutFields("paypal").map((f) => f.key), ["email"]);
  assert.deepEqual(payoutFields("bank_transfer").map((f) => f.key), ["holder", "bank", "account", "swift", "country"]);
  assert.deepEqual(payoutFields("something_new").map((f) => f.key), ["details"]);
});

test("payout: required fields, email and phone are checked on the server", () => {
  assert.deepEqual(checkPayout("paypal", { email: "" }), { ok: false, field: "email" });
  assert.deepEqual(checkPayout("paypal", { email: "not-an-email" }), { ok: false, field: "email" });
  assert.deepEqual(checkPayout("bank_transfer", { holder: "Sara Ali", bank: "CIB", account: "", country: "Egypt" }), { ok: false, field: "account" });
  assert.deepEqual(checkPayout("vodafone_cash", { phone: "abc", holder: "Sara" }), { ok: false, field: "phone" });
  const ok = checkPayout("bank_transfer", { holder: "Sara  Ali", bank: "CIB", account: "EG38 0019", country: "Egypt" });
  assert.equal(ok.ok, true);
});

test("payout: stored as readable lines for the finance team, and read back into the form", () => {
  const values = { holder: "Sara Ali", bank: "CIB", account: "EG38 0019", swift: "", country: "Egypt" };
  const text = serializePayout("bank_transfer", values);
  assert.equal(text, "Account holder: Sara Ali\nBank name: CIB\nIBAN / account number: EG38 0019\nBank country: Egypt");
  assert.deepEqual(parsePayout("bank_transfer", text), { holder: "Sara Ali", bank: "CIB", account: "EG38 0019", country: "Egypt" });
  assert.deepEqual(parsePayout("other_method", "free text"), { details: "free text" });
  assert.deepEqual(parsePayout("paypal", "old free text from before"), {}, "old free-text details don't break the form");
});
