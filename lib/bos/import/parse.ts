// Import file parsing (docs/bos/30 §27): CSV, JSON (array of objects) and
// XLSX (first sheet). XLSX is read with a minimal ZIP reader + Web Streams
// inflate — no third-party parser, no macros or formulas executed (cell
// values only). Output: headers + rows of strings.

import { parseCsv } from "@/lib/bos/ads/csv";

export interface Parsed { headers: string[]; rows: string[][] }
export const MAX_ROWS = 20000;

const clean = (h: string, i: number) => (h ?? "").toString().trim() || `Column ${i + 1}`;

export function parseCsvText(text: string): Parsed {
  const all = parseCsv(text.replace(/^﻿/, ""));
  if (!all.length) return { headers: [], rows: [] };
  const headers = all[0].map(clean);
  return { headers, rows: all.slice(1, MAX_ROWS + 1).map((r) => headers.map((_, i) => (r[i] ?? "").trim())) };
}

export function parseJsonText(text: string): Parsed {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("ملف JSON غير صالح.");
  }
  const arr = Array.isArray(data) ? data : Array.isArray((data as { data?: unknown[] })?.data) ? (data as { data: unknown[] }).data : null;
  if (!arr) throw new Error("يجب أن يحتوي JSON على مصفوفة من السجلات.");
  const objs = arr.filter((x) => x && typeof x === "object" && !Array.isArray(x)) as Record<string, unknown>[];
  const headers = [...new Set(objs.flatMap((o) => Object.keys(o)))].slice(0, 200);
  const cell = (v: unknown) => (v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)).trim();
  return { headers, rows: objs.slice(0, MAX_ROWS).map((o) => headers.map((h) => cell(o[h]))) };
}

// ---------------------------------------------------------------- XLSX

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function unzip(buf: Uint8Array, wanted: (name: string) => boolean): Promise<Map<string, Uint8Array>> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("ملف XLSX غير صالح.");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = new Map<string, Uint8Array>();
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("ملف XLSX تالف.");
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const usize = dv.getUint32(p + 24, true);
    const nlen = dv.getUint16(p + 28, true);
    const elen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + elen + clen;
    if (!wanted(name)) continue;
    if (usize > 60 * 1024 * 1024) throw new Error("محتوى الملف كبير جداً.");
    const lnlen = dv.getUint16(local + 26, true);
    const lelen = dv.getUint16(local + 28, true);
    const start = local + 30 + lnlen + lelen;
    const raw = buf.subarray(start, start + csize);
    if (method === 0) out.set(name, raw);
    else if (method === 8) out.set(name, await inflateRaw(raw));
    else throw new Error("ضغط غير مدعوم في ملف XLSX.");
  }
  return out;
}

const unesc = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&amp;/g, "&");

function colIndex(ref: string) {
  const letters = ref.replace(/\d+/g, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

// Excel serial date → YYYY-MM-DD for cells formatted as dates is not
// guessed: values are returned as stored; the date field parser accepts serials.
export async function parseXlsx(buf: Uint8Array): Promise<Parsed> {
  const files = await unzip(buf, (n) => n === "xl/sharedStrings.xml" || n === "xl/workbook.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  const dec = new TextDecoder();
  const shared: string[] = [];
  const ss = files.get("xl/sharedStrings.xml");
  if (ss) for (const m of dec.decode(ss).matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(unesc([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join("")));
  const sheetName = [...files.keys()].filter((k) => k.startsWith("xl/worksheets/")).sort()[0];
  if (!sheetName) throw new Error("لا توجد أوراق في الملف.");
  const xml = dec.decode(files.get(sheetName)!);
  const table: string[][] = [];
  for (const row of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const c of row[1].matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const type = /t="([^"]+)"/.exec(attrs)?.[1];
      const body = c[2] ?? "";
      let v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "";
      if (type === "s") v = shared[Number(v)] ?? "";
      else if (type === "inlineStr") v = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join("");
      else if (type === "b") v = v === "1" ? "true" : "false";
      v = unesc(v); // formulas (<f>) are ignored — only the cached value is used
      const idx = ref ? colIndex(ref) : cells.length;
      cells[idx] = v;
    }
    table.push(Array.from(cells, (x) => (x ?? "").trim()));
    if (table.length > MAX_ROWS + 1) break;
  }
  if (!table.length) return { headers: [], rows: [] };
  const width = Math.max(...table.map((r) => r.length));
  const headers = Array.from({ length: width }, (_, i) => clean(table[0][i] ?? "", i));
  return { headers, rows: table.slice(1).filter((r) => r.some((x) => x)).map((r) => headers.map((_, i) => r[i] ?? "")) };
}

export async function parseImportFile(format: "csv" | "xlsx" | "json", bytes: Uint8Array): Promise<Parsed> {
  if (format === "xlsx") return parseXlsx(bytes);
  const text = new TextDecoder("utf-8").decode(bytes);
  return format === "json" ? parseJsonText(text) : parseCsvText(text);
}

// Auto-mapping: header ↔ field by normalised name or known aliases.
export function autoMap(headers: string[], fields: { key: string; label: string; aliases?: string[] }[]) {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_\-./]+/g, "");
  const map: Record<string, string> = {};
  for (const f of fields) {
    const names = [f.key, f.label, ...(f.aliases ?? [])].map(norm);
    const h = headers.find((x) => names.includes(norm(x)));
    if (h) map[f.key] = h;
  }
  return map;
}
