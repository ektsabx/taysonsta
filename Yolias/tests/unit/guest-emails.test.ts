import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMessage } from "../../lib/email/messages.ts";

// Guests get their meeting emails in the language they booked in.
const base = { siteUrl: "https://www.yolias.com", hostName: "Sara", company: "Acme", title: "Intro", start: "2026-11-12T10:00:00.000Z", timeZone: "Asia/Riyadh" };

test("guest meeting emails in Arabic", () => {
  const ar = renderMessage("meeting_guest", "ar", { ...base, end: "2026-11-12T10:30:00.000Z", location: null, url: null, calendarInvite: false, cancelUrl: "https://www.yolias.com/meet/c/x" } as never);
  assert.match(ar.subject, /تم التأكيد/);
  assert.match(ar.html, /إلغاء الاجتماع/);
  assert.match(renderMessage("meeting_guest_canceled", "ar", base as never).subject, /أُلغي/);
  assert.match(renderMessage("meeting_guest_reminder", "ar", { ...base, when: "day", url: null, location: null, cancelUrl: "x" } as never).subject, /^غدًا/);
  assert.match(renderMessage("meeting_rebook", "ar", { ...base, bookingUrl: "x" } as never).subject, /موعدًا آخر/);
});

test("guest meeting emails in English stay English", () => {
  assert.match(renderMessage("meeting_guest_canceled", "en", base as never).subject, /^Canceled: Intro/);
});
