// Bilingual ICP eval (docs/07): runs tests/evals/icp-cases.json through the
// exact search-understanding request, on each configured provider separately,
// and reports a pass rate. Run on every model or prompt change. Needs at
// least one provider key; costs a few cents per run (logged in intel.llm_calls
// with task "icp.eval").
//   npm run eval:icp                         every route in llm_routing "default"
//   npm run eval:icp -- --route openai:<model>   one route
//   npm run eval:icp -- --min 0.9            fail below this pass rate
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { routesFor, runStructured, type LlmRoute } from "@/lib/ai/llm/index.ts";
import { icpRequest, validateIcp } from "@/lib/ai/strategy.ts";
import { scoreIcp, type IcpExpect } from "@/lib/ai/icp-eval.ts";

const args = process.argv.slice(2);
const arg = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const min = Number(arg("min") ?? "0.9");
const set = JSON.parse(readFileSync(new URL("../tests/evals/icp-cases.json", import.meta.url), "utf8")) as {
  context: { companyName: string; website: string; offering: string; defaultCountry: string };
  cases: { id: string; lang: "ar" | "en"; dialect: string; prompt: string; expect: IcpExpect }[];
};

const one = arg("route");
const routes: LlmRoute[] = one ? [{ provider: one.split(":")[0] as LlmRoute["provider"], model: one.split(":").slice(1).join(":") }] : await routesFor("default");
if (!routes.length) {
  console.log("No LLM provider is configured (add a key in Yolias Admin → Settings → Integrations). Nothing evaluated.");
  process.exit(2);
}

let failed = false;
const report: unknown[] = [];
for (const route of routes) {
  let checks = 0, passed = 0, cost = 0;
  console.log(`\n=== ${route.provider}:${route.model} ===`);
  for (const c of set.cases) {
    const { system, parts, schema } = icpRequest(c.prompt, [], { ...set.context, language: c.lang });
    try {
      const r = await runStructured("icp.eval", { system, parts, schema, schemaName: "icp", maxTokens: 16000 }, validateIcp, { promptVersion: "eval" }, [route]);
      cost += r.costUsd;
      const results = scoreIcp(r.data, c.expect);
      checks += results.length;
      passed += results.filter((x) => x.ok).length;
      const bad = results.filter((x) => !x.ok);
      console.log(`${bad.length ? "✗" : "✓"} ${c.id.padEnd(6)} ${c.dialect.padEnd(18)} ${bad.map((b) => `${b.check}: ${b.detail}`).join("; ")}`);
      report.push({ route, id: c.id, results });
    } catch (e) {
      checks += Object.keys(c.expect).length;
      console.log(`✗ ${c.id.padEnd(6)} ${c.dialect.padEnd(18)} error: ${e instanceof Error ? e.message.slice(0, 120) : e}`);
      report.push({ route, id: c.id, error: String(e) });
    }
  }
  const rate = checks ? passed / checks : 0;
  console.log(`→ ${(rate * 100).toFixed(1)}% of checks passed (${passed}/${checks}), cost $${cost.toFixed(4)}`);
  if (rate < min) failed = true;
}
mkdirSync(new URL("../tests/evals/results/", import.meta.url), { recursive: true });
writeFileSync(new URL(`../tests/evals/results/icp-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, import.meta.url), JSON.stringify(report, null, 2));
process.exit(failed ? 1 : 0);
