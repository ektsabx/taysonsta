import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { aiConfigured, anthropic, YOLIAS_MODEL } from "@/lib/ai/anthropic";
import { IcpSchema, parseIcp, type IcpCriteria } from "@/lib/discovery/icp";
import { cacheKey, fingerprintIcp } from "@/lib/intel/fingerprint";
import { priceCall, readLlmCache, recordLlmCall, writeLlmCache } from "@/lib/intel/llm";

// Yolias AI — step 1 of every strategy: understand who the user wants to sell
// to and turn it into structured ICP criteria. The workspace's onboarding
// answers are permanent context; the ICP itself always comes from the request.

export interface StrategyAttachment {
  name: string;
  mediaType: string;
  /** base64 for images / PDF, plain text for text-like files */
  data: string;
  kind: "image" | "pdf" | "text";
}

export interface StrategyContext {
  userName: string | null;
  companyName: string | null;
  website: string | null;
  offering: string | null;
  defaultCountry: string;
  language: "en" | "ar";
  /** For cost attribution (intel.llm_calls). */
  workspaceId: string;
  strategyId: string;
}

/** Bump when SYSTEM or the ICP schema changes: cached answers of older versions are not reused. */
export const ICP_PROMPT_VERSION = "icp-2026-10-01";
const TASK = "icp.parse";

export interface UnderstoodStrategy {
  icp: IcpCriteria;
  fingerprint: string;
  model: string;
  promptVersion: string;
  costUsd: number | null;
  cached: boolean;
}

const SYSTEM = `You are Yolias, an autonomous customer-discovery assistant.
Your job in this step is to understand who the user wants to sell to and express it as an Ideal Customer Profile (ICP) for a discovery campaign.

Rules:
- Extract only what the user asked for. Where the request is silent, choose a sensible default for a B2B discovery mission and record it in "assumptions".
- Use the user's own business (what they sell) to infer which decision-maker job titles are relevant when they don't name any.
- countries are ISO 3166-1 alpha-2 codes. If no market is given, use the user's default country and say so in "assumptions".
- target_count is the number the user asked for (default 100). target_unit says whether it counts companies or people.
- campaign_name is short and specific, in the form "<Market> <Segment> — <Decision makers>".
- Attached files or images may describe the ICP; use them.
- Write campaign_name, summary and assumptions in {LANGUAGE}.`;

export type StrategyAiErrorCode = "aiNotConfigured" | "aiRefused" | "aiIncomplete" | "aiBusy" | "aiAuth" | "aiFailed";

/** Carries a dictionary key (strategy.errors.*) so the UI can show it in any language. */
export class StrategyAiError extends Error {
  constructor(public code: StrategyAiErrorCode) {
    super(code);
  }
}

// Step 1 of every search (docs/07: an allowed LLM task). Same request with
// the same business context, model and prompt version ⇒ the cached answer,
// no new call (requests with attachments are always sent). Every call — and
// every cache hit — is logged with its cost in intel.llm_calls.
export async function understandStrategy(prompt: string, attachments: StrategyAttachment[], ctx: StrategyContext): Promise<UnderstoodStrategy> {
  const base = { model: YOLIAS_MODEL, promptVersion: ICP_PROMPT_VERSION };
  const log = { task: TASK, model: YOLIAS_MODEL, promptVersion: ICP_PROMPT_VERSION, workspaceId: ctx.workspaceId, strategyId: ctx.strategyId };

  const business = [
    ctx.companyName && `Company: ${ctx.companyName}`,
    ctx.website && `Website: ${ctx.website}`,
    ctx.offering && `What we sell: ${ctx.offering}`,
    `Default country: ${ctx.defaultCountry}`,
  ].filter(Boolean).join("\n");

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const a of attachments) {
    if (a.kind === "image") {
      content.push({ type: "image", source: { type: "base64", media_type: a.mediaType as "image/png", data: a.data } });
    } else if (a.kind === "pdf") {
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: a.data }, title: a.name });
    } else {
      content.push({ type: "document", source: { type: "text", media_type: "text/plain", data: a.data }, title: a.name });
    }
  }
  const userText = `<my_business>\n${business}\n</my_business>\n\n<request>\n${prompt}\n</request>`;
  content.push({ type: "text", text: userText });

  const system = SYSTEM.replace("{LANGUAGE}", ctx.language === "ar" ? "Arabic" : "English");
  const key = attachments.length === 0 ? cacheKey(TASK, YOLIAS_MODEL, ICP_PROMPT_VERSION, system, userText.normalize("NFKC").trim()) : null;
  if (key) {
    const hit = await readLlmCache<IcpCriteria>(key).catch(() => null);
    const icp = hit ? parseIcp(hit.output) : null;
    if (icp) {
      await recordLlmCall({ ...log, cacheHit: true, ok: true, costUsd: 0 }).catch(() => {});
      return { ...base, icp, fingerprint: fingerprintIcp(icp), costUsd: 0, cached: true };
    }
  }
  if (!aiConfigured()) throw new StrategyAiError("aiNotConfigured");

  const started = Date.now();
  try {
    const response = await anthropic().beta.messages.parse({
      model: YOLIAS_MODEL,
      max_tokens: 16000,
      // Extraction task: low effort keeps it fast and cheap.
      output_config: { effort: "low", format: betaZodOutputFormat(IcpSchema) },
      // Server-side refusal fallback: if the model declines, the API retries on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: [{ role: "user", content }],
    });
    const usage = response.usage;
    const costUsd = await priceCall(YOLIAS_MODEL, usage).catch(() => null);
    const served = { ...log, servedModel: response.model, usage, costUsd, latencyMs: Date.now() - started };
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      await recordLlmCall({ ...served, ok: false, error: response.stop_reason ?? "no output" }).catch(() => {});
      throw new StrategyAiError(response.stop_reason === "refusal" ? "aiRefused" : "aiIncomplete");
    }
    const icp = normalize(response.parsed_output);
    await recordLlmCall({ ...served, ok: true }).catch(() => {});
    if (key) await writeLlmCache({ key, task: TASK, model: YOLIAS_MODEL, promptVersion: ICP_PROMPT_VERSION, output: icp, usage, costUsd }).catch(() => {});
    return { ...base, icp, fingerprint: fingerprintIcp(icp), costUsd, cached: false };
  } catch (e) {
    if (e instanceof StrategyAiError) throw e;
    await recordLlmCall({ ...log, ok: false, error: e instanceof Error ? e.message.slice(0, 300) : "failed", latencyMs: Date.now() - started }).catch(() => {});
    if (e instanceof Anthropic.RateLimitError) throw new StrategyAiError("aiBusy");
    if (e instanceof Anthropic.AuthenticationError) throw new StrategyAiError("aiAuth");
    if (e instanceof Anthropic.APIError) throw new StrategyAiError("aiFailed");
    throw e;
  }
}

function normalize(icp: IcpCriteria): IcpCriteria {
  const count = Number.isFinite(icp.target_count) ? Math.round(icp.target_count) : 100;
  return {
    ...icp,
    target_count: Math.min(Math.max(count, 1), 10000),
    countries: [...new Set(icp.countries.map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c)))],
    employees_min: icp.employees_min != null && icp.employees_min >= 0 ? icp.employees_min : null,
    employees_max: icp.employees_max != null && icp.employees_max > 0 ? icp.employees_max : null,
  };
}
