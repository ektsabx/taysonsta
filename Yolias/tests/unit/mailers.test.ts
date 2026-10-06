import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeHeader, rfc2822 } from "../../lib/outreach/mailers.ts";

test("ASCII headers stay as they are; Arabic is RFC 2047 encoded", () => {
  assert.equal(encodeHeader("Quick question"), "Quick question");
  const enc = encodeHeader("سؤال سريع");
  assert.match(enc, /^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
  assert.equal(Buffer.from(enc.slice(10, -2), "base64").toString("utf8"), "سؤال سريع");
});

test("Gmail raw message: base64url RFC 2822, UTF-8 body", () => {
  const raw = rfc2822({ from: "sara@acme.example", fromName: "سارة", to: "omar@client.example", subject: "مرحبا", body: "نص الرسالة\nسطر ثاني" });
  assert.doesNotMatch(raw, /[+/=]/, "base64url");
  const text = Buffer.from(raw, "base64url").toString("utf8");
  assert.match(text, /^From: =\?UTF-8\?B\?.+\?= <sara@acme\.example>\r\n/);
  assert.match(text, /\r\nTo: omar@client\.example\r\n/);
  assert.match(text, /Content-Type: text\/plain; charset="UTF-8"/);
  const body = text.split("\r\n\r\n")[1].replace(/\r\n/g, "");
  assert.equal(Buffer.from(body, "base64").toString("utf8"), "نص الرسالة\nسطر ثاني");
});
