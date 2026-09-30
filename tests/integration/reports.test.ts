import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/bos/db";
import { bosUserFor } from "@/tests/integration/helpers";
import { runReport } from "@/services/bos/reports";
import { exporters } from "@/services/bos/exporters";
import { ValidationError } from "@/lib/bos/errors";

test("revenue report equals hand-computed collected/invoiced (base currency)", async () => {
  const exec = await bosUserFor("exec@taysonsta.local");
  const from = "2022-01-01";
  const to = new Date().toISOString().slice(0, 10);
  const { data } = await runReport<{ collected: number; revenue: number }>(exec, "revenue", { from, to });
  const { data: pays } = await db().from("payments").select("amount, refunded_amount, currency, payment_date").in("status", ["completed", "refunded"]).gte("payment_date", from).lte("payment_date", to);
  let expected = 0;
  for (const p of pays ?? []) {
    const { data: v } = await db().rpc("bos_to_base", { p_amount: Number(p.amount) - Number(p.refunded_amount), p_currency: p.currency, p_date: p.payment_date } as never);
    expected += Number(v);
  }
  assert.equal(Number(data.collected).toFixed(2), expected.toFixed(2));
});

test("scope: sales manager sees team only; own-scope user can't pick others", async () => {
  const sm = await bosUserFor("sales.manager@taysonsta.local");
  const { filters } = await runReport(sm, "bd", {});
  const scope = sm.permissions.get("reports.read");
  if (scope !== "all") assert.ok(Array.isArray((filters as { user_ids?: string[] }).user_ids), "user_ids injected from scope");
  const omar = await bosUserFor("omar@taysonsta.local");
  if (omar.permissions.get("reports.read") !== "all") {
    const ahmed = await bosUserFor("ahmed@taysonsta.local");
    await assert.rejects(runReport(omar, "team", { user_id: ahmed.userId }), ValidationError);
  }
  await assert.rejects(runReport(sm, "sales", { from: "2026-02-01", to: "2026-01-01" }), ValidationError);
  await assert.rejects(runReport(sm, "sales", { from: "2010-01-01", to: "2026-01-01" }), ValidationError, "max 5 years");
});

test("report CSV export matches the table and hides money without permission", async () => {
  const exec = await bosUserFor("exec@taysonsta.local");
  const csv = await exporters.report.run(exec, { name: "countries", from: "2022-01-01" });
  const { data } = await runReport<unknown[]>(exec, "countries", { from: "2022-01-01" });
  assert.equal(csv.rows.length, data.length);
  const pm = await bosUserFor("omar@taysonsta.local");
  if (!pm.permissions.has("revenue.view_sensitive" as never) && pm.permissions.get("reports.read")) {
    const pmCsv = await exporters.report.run(pm, { name: "countries", from: "2022-01-01" });
    assert.ok(!pmCsv.header.includes("Won revenue"), "money columns hidden");
  }
});
