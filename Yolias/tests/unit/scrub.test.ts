import { test } from "node:test";
import assert from "node:assert/strict";
import { scrubEvent, scrubText, scrubUrl } from "../../lib/monitoring/scrub.ts";

test("secret query values are filtered, others kept", () => {
  assert.equal(scrubUrl("https://www.yolias.com/auth/confirm?token_hash=abc&type=signup"), "https://www.yolias.com/auth/confirm?token_hash=%5BFiltered%5D&type=signup");
  assert.equal(scrubUrl("/api/payments/paymob/return?hmac=ff&success=true"), "/api/payments/paymob/return?hmac=%5BFiltered%5D&success=true");
  assert.equal(scrubUrl("/search/1?tab=people"), "/search/1?tab=people");
});

test("emails, bearer tokens and API keys are removed from text", () => {
  const out = scrubText("send to mona@nilecrm.com failed: Authorization: Bearer eyJhbGci.x.y key sk-ant-api03-abcdefghijklmnop");
  assert.ok(!out.includes("mona@"));
  assert.ok(!out.includes("eyJhbGci"));
  assert.ok(!out.includes("abcdefghijklmnop"));
});

test("Sentry events lose cookies, bodies, auth headers and user details", () => {
  const e = scrubEvent({
    user: { id: "u1", email: "a@b.co", ip_address: "1.2.3.4" },
    request: { url: "https://x.co/a?code=123", cookies: { sb: "1" }, data: { card: "4111" }, headers: { Cookie: "x", Authorization: "Bearer y", "User-Agent": "UA" } },
    exception: { values: [{ value: "duplicate key for owner@x.com" }] },
  });
  assert.deepEqual(e.user, { id: "u1" });
  assert.equal(e.request.cookies, undefined);
  assert.equal(e.request.data, undefined);
  assert.deepEqual(e.request.headers, { "User-Agent": "UA" });
  assert.ok(e.request.url.includes("code=%5BFiltered%5D"));
  assert.ok(!e.exception.values[0].value.includes("owner@"));
});
