import "server-only";
import { z } from "zod";
import { LlmNotConfiguredError, runStructured } from "@/lib/ai/llm";
import { tasks } from "@/lib/ai/orchestrator";

// Yolias AI as the control center (D-231): what the user typed in the home
// box decides the path. A request to find companies or people becomes a
// search (Campaign Setup, as before); anything else — replies, campaigns,
// the CRM, analytics, questions — opens a conversation with the agent, which
// uses its tools. With no AI connected, a few clear phrases are recognised;
// everything else stays a search, as before.

export type Intent = "search" | "assistant";
export const INTENT_PROMPT_VERSION = "intent-2026-10-30";

const Schema = z.object({ intent: z.enum(["search", "assistant"]) });

// Unambiguous non-search requests (English and Arabic), used without AI.
const ASSISTANT = /\b(replies|reply|inbox|pause|resume|cancel|stop the campaign|my campaigns?|outreach|crm|pipeline|deals?|stage|analytics|report|stats|who (is|are) interested|meetings?)\b|الردود|رد(و)?د|صندوق الوارد|أوقف|اوقف|استأنف|الغ(ي|ِ) الحملة|حملاتي|التواصل|مرحلة|الصفقات|التحليلات|الإحصائيات|المهتمين|اجتماع/i;
const SEARCH = /\b(find|search|look for|discover|get me|list of)\b|ابحث|دور|دوّر|لاقي|هات|اكتشف|اوجد|أوجد|عايز.*شركات|شركات|مؤسسين|صناع القرار|صنّاع القرار/i;

export function ruleIntent(text: string): Intent | null {
  const a = ASSISTANT.test(text);
  const s = SEARCH.test(text);
  if (a && !s) return "assistant";
  if (s && !a) return "search";
  return null;
}

export async function classifyIntent(text: string, workspaceId: string): Promise<Intent> {
  const quick = ruleIntent(text);
  if (quick === "search") return "search";
  try {
    // A slow model must not hold the first message (D-251): after 12 s the rules decide.
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("intent timeout")), 12_000));
    const r = await Promise.race([timeout, runStructured(tasks.extraction, {
      system: [
        "Classify one message typed into a B2B customer-acquisition assistant.",
        'intent = "search" when the user wants to find new companies, local businesses or people to sell to (a new prospect search), even if they also mention a campaign afterwards.',
        'intent = "assistant" for everything else: replies and the inbox, outreach campaigns (start, pause, resume, cancel, results), meetings and the booking page, analytics, questions about Yolias or their account, writing a message.',
      ].join("\n"),
      parts: [{ kind: "text", text: text.slice(0, 2000) }],
      schema: { type: "object", properties: { intent: { type: "string", enum: ["search", "assistant"] } }, required: ["intent"], additionalProperties: false },
      schemaName: "intent",
      maxTokens: 50,
    }, (x) => { const v = Schema.safeParse(x); return v.success ? v.data.intent : null; }, { workspaceId, campaignId: null, promptVersion: INTENT_PROMPT_VERSION })]);
    return r.data;
  } catch (e) {
    if (!(e instanceof LlmNotConfiguredError)) console.error("[intent]", e instanceof Error ? e.message : e);
    return quick ?? "search";
  }
}
