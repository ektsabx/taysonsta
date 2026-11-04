import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Strict positioning (owner, 2026-11-05): an AI advertising platform for anyone
// with a business. Old framing can't come back through any page, title or seed.

const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : []; });
const lines = (f: string) => readFileSync(f, "utf8").split("\n").map((l, i) => ({ f, n: i + 1, l })).filter((x) => !/^\s*(\/\/|\*|\/\*)/.test(x.l) && !/primary_keyword|secondary_keywords/.test(x.l));
const copy = [...walk("lib/content"), ...walk("scripts/seo-seed").filter((f) => !f.endsWith("keywords.ts")), ...walk("lib/i18n/dictionaries"), ...walk("app/(marketing)")];

test("no CRM wording in anything a person reads", () => {
  const bad = copy.flatMap(lines).filter((x) => /CRM|إدارة (ال)?عملاء|ادارة العملاء/.test(x.l));
  assert.deepEqual(bad.map((x) => `${x.f}:${x.n}`), []);
});

test("Yolias is never framed as a B2B or prospecting tool", () => {
  const ours = copy.filter((f) => !/competitors|pages-compare|ws-(en|ar)/.test(f));
  const bad = ours.flatMap(lines).filter((x) => /\bB2B\b|عملاء الشركات|\bProspecting\b/.test(x.l));
  assert.deepEqual(bad.map((x) => `${x.f}:${x.n}: ${x.l.trim().slice(0, 80)}`), []);
});
