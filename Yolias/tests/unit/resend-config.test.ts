import { test } from "node:test";
import assert from "node:assert/strict";
import { setIntegrationsForTests } from "../../lib/integrations.ts";
import { emailConfigured, fromHeader, resendKey } from "../../lib/email/send.ts";

// Regression (2026-10-21): production never sent an email because the key
// was only read from a server variable that was never set. The Integration
// Hub copy (integration_keys "resend") must be enough.
test("Resend key and sender come from the Integration Hub; a server variable still wins", () => {
  const saved = { ...process.env };
  for (const k of ["RESEND_API_KEY", "RESEND_FROM", "EMAIL_FROM", "EMAIL_DOMAIN"]) delete process.env[k];
  try {
    setIntegrationsForTests({});
    assert.equal(emailConfigured(), false);
    setIntegrationsForTests({ resend: { api_key: "re_test_1234" } }, { resend: { from: "Taysonsta <no-reply@taysonsta.com>", yolias_from: "Yolias <no-reply@yolias.com>" } });
    assert.equal(resendKey(), "re_test_1234");
    assert.equal(fromHeader("billing"), "Yolias Billing <no-reply@yolias.com>");
    assert.ok(emailConfigured());
    process.env.RESEND_API_KEY = "re_env";
    assert.equal(resendKey(), "re_env");
  } finally {
    process.env = saved;
    setIntegrationsForTests(null);
  }
});
