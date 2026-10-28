import { test } from "node:test";
import assert from "node:assert/strict";
import { isAutoReply, isBounce } from "../../lib/mailbox/mime.ts";

const headers = (h: Record<string, string>) => (n: string) => h[n] ?? "";

test("auto-replies are told by their headers", () => {
  assert.ok(isAutoReply(headers({ "auto-submitted": "auto-replied" }), "Re: Fleet tracking"));
  assert.ok(isAutoReply(headers({ "auto-submitted": "Auto-Generated " }), "Re: x"));
  assert.ok(isAutoReply(headers({ "x-autoreply": "yes" }), "Re: x"));
  assert.ok(isAutoReply(headers({ "x-autorespond": "1" }), "Re: x"));
  assert.ok(isAutoReply(headers({ precedence: "auto_reply" }), "Re: x"));
  assert.ok(isAutoReply(headers({ precedence: "Bulk" }), "Re: x"));
});

test("or by their subject, English and Arabic", () => {
  assert.ok(isAutoReply(headers({}), "Automatic reply: Fleet tracking"));
  assert.ok(isAutoReply(headers({}), "Out of Office: back Monday"));
  assert.ok(isAutoReply(headers({}), "Auto-Reply: thanks"));
  assert.ok(isAutoReply(headers({}), "رد تلقائي: تتبع الأسطول"));
  assert.ok(isAutoReply(headers({}), "خارج المكتب"));
});

test("a person's reply is not an auto-reply", () => {
  assert.ok(!isAutoReply(headers({}), "Re: Fleet tracking for your drivers"));
  assert.ok(!isAutoReply(headers({ "auto-submitted": "no" }), "Re: pricing"));
  assert.ok(!isAutoReply(headers({ precedence: "list" }), "Re: pricing"));
});

test("a bounce is still a bounce (asked first)", () => {
  assert.ok(isBounce("mailer-daemon@googlemail.com", "Delivery Status Notification (Failure)"));
});

test("campaign emails carry List-Unsubscribe with one-click (RFC 8058); others don't", async () => {
  const { buildMessage, buildRawEmail, decodeBase64Url } = await import("../../lib/mailbox/mime.ts");
  const url = "https://www.yolias.com/api/u/00000000-0000-4000-8000-000000000000";
  const smtp = buildMessage({ from: "a@x.com", fromName: null, to: "b@y.com", subject: "Hi", body: "Hello", messageId: "<1@x.com>", unsubscribeUrl: url });
  assert.match(smtp, new RegExp(`List-Unsubscribe: <${url}>\\r\\n`));
  assert.match(smtp, /List-Unsubscribe-Post: List-Unsubscribe=One-Click\r\n/);
  assert.match(decodeBase64Url(buildRawEmail({ from: "a@x.com", fromName: null, to: "b@y.com", subject: "Hi", body: "Hello", unsubscribeUrl: url })), /List-Unsubscribe-Post/);
  assert.doesNotMatch(buildMessage({ from: "a@x.com", fromName: null, to: "b@y.com", subject: "Hi", body: "Hello", messageId: "<1@x.com>" }), /List-Unsubscribe/);
});
