import { test } from "node:test";
import assert from "node:assert/strict";
import { OBJECTIVES, specOf } from "../../lib/engine/objectives.ts";
import { eventFor } from "../../lib/agent-core/optimizer.ts";
import { splitPhone, joinPhone } from "../../lib/dial-codes.ts";

test("every objective is one engine entry", () => {
  for (const o of OBJECTIVES) assert.equal(specOf(o).id, o);
  assert.equal(specOf(null).id, "meetings");
  assert.equal(specOf("purchases").onInterest, "send_link");
  assert.equal(specOf("qualified_leads").contacts, false);
});

test("the engine optimizes for each objective's event", () => {
  const c = { interested: 6, meetings: 5, held: 9, conversions: 7 };
  assert.equal(eventFor("meetings", c), "booked");
  assert.equal(eventFor("purchases", c), "purchase");
  assert.equal(eventFor("form_leads", { ...c, conversions: 1 }), "positive");
  assert.equal(eventFor("qualified_leads", c), null);
});

test("phone: country code + number", () => {
  assert.equal(joinPhone("EG", "0100 123 4567"), "+201001234567");
  assert.equal(joinPhone("SA", "٠٥٥١٢٣٤٥٦٧"), "+966551234567");
  assert.deepEqual(splitPhone("+201001234567"), { country: "EG", national: "1001234567" });
  assert.deepEqual(splitPhone("+14155550123", "CA"), { country: "CA", national: "4155550123" });
  assert.equal(joinPhone("EG", ""), "");
});
