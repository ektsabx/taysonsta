import { test } from "node:test";
import assert from "node:assert/strict";
import { createZip } from "@/lib/bos/documents/zip";
import { autoMap, parseCsvText, parseJsonText, parseXlsx, unzip } from "@/lib/bos/import/parse";

// Master upgrade Phase 18 (docs/bos/30 §27): CSV / JSON / XLSX reading.
const enc = new TextEncoder();
const sheet = `<?xml version="1.0"?><worksheet><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="inlineStr"><is><t>Amount</t></is></c></row>
<row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><f>SUM(1,2)</f><v>3</v></c></row>
<row r="3"><c r="A3" t="s"><v>3</v></c><c r="B3" t="s"><v>4</v></c><c r="C3"><v>12.5</v></c></row>
</sheetData></worksheet>`;
const shared = `<sst><si><t>Name</t></si><si><t>Email</t></si><si><t>شركة &amp; أخرى</t></si><si><t>Beta</t></si><si><r><t>b@</t></r><r><t>x.com</t></r></si></sst>`;

test("xlsx: shared + inline strings, gaps, cached formula values, stored entries", async () => {
  const zip = createZip([{ name: "xl/sharedStrings.xml", data: enc.encode(shared) }, { name: "xl/worksheets/sheet1.xml", data: enc.encode(sheet) }]);
  const p = await parseXlsx(zip);
  assert.deepEqual(p.headers, ["Name", "Email", "Amount"]);
  assert.deepEqual(p.rows, [["شركة & أخرى", "", "3"], ["Beta", "b@x.com", "12.5"]]);
});

test("zip reader inflates deflate entries", async () => {
  const data = enc.encode("hello ".repeat(200));
  const cs = new Blob([data]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const deflated = new Uint8Array(await new Response(cs).arrayBuffer());
  const stored = createZip([{ name: "a.txt", data }]);
  // Patch the stored zip into a deflate entry (method 8, compressed size, data).
  const dv = new DataView(stored.buffer);
  const localLen = 30 + 5;
  const head = stored.slice(0, localLen);
  new DataView(head.buffer).setUint16(8, 8, true);
  new DataView(head.buffer).setUint32(18, deflated.length, true);
  const cdStart = dv.getUint32(stored.length - 22 + 16, true);
  const cd = stored.slice(cdStart, stored.length - 22);
  new DataView(cd.buffer).setUint16(10, 8, true);
  new DataView(cd.buffer).setUint32(20, deflated.length, true);
  const eocd = stored.slice(stored.length - 22);
  new DataView(eocd.buffer).setUint32(16, localLen + deflated.length, true);
  const zip = new Uint8Array([...head, ...deflated, ...cd, ...eocd]);
  const files = await unzip(zip, () => true);
  assert.equal(new TextDecoder().decode(files.get("a.txt")!), "hello ".repeat(200));
});

test("csv and json readers; bad json refused", () => {
  assert.deepEqual(parseCsvText("﻿name,email\nA,a@x.com\n"), { headers: ["name", "email"], rows: [["A", "a@x.com"]] });
  const j = parseJsonText('[{"name":"A","tags":["x"]},{"email":"b@x.com"}]');
  assert.deepEqual(j.headers, ["name", "tags", "email"]);
  assert.deepEqual(j.rows[0], ["A", '["x"]', ""]);
  assert.throws(() => parseJsonText("{bad"));
  assert.throws(() => parseJsonText('{"a":1}'));
});

test("auto-mapping by key, label or alias", () => {
  assert.deepEqual(autoMap(["Full Name", "E-mail", "Phone No"], [{ key: "full_name", label: "الاسم" }, { key: "email", label: "البريد", aliases: ["e-mail"] }, { key: "phone", label: "الهاتف", aliases: ["phone no"] }]), { full_name: "Full Name", email: "E-mail", phone: "Phone No" });
});
