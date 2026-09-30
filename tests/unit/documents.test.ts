import { test } from "node:test";
import assert from "node:assert/strict";
import { renderTemplate, templateVariables, validateTemplate, TemplateSyntaxError } from "@/lib/bos/documents/template";
import { parseMarkup, inlineText } from "@/lib/bos/documents/markup";
import { documentHtml, defaultDocStyle, type DocFrame } from "@/lib/bos/documents/html";
import { documentDocx } from "@/lib/bos/documents/docx";
import { readZip, crc32 } from "@/lib/bos/documents/zip";

// Document engine (docs/bos/30 §3.5, §8; doc 31 Phase 5).
const opts = { locale: "en" as const, formatMoney: (v: unknown, c: string | null | undefined) => `${Number(v).toFixed(2)} ${c}`, formatDate: (d: string) => `D:${d}` };

test("template: values, loops with @index, if/else/unless, helpers", () => {
  const src = "Dear {{client.name}}\n{{#each lines}}| {{@index}} | {{description}} | {{money total ../cur}} |\n{{/each}}{{#if tax}}Tax {{tax}}{{else}}No tax{{/if}}{{#unless paid}} — unpaid{{/unless}} due {{date due}}";
  const out = renderTemplate(src, { client: { name: "Acme" }, lines: [{ description: "Design", total: "10" }, { description: "Build", total: "5.5" }], tax: 0, paid: false, due: "2026-10-01" }, opts);
  assert.match(out, /Dear Acme/);
  assert.match(out, /\| 1 \| Design \|/);
  assert.match(out, /\| 2 \| Build \|/);
  assert.match(out, /No tax — unpaid due D:2026-10-01/);
  assert.equal(renderTemplate("{{ifrs}}", { ifrs: "x" }, opts), "x", "a variable starting with a keyword is still a variable");
  assert.equal(renderTemplate("{{#each a}}{{money amount ../cur}};{{/each}}", { cur: "EGP", a: [{ amount: 1 }] }, opts), "1.00 EGP;", "../ reads the enclosing scope");
  assert.equal(renderTemplate("{{money x USD}}", { x: 2 }, opts), "2.00 USD", "literal currency code");
  assert.equal(renderTemplate("{{money x missing.path}}", { x: 2 }, opts), "2.00 ", "unknown path is not printed as text");
});

test("template: client data can't inject document structure", () => {
  const out = renderTemplate("| {{name}} |", { name: "A | B **bold** [[pagebreak]]\n# H" }, opts);
  const blocks = parseMarkup(out);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "table");
  const cells = (blocks[0] as { rows: unknown[][] }).rows[0];
  assert.equal(cells.length, 1, "pipe in data didn't create a cell");
  assert.equal(inlineText(cells[0] as never), "A | B **bold** [[pagebreak]]\n# H");
});

test("template: syntax errors and variable listing", () => {
  assert.throws(() => renderTemplate("{{#each x}}", {}, opts), TemplateSyntaxError);
  assert.throws(() => renderTemplate("{{/if}}", {}, opts), TemplateSyntaxError);
  assert.equal(validateTemplate("{{#if a}}x{{/if}}"), null);
  assert.deepEqual(templateVariables("{{a.b}} {{money t c}} {{#each lines}}{{q}}{{/each}}"), ["a.b", "c", "lines", "lines[].q", "t"]);
});

test("markup: headings, lists, tables with header, rule, page break, signatures", () => {
  const b = parseMarkup("# Title\n\nPara **b** *i*\nline2\n\n- a\n- b\n\n1. one\n2. two\n\n| H1 | H2 |\n|---|---|\n| x | y |\n\n---\n[[pagebreak]]\n[[signatures: Company | Client]]");
  assert.deepEqual(b.map((x) => x.type), ["heading", "para", "list", "list", "table", "hr", "pagebreak", "signatures"]);
  const t = b[4] as { header: unknown[]; rows: unknown[][] };
  assert.equal(t.header.length, 2);
  assert.equal(t.rows.length, 1);
});

const frame = (dir: "rtl" | "ltr"): DocFrame => ({ dir, lang: dir === "rtl" ? "ar" : "en", title: "Test <doc>", style: defaultDocStyle, logoUrl: null, headerLines: ["Taysonsta", "CR 123"], footerLines: ["footer"] });

test("html: escaped, directional, self-contained", () => {
  const html = documentHtml(parseMarkup("# <script>alert(1)</script>\n\nمرحبا"), frame("rtl"));
  assert.match(html, /dir="rtl"/);
  assert.ok(!html.includes("<script>alert"), "content is escaped");
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /مرحبا/);
});

// Minimal XML well-formedness check (tags balance, attributes quoted).
function wellFormed(xml: string): boolean {
  const stack: string[] = [];
  const re = /<(\/)?([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+="[^"]*")*)\s*(\/)?>|<\?[^>]*\?>/g;
  const stripped = xml.replace(re, (m, close, name, _attrs, self) => {
    if (m.startsWith("<?")) return "";
    if (close) {
      if (stack.pop() !== name) throw new Error(`mismatched </${name}>`);
    } else if (!self) stack.push(name);
    return "";
  });
  if (/<|>/.test(stripped)) throw new Error(`stray markup: ${stripped.match(/.{0,30}[<>].{0,30}/)?.[0]}`);
  return stack.length === 0;
}

test("docx: valid OOXML package, RTL markers for Arabic, content preserved, logo embedded", () => {
  const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));
  const bytes = documentDocx(parseMarkup("# عقد خدمات\n\nبين **الشركة** والعميل & شركاه\n\n- بند أول\n- بند ثانٍ\n\n1. أولاً\n\n| البند | المبلغ |\n|---|---|\n| تصميم | 1,000 |\n\n[[signatures: الشركة | العميل]]"), frame("rtl"), { bytes: png, type: "png" });
  const files = readZip(bytes);
  for (const part of ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml", "word/numbering.xml", "word/header1.xml", "word/footer1.xml", "word/_rels/document.xml.rels", "word/_rels/header1.xml.rels", "word/media/logo.png", "docProps/core.xml"]) {
    assert.ok(files.has(part), `missing ${part}`);
  }
  const dec = new TextDecoder();
  for (const [name, data] of files) if (name.endsWith(".xml") || name.endsWith(".rels")) assert.ok(wellFormed(dec.decode(data)), `${name} well-formed`);
  const doc = dec.decode(files.get("word/document.xml")!);
  assert.match(doc, /<w:bidi\/>/, "RTL paragraphs");
  assert.match(doc, /<w:bidiVisual\/>/, "RTL tables");
  assert.match(doc, /<w:rtl\/>/, "RTL runs");
  assert.match(doc, /عقد خدمات/);
  assert.match(doc, /والعميل &amp; شركاه/, "text escaped");
  assert.match(doc, /w:numId w:val="1"/);
  assert.match(dec.decode(files.get("word/header1.xml")!), /r:embed="rIdLogo"/);
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926, "standard CRC-32");

  const en = readZip(documentDocx(parseMarkup("# Contract\n\nHello"), frame("ltr")));
  assert.ok(!dec.decode(en.get("word/document.xml")!).includes("<w:bidi/>"), "LTR document has no RTL markers");
  assert.ok(!en.has("word/media/logo.png"));
});
