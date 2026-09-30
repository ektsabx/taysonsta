import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import en from "@/lib/bos/i18n/en";
import { translate, dirFor, hasTranslation } from "@/lib/bos/i18n/core";

// Interface language (docs/bos/30 §4, doc 31 Phase 2).

const ROOT = process.cwd();
const AR = /[؀-ۿ]/;
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

test("translate: Arabic is the source, English from the dictionary, safe fallbacks", () => {
  assert.equal(translate("ar", "حفظ"), "حفظ");
  assert.equal(translate("en", "حفظ"), "Save");
  assert.equal(translate("en", "  حفظ \n "), "Save", "whitespace is normalised like JSX text");
  assert.equal(translate("en", "صفحة {page} من {total}", { page: 2, total: 9 }), "Page 2 of 9");
  assert.equal(translate("ar", "صفحة {page} من {total}", { page: 2, total: 9 }), "صفحة 2 من 9");
  assert.equal(translate("en", "نص غير موجود في القاموس"), "نص غير موجود في القاموس", "missing entry falls back to Arabic, never empty");
  assert.equal(dirFor("ar"), "rtl");
  assert.equal(dirFor("en"), "ltr");
});

test("dictionary: English values are English and keep every placeholder", () => {
  for (const [k, v] of Object.entries(en as Record<string, string>)) {
    assert.ok(v.trim().length > 0, `empty translation for ${k}`);
    assert.ok(!AR.test(v), `Arabic left in the English value of “${k}”`);
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
    assert.equal(ph(v), ph(k), `placeholders differ for “${k}”`);
  }
});

test("every string sent through t()/<Tx>/<Opt> has an English entry", () => {
  const patterns = [
    /<Tx(?: vars=\{\{.*?\}\})?>\{("(?:[^"\\]|\\.)*")\}<\/Tx>/g,
    /\b(?:t|tt|tr)\(("(?:[^"\\]|\\.)*")/g,
    /<Tx>([^<>{}]+)<\/Tx>/g,
    /<Opt[^>]*>([^<>{}]+)<\/Opt>/g,
  ];
  const missing = new Set<string>();
  for (const dir of ["app/admin", "components/bos", "components/admin", "lib/bos", "services/bos"]) {
    for (const file of sources(join(ROOT, dir))) {
      const src = readFileSync(file, "utf8");
      patterns.forEach((re, i) => {
        for (const m of src.matchAll(re)) {
          let v = m[1];
          if (i < 2) {
            try {
              v = JSON.parse(v);
            } catch {
              continue;
            }
          }
          v = norm(v);
          if (AR.test(v) && !hasTranslation(v)) missing.add(v);
        }
      });
    }
  }
  assert.deepEqual([...missing], [], `untranslated keys:\n${[...missing].join("\n")}`);
});

test("navigation labels are all translated", async () => {
  const { navigation } = await import("@/lib/bos/nav");
  for (const g of navigation) {
    assert.ok(hasTranslation(g.label), g.label);
    for (const i of g.items ?? []) assert.ok(hasTranslation(i.label), i.label);
  }
});

test("themes: every token of the dark theme is redefined for light and system", () => {
  const css = readFileSync(join(ROOT, "app/admin/bos.css"), "utf8");
  const block = (sel: string) => {
    const start = css.indexOf(sel);
    assert.ok(start >= 0, sel);
    return css.slice(start, css.indexOf("}", start));
  };
  const tokens = (b: string) => new Set([...b.matchAll(/(--bos-[\w-]+):/g)].map((m) => m[1]));
  const dark = tokens(block(".admin-shell {\n  --bos-fg-rgb"));
  const light = tokens(block('.admin-shell[data-theme="light"]'));
  const system = tokens(block('.admin-shell[data-theme="system"]'));
  const themed = [...dark].filter((t) => !["--bos-border", "--bos-border-strong", "--bos-text", "--bos-muted", "--bos-faint", "--bos-accent", "--bos-radius"].includes(t));
  for (const t of themed) {
    assert.ok(light.has(t), `light theme misses ${t}`);
    assert.ok(system.has(t), `system theme misses ${t}`);
  }
  assert.ok(!/rgba\(\s*255\s*,\s*255\s*,\s*255/.test(css.replace(/@media print[\s\S]*$/, "")), "no hard-coded white overlays outside print");
});
