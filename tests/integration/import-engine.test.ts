// Master upgrade Phase 18 (docs/bos/30 §27; doc 31): import engine —
// upload/analyse, mapping, validation (errors, in-file and existing
// duplicates), expected count, execution through module services, safe
// updates, error report, rollback, permissions; CSV and XLSX.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/bos/db";
import { bosUserFor, uniq } from "@/tests/integration/helpers";
import { createZip } from "@/lib/bos/documents/zip";
import { analyzeImport, errorReportCsv, executeImport, rollbackImport, startImport, validateImport } from "@/services/bos/import-engine";
import { ForbiddenError, ValidationError } from "@/lib/bos/errors";

const cleanup: (() => PromiseLike<unknown>)[] = [];
after(async () => {
  for (const fn of cleanup.reverse()) await Promise.resolve(fn()).catch((e) => console.error("cleanup", e));
});
const jobs: string[] = [];
cleanup.push(() => db().from("import_jobs").delete().in("id", jobs));
const enc = new TextEncoder();

async function job(bos: Awaited<ReturnType<typeof bosUserFor>>, type: string, name: string, content: Uint8Array) {
  const s = await startImport(bos, { dataType: type, fileName: name, size: content.length });
  jobs.push(s.jobId);
  await analyzeImport(bos, s.jobId, content);
  return s.jobId;
}

test("permissions: imports.create plus the target module's create right", async () => {
  const [dev, hr] = await Promise.all([bosUserFor("youssef.dev@taysonsta.local"), bosUserFor("hr@taysonsta.local")]);
  await assert.rejects(startImport(dev, { dataType: "contacts", fileName: "a.csv", size: 10 }), ForbiddenError);
  if (!hr.permissions.get("clients.create")) await assert.rejects(startImport(hr, { dataType: "clients", fileName: "a.csv", size: 10 }), ForbiddenError);
  const admin = await bosUserFor("admin@taysonsta.local");
  await assert.rejects(startImport(admin, { dataType: "contacts", fileName: "a.exe", size: 10 }), ValidationError);
  await assert.rejects(startImport(admin, { dataType: "nope", fileName: "a.csv", size: 10 }), ValidationError);
});

test("contacts CSV: errors, in-file duplicate, existing match skipped, expected count, report, rollback", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const tag = uniq("imp").toLowerCase();
  const { data: existing } = await db().from("contacts").select("email").not("email", "is", null).is("archived_at", null).limit(1).single();
  const csv = [
    "Full Name,E-mail,Phone,Title",
    `Ali ${tag},ali-${tag}@example.com,+20 100 111 2222,CTO`,
    `Mona ${tag},mona-${tag}@example.com,,=CMD()`,
    `Bad ${tag},not-an-email,,`,
    `Ali again ${tag},ali-${tag}@example.com,,`,
    `Existing ${tag},${existing!.email},,`,
    `,nameless-${tag}@example.com,,`,
  ].join("\n");
  const id = await job(admin, "contacts", "contacts.csv", enc.encode(csv));
  await assert.rejects(validateImport(admin, id, { mapping: { email: "E-mail" }, matchKey: "email", mode: "create_only", expectedCount: null }), ValidationError, "required field must be mapped");
  const v = await validateImport(admin, id, { mapping: { full_name: "Full Name", email: "E-mail", phone: "Phone", position: "Title" }, matchKey: "email", mode: "create_only", expectedCount: 5 });
  assert.deepEqual([v.valid, v.errors, v.duplicates], [2, 3, 1]);
  await assert.rejects(executeImport(admin, id, { acknowledgeCountMismatch: false }), ValidationError, "expected count mismatch needs confirmation");
  const r = await executeImport(admin, id, { acknowledgeCountMismatch: true });
  assert.equal(r.created, 2);
  const { data: made } = await db().from("contacts").select("id, email, phone, position").in("email", [`ali-${tag}@example.com`, `mona-${tag}@example.com`]);
  assert.equal(made!.length, 2);
  assert.ok(made!.some((c) => c.phone === "+201001112222"));
  const report = await errorReportCsv(admin, id);
  assert.match(report, /not-an-email/);
  assert.match(report, /مكرر داخل الملف/);
  await assert.rejects(executeImport(admin, id, { acknowledgeCountMismatch: true }), ValidationError, "runs once");
  const rb = await rollbackImport(admin, id);
  assert.equal(rb.removed + rb.archived, 2);
  const { count } = await db().from("contacts").select("id", { count: "exact", head: true }).in("email", [`ali-${tag}@example.com`, `mona-${tag}@example.com`]).is("archived_at", null);
  assert.equal(count, 0, "rolled back");
});

test("update mode changes only mapped non-empty safe fields and rollback restores them", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const { data: c } = await db().from("clients").select("id, email, phone, city, name").is("archived_at", null).not("email", "is", null).limit(1).single();
  const csv = `name,email,phone,city\n${c!.name},${c!.email},+20 111 999 8888,\n`;
  const id = await job(admin, "clients", "clients.csv", enc.encode(csv));
  const v = await validateImport(admin, id, { mapping: { name: "name", email: "email", phone: "phone", city: "city" }, matchKey: "email", mode: "update_matches", expectedCount: null });
  assert.equal(v.duplicates, 1);
  const r = await executeImport(admin, id, { acknowledgeCountMismatch: false });
  assert.equal(r.updated, 1);
  const { data: after1 } = await db().from("clients").select("phone, city").eq("id", c!.id).single();
  assert.equal(after1!.phone, "+201119998888");
  assert.equal(after1!.city, c!.city, "empty cell never overwrites");
  await rollbackImport(admin, id);
  assert.equal((await db().from("clients").select("phone").eq("id", c!.id).single()).data!.phone, c!.phone, "previous value restored");
});

test("XLSX assets import through the asset service; KB import creates drafts", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const tag = uniq("A").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-8);
  const sheet = `<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Asset Tag</t></is></c><c r="B1" t="inlineStr"><is><t>Type</t></is></c><c r="C1" t="inlineStr"><is><t>Purchase Date</t></is></c><c r="D1" t="inlineStr"><is><t>Value</t></is></c><c r="E1" t="inlineStr"><is><t>Currency</t></is></c></row>
<row r="2"><c r="A2" t="inlineStr"><is><t>X-${tag}-1</t></is></c><c r="B2" t="inlineStr"><is><t>لابتوب</t></is></c><c r="C2"><v>46082</v></c><c r="D2"><v>1500</v></c><c r="E2" t="inlineStr"><is><t>usd</t></is></c></row>
<row r="3"><c r="A3" t="inlineStr"><is><t>X-${tag}-2</t></is></c><c r="B3" t="inlineStr"><is><t>spaceship</t></is></c></row></sheetData></worksheet>`;
  const xlsx = createZip([{ name: "xl/worksheets/sheet1.xml", data: enc.encode(sheet) }]);
  const id = await job(admin, "assets", "assets.xlsx", xlsx);
  const v = await validateImport(admin, id, { mapping: { asset_id: "Asset Tag", type: "Type", purchase_date: "Purchase Date", purchase_value: "Value", currency: "Currency" }, matchKey: "asset_id", mode: "create_only", expectedCount: null });
  assert.deepEqual([v.valid, v.errors], [1, 1], "unknown type refused");
  await executeImport(admin, id, { acknowledgeCountMismatch: false });
  const { data: dev } = await db().from("devices").select("id, type, purchase_date, currency").eq("asset_id", `X-${tag}-1`).single();
  cleanup.push(() => db().from("devices").delete().eq("id", dev!.id));
  assert.deepEqual([dev!.type, dev!.purchase_date, dev!.currency], ["laptop", "2026-03-01", "USD"]);
  const { count: ev } = await db().from("asset_events").select("id", { count: "exact", head: true }).eq("device_id", dev!.id).eq("kind", "purchased");
  assert.equal(ev, 1, "service side effects kept (event log)");

  const { data: cat } = await db().from("kb_categories").select("name").limit(1).single();
  const kid = await job(admin, "kb_articles", "kb.json", enc.encode(JSON.stringify([{ title: `Imported ${tag}`, content: "Steps…", category: cat!.name }])));
  await validateImport(admin, kid, { mapping: { title: "title", content: "content", category: "category" }, matchKey: "title", mode: "create_only", expectedCount: 1 });
  await executeImport(admin, kid, { acknowledgeCountMismatch: false });
  const { data: art } = await db().from("kb_articles").select("id, status").eq("title", `Imported ${tag}`).single();
  cleanup.push(async () => { await db().from("kb_article_versions").delete().eq("article_id", art!.id); await db().from("kb_articles").delete().eq("id", art!.id); });
  assert.equal(art!.status, "draft", "imported articles need review");
});
