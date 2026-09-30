import { test } from "node:test";
import assert from "node:assert/strict";
import "@/services/bos/approval-handlers";
import { runScheduledSweep } from "@/services/bos/sweep";

test("scheduled sweep runs every step without errors and is idempotent", async () => {
  const first = await runScheduledSweep();
  const failed = first.filter((r) => r.error);
  assert.deepEqual(failed, [], `failed steps: ${JSON.stringify(failed)}`);
  assert.ok(first.length >= 18, "all steps executed");
  const second = await runScheduledSweep();
  const reminders = second.find((r) => r.step === "activity_reminders");
  assert.equal(reminders?.count, 0, "reminders are not re-sent");
});
