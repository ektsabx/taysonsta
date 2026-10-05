// Master upgrade Phase 5 (docs/bos/30 §3.5, §8; doc 31): templates with
// immutable versions; generation from real records for every document type;
// frozen issued copies (HTML + DOCX); permissions on sensitive data.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/bos/db";
import { bosUserFor, uniq } from "@/tests/integration/helpers";
import { addVersion, documentDocxBytes, duplicateTemplate, generateDocument, getTemplate, listTemplates, previewDocument, renderEmailTemplate, restoreVersion, setDocumentStatus } from "@/services/bos/documents";
import { readZip } from "@/lib/bos/documents/zip";
import { ForbiddenError, ValidationError } from "@/lib/bos/errors";

const cleanup: (() => PromiseLike<unknown>)[] = [];
after(async () => {
  for (const fn of cleanup.reverse()) await Promise.resolve(fn()).catch((e) => console.error("cleanup", e));
});

async function firstId(table: string, filter?: (q: ReturnType<ReturnType<typeof db>["from"]>) => unknown) {
  let q = db().from(table as never).select("id").limit(1);
  if (filter) q = filter(q as never) as typeof q;
  const { data } = await q;
  return (data as { id: string }[] | null)?.[0]?.id ?? null;
}

async function templateId(key: string) {
  const t = (await listTemplates()).find((x) => x.key === key);
  assert.ok(t, `template ${key} seeded`);
  return t!.id;
}

// A real job offer on an existing application (local data may have none).
async function testOffer(): Promise<string> {
  const c = db();
  const { data: app } = await c.from("career_applications").select("id, candidate_id, job_id").not("candidate_id", "is", null).limit(1).single();
  const { data, error } = await c.from("job_offers").insert({ application_id: app!.id, candidate_id: app!.candidate_id!, job_id: app!.job_id, position_title: "Designer", start_date: "2030-03-01", basic_salary: 15000, currency: "EGP", expires_at: "2030-02-15", probation_months: 3, allowances: [{ name: "Transport", amount: 1000 }] as never }).select("id").single();
  if (error) throw error;
  cleanup.push(() => c.from("job_offers").delete().eq("id", data.id));
  return data.id;
}

test("every document type renders from a real record, in Arabic and English, without leftovers", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const cases: [string, string, string | null][] = [
    ["invoice", "invoice", await firstId("invoices")],
    ["client_contract", "contract", await firstId("contracts")],
    ["client_contract", "deal", await firstId("deals")],
    ["proposal", "deal", await firstId("deals")],
    ["job_offer", "job_offer", (await firstId("job_offers")) ?? (await testOffer())],
    ["employment_contract", "employee", await firstId("employees")],
    ["nda_ip", "employee", await firstId("employees")],
    ["nda_ip", "client", await firstId("clients")],
    ["salary_certificate", "employee", await firstId("employees")],
    ["experience_certificate", "employee", await firstId("employees")],
  ];
  for (const [type, entity, id] of cases) {
    assert.ok(id, `seed data has a ${entity}`);
    for (const lang of ["ar", "en"]) {
      const key = `${type}_${lang}`;
      const out = await previewDocument(admin, await templateId(key), entity, id!);
      assert.ok(out.blocks.length > 2, `${key}/${entity} has content`);
      assert.ok(!out.markup.includes("{{"), `${key}: no unrendered variables`);
      assert.ok(!/\.\.\/|undefined|NaN|\[object Object\]/.test(out.markup), `${key}/${entity}: no broken values → ${out.markup.match(/.{0,40}(\.\.\/|undefined|NaN|\[object Object\]).{0,40}/)?.[0]}`);
      assert.equal(out.frame.dir, lang === "ar" ? "rtl" : "ltr");
    }
  }
});

test("issue → frozen copy (HTML + DOCX in storage); template changes and record changes don't alter it", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const c = db();
  const invoiceId = (await firstId("invoices"))!;
  // Work on a copy so system templates don't collect test versions.
  const tplId = await duplicateTemplate(admin, await templateId("invoice_en"), uniq("t_inv").replace(/-/g, "_").toLowerCase().slice(0, 50), "Test invoice template");
  cleanup.push(() => c.from("document_templates").delete().eq("id", tplId));
  const { current: v1 } = await getTemplate(tplId);

  const doc = await generateDocument(admin, tplId, "invoice", invoiceId);
  cleanup.push(async () => {
    const { data } = await c.from("generated_documents").select("docx_path").eq("id", doc.id).single();
    if (data?.docx_path) await c.storage.from("bos-files").remove([data.docx_path]);
  });
  assert.match(doc.number, /^DOC-\d{6}$/);
  const { data: row } = await c.from("generated_documents").select("*").eq("id", doc.id).single();
  const { data: inv } = await c.from("invoices").select("invoice_number").eq("id", invoiceId).single();
  assert.equal(row!.reference, inv!.invoice_number);
  assert.equal(row!.template_version_id, v1!.id);
  assert.ok(row!.rendered_html.includes(inv!.invoice_number));
  assert.equal(row!.status, "issued");
  assert.ok(row!.docx_path, "DOCX stored");

  const { bytes, filename } = await documentDocxBytes(admin, doc.id);
  assert.equal(filename, `${doc.number}.docx`);
  const files = readZip(bytes);
  assert.ok(new TextDecoder().decode(files.get("word/document.xml")!).includes(inv!.invoice_number), "DOCX has the invoice number");

  // A new template version doesn't touch the issued document.
  await addVersion(admin, tplId, { subject: null, body: `${v1!.body}\n\nNEW VERSION LINE`, style: v1!.style as never, header_note: null, footer_note: null, change_note: "test" });
  const { data: again } = await c.from("generated_documents").select("rendered_html, content_hash").eq("id", doc.id).single();
  assert.equal(again!.content_hash, row!.content_hash);
  assert.ok(!again!.rendered_html.includes("NEW VERSION LINE"));

  // DB-level immutability.
  const upd = await c.from("generated_documents").update({ markup: "tampered" }).eq("id", doc.id);
  assert.ok(upd.error && /immutable/i.test(upd.error.message), "content can't be edited");
  const del = await c.from("generated_documents").delete().eq("id", doc.id);
  assert.ok(del.error && /cannot be deleted/i.test(del.error.message), "can't be deleted");

  await setDocumentStatus(admin, doc.id, "sent", { sent_to: ["client@example.com"] });
  await assert.rejects(setDocumentStatus(admin, doc.id, "void", {}), ValidationError, "void needs a reason");
  await setDocumentStatus(admin, doc.id, "void", { void_reason: "test" });
  await assert.rejects(setDocumentStatus(admin, doc.id, "sent"), ValidationError, "a void document is final");

  // Roll back the test version (history is kept as a new version).
  await restoreVersion(admin, tplId, v1!.id);
  const { current: v3 } = await getTemplate(tplId);
  assert.equal(v3!.body, v1!.body);
  assert.ok(v3!.version > v1!.version + 1);
  const verUpd = await c.from("document_template_versions").update({ body: "x" }).eq("id", v1!.id);
  assert.ok(verUpd.error && /immutable/i.test(verUpd.error.message), "versions are immutable");
});

test("permissions: salary documents need HR-sensitive access; sources must be accessible", async () => {
  const sara = await bosUserFor("sara@taysonsta.local");
  const hr = await bosUserFor("hr@taysonsta.local");
  const empId = (await firstId("employees"))!;
  const tpl = await templateId("salary_certificate_ar");
  await assert.rejects(previewDocument(sara, tpl, "employee", empId), ForbiddenError, "sales can't issue salary certificates");
  const out = await previewDocument(hr, tpl, "employee", empId);
  assert.ok(out.markup.length > 50, "HR can");
  await assert.rejects(previewDocument(hr, await templateId("invoice_ar"), "employee", empId), ValidationError, "template type must match the record type");
});

test("template versions: syntax is validated before saving", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const tplId = await templateId("nda_ip_en"); // invalid input never creates a version
  await assert.rejects(addVersion(admin, tplId, { subject: null, body: "{{#if x}}unclosed", style: {}, header_note: null, footer_note: null, change_note: null }), ValidationError);
  await assert.rejects(addVersion(admin, tplId, { subject: null, body: "   ", style: {}, header_note: null, footer_note: null, change_note: null }), ValidationError);
});

test("email templates render subject and body", async () => {
  const { data: inv } = await db().from("invoices").select("invoice_number, total, currency, due_date, clients(name, company_name)").limit(1).single();
  const client = inv!.clients as unknown as { name: string; company_name: string | null };
  const r = await renderEmailTemplate("email_invoice_sent", { invoice: { number: inv!.invoice_number, total: inv!.total, currency: inv!.currency, due_date: inv!.due_date }, client: { display_name: client.company_name ?? client.name } }, "en");
  assert.ok(r);
  assert.ok(r!.subject.includes(inv!.invoice_number));
  assert.ok(!r!.subject.includes("{{"));
  assert.ok(r!.text.includes(inv!.invoice_number));
  void uniq;
});
