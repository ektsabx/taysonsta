import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { runChat } from "@/lib/ai/llm";
import { applyGuardrails, buildSystemPrompt, detectLanguage, policyVersion } from "@/lib/agent/policy";
import type { Json } from "@/types/database";

// Evaluation of a policy version (D-141): the owner's test cases are sent to
// the model with that version's system prompt (no tools, no workspace data),
// the reply passes the same guardrail as in production, and each case checks
// what must / must not appear. Queued from Yolias Admin; run by the worker
// one at a time so it never blocks discovery jobs.

export async function runQueuedEval(): Promise<void> {
  const db = createAdminClient();
  const { data: run } = await db.from("agent_eval_runs").select("*").eq("status", "queued").order("created_at").limit(1).maybeSingle();
  if (!run) return;
  // Claim it (another worker tick may be looking at the same row).
  const { data: claimed } = await db.from("agent_eval_runs").update({ status: "running" }).eq("id", run.id).eq("status", "queued").select("id").maybeSingle();
  if (!claimed) return;
  await runEval(run.id, run.policy_version);
}

/** Runs one evaluation (already marked "running"). */
export async function runEval(runId: string, policyVersionNumber: number): Promise<void> {
  const db = createAdminClient();
  const run = { id: runId, policy_version: policyVersionNumber };
  try {
    const active = await policyVersion(run.policy_version);
    if (!active) throw new Error(`policy version ${run.policy_version} not found`);
    const { data: cases } = await db.from("agent_eval_cases").select("*").eq("active", true).order("created_at");
    const system = buildSystemPrompt(active.policy);
    const results: { caseId: string; name: string; passed: boolean; reply: string; missing: string[]; found: string[]; guardrailHits: number; costUsd: number }[] = [];
    let cost = 0;
    for (const c of cases ?? []) {
      const r = await runChat("agent", {
        system, context: "Evaluation run: no workspace data and no tools are available.", tools: [],
        maxTokens: Math.min(active.policy.limits.maxOutputTokens, 2000), maxIterations: 1,
        messages: [{ role: "user", text: c.prompt }],
      }, { promptVersion: `eval/p${active.version}` });
      const { text, hits } = applyGuardrails(r.reply, active.policy, detectLanguage(c.prompt));
      const low = text.toLowerCase();
      const missing = c.must_include.filter((w) => !low.includes(w.toLowerCase()));
      const found = c.must_not_include.filter((w) => low.includes(w.toLowerCase()));
      cost += r.costUsd;
      results.push({ caseId: c.id, name: c.name, passed: !missing.length && !found.length, reply: text.slice(0, 2000), missing, found, guardrailHits: hits, costUsd: r.costUsd });
    }
    await db.from("agent_eval_runs").update({
      status: "done", total: results.length, passed: results.filter((x) => x.passed).length,
      cost_usd: Math.round(cost * 1e6) / 1e6, results: results as unknown as Json, finished_at: new Date().toISOString(),
    }).eq("id", run.id);
  } catch (e) {
    await db.from("agent_eval_runs").update({ status: "failed", error: (e instanceof Error ? e.message : String(e)).slice(0, 500), finished_at: new Date().toISOString() }).eq("id", run.id);
  }
}
