import "server-only";
import { z } from "zod";
import { runChat, runStructured, type LlmLog } from "@/lib/ai/llm";
import type { WebResult } from "@/lib/intel/capabilities";

// Yolias AI orchestrator (final spec phase 7, D-008): each kind of work goes
// to the model family that fits it, as routes in configuration
// (intel.settings "llm_routing", edited in Yolias Admin → Providers):
//   reasoning   "agent"     Claude first — the conversation, tool use, planning
//   research    "research"  Gemini first — summarising web sources into facts
//   extraction  "extract"   the smallest model that passes — classify / pull fields
//   writing     "write"     outreach emails (falls back to the default route)
// A route whose provider has no key is skipped, so the next one serves; every
// call is logged with its cost (rule 28). Code, not an LLM, does scoring,
// dedup, matching and quota (rule 24).

export const tasks = { reasoning: "agent", research: "research", extraction: "extract", writing: "write" } as const;

type Log = Omit<LlmLog, "task">;

const RESEARCH_SYSTEM = `You summarise web sources about a company for a B2B sales team.
Use only the sources given. Every fact must come from them; if they don't say, write "not found".
Reply in {LANGUAGE}, in at most 8 short "-" lines: what the company does, who it sells to, size and locations, recent news or hiring, and anything relevant to the question. End with the source URLs you used.`;

/** A research summary of web sources (research route). */
export async function researchSummary(question: string, sources: (WebResult & { text?: string | null })[], language: "en" | "ar", log: Log) {
  const material = sources.slice(0, 8).map((s, i) => `[${i + 1}] ${s.title}\n${s.url}\n${(s.text ?? s.snippet ?? "").slice(0, 3000)}`).join("\n\n");
  const r = await runChat(tasks.research, {
    system: RESEARCH_SYSTEM.replace("{LANGUAGE}", language === "ar" ? "Arabic" : "English"),
    messages: [{ role: "user", text: `Question: ${question}\n\nSources:\n${material}` }],
    tools: [],
    maxTokens: 1200,
    maxIterations: 1,
  }, log);
  return { summary: r.reply, costUsd: r.costUsd, unpricedCalls: r.unpricedCalls, provider: r.route.provider, model: r.route.model };
}

export const CompanyFactsSchema = z.object({
  industry: z.string().nullable(),
  employee_range: z.string().nullable().describe('e.g. "11-50"'),
  headquarters_city: z.string().nullable(),
  country: z.string().nullable().describe("ISO 3166-1 alpha-2"),
  sells_to: z.string().nullable(),
  hiring: z.boolean().nullable(),
});
export type CompanyFacts = z.infer<typeof CompanyFactsSchema>;

/** Structured facts pulled from research text (extraction route). Unknown = null, never guessed. */
export async function extractCompanyFacts(text: string, log: Log): Promise<{ facts: CompanyFacts; costUsd: number; unpricedCalls: number }> {
  const { $schema: _drop, ...schema } = z.toJSONSchema(CompanyFactsSchema) as Record<string, unknown>;
  void _drop;
  const r = await runStructured(tasks.extraction, {
    system: "Extract the requested fields from the text. Use null for anything the text doesn't state. Never guess.",
    parts: [{ kind: "text", text: text.slice(0, 12_000) }],
    schema,
    schemaName: "company_facts",
    maxTokens: 400,
  }, (d) => {
    const p = CompanyFactsSchema.safeParse(d);
    return p.success ? p.data : null;
  }, log);
  return { facts: r.data, costUsd: r.costUsd, unpricedCalls: r.unpricedCalls };
}
