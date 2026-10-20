import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { plainDashes } from "../../lib/text.ts";

// Copy rules from the owner (2026-10-20): no em dash anywhere users read, no
// #D97706 / #D97708 orange outside the design tokens, and the removed analytics
// subtitle never comes back. Comments in code don't count.
const ROOT = new URL("../../", import.meta.url).pathname;
const DIRS = ["app", "components", "lib", "services", "supabase/templates"];
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : /\.(tsx?|css|html)$/.test(f) ? [p] : [];
});
const all = DIRS.flatMap((d) => files(join(ROOT, d)));
const comment = /^\s*(\/\/|\*|\/\*|--|\{\/\*)/;

test("no em dash in user-facing strings", () => {
  const allowed = ["lib/text.ts", "lib/notification-text.ts", "lib/ai/llm/index.ts", "lib/ai/strategy.ts"];
  const hits = all.filter((f) => !allowed.some((a) => f.endsWith(a))).flatMap((f) =>
    readFileSync(f, "utf8").split("\n").map((l, i) => ({ l, i })).filter(({ l }) => l.includes("—") && !comment.test(l)).map(({ i }) => `${f.slice(ROOT.length)}:${i + 1}`));
  assert.deepEqual(hits, []);
});

test("no orange or amber outside the design tokens", () => {
  const hits = all.filter((f) => /#(d9770[68]|f59e0b|fbbf24|b45309|ea580c|c2410c|fdba74|fff7ed|e8a317)\b/i.test(readFileSync(f, "utf8"))).map((f) => f.slice(ROOT.length));
  assert.deepEqual(hits, []);
});

test("the removed analytics subtitle stays removed", () => {
  const hits = all.filter((f) => readFileSync(f, "utf8").includes("حجم اكتساب العملاء")).map((f) => f.slice(ROOT.length));
  assert.deepEqual(hits, []);
});

test("plainDashes rewrites model text without em dashes", () => {
  assert.equal(plainDashes("Saudi SaaS — Founders", ": "), "Saudi SaaS: Founders");
  assert.equal(plainDashes("Ask anything — beginners are welcome."), "Ask anything, beginners are welcome.");
  assert.equal(plainDashes("— first item\n— second"), "- first item\n- second");
  assert.equal(plainDashes("no dash here"), "no dash here");
});
