import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { isStopKeyword, normalizePhone, renderTemplate, waLink } from "@/lib/bos/messaging-utils";
import { signTwilio, verifyTwilio } from "@/lib/bos/integrations/webhook-signatures";

// Master upgrade Phase 9 (docs/bos/30 §11): phone normalisation, template
// rendering, opt-out keywords, wa.me links, Twilio webhook signatures.
test("phones normalise to international digits", () => {
  assert.equal(normalizePhone("+20 100-123-4567"), "201001234567");
  assert.equal(normalizePhone("00201001234567"), "201001234567");
  assert.equal(normalizePhone("123"), null);
  assert.equal(normalizePhone("1234567890123456"), null);
  assert.equal(normalizePhone(null), null);
});

test("templates fill {{n}} by position and keep missing ones visible", () => {
  assert.equal(renderTemplate("Hi {{1}}, invoice {{2}} is due", ["Mona", "INV-7"]), "Hi Mona, invoice INV-7 is due");
  assert.equal(renderTemplate("Hi {{1}} {{2}}", ["Mona"]), "Hi Mona {{2}}");
  assert.equal(renderTemplate("Hi {{1}}", ["  "]), "Hi {{1}}");
});

test("opt-out keywords only when the whole message is the keyword", () => {
  for (const k of ["STOP", "stop.", " Unsubscribe ", "إلغاء", "الغاء الاشتراك"]) assert.equal(isStopKeyword(k), true, k);
  for (const k of ["please don't stop the service", "stop by tomorrow?", "إلغاء الطلب رقم 5"]) assert.equal(isStopKeyword(k), false, k);
});

test("wa.me link encodes the greeting", () => {
  assert.equal(waLink("201001234567", "مرحبا & hi"), `https://wa.me/201001234567?text=${encodeURIComponent("مرحبا & hi")}`);
  assert.equal(waLink("201001234567"), "https://wa.me/201001234567");
});

test("Twilio signature = base64 HMAC-SHA1(url + sorted params); tampering fails", async () => {
  const token = "12345";
  const url = "https://example.com/api/bos/webhooks/twilio";
  const params = { MessageSid: "SM1", From: "+201001234567", Body: "hi", To: "+15550001111" };
  const expected = createHmac("sha1", token).update(url + ["Body", "From", "MessageSid", "To"].map((k) => k + params[k as keyof typeof params]).join("")).digest("base64");
  assert.equal(await signTwilio(token, url, params), expected);
  assert.equal(await verifyTwilio(token, expected, url, params), true);
  assert.equal(await verifyTwilio(token, expected, url, { ...params, Body: "changed" }), false);
  assert.equal(await verifyTwilio(token, expected, "https://evil.com/x", params), false);
  assert.equal(await verifyTwilio(token, null, url, params), false);
});
