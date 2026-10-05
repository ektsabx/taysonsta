import "server-only";
import { z } from "zod";
import { LlmNotConfiguredError, LlmProviderError, routesFor, runStructured } from "@/lib/ai/llm";
import type { InputPart } from "@/lib/ai/llm/types";
import { IcpSchema, parseIcp, type IcpCriteria } from "@/lib/discovery/icp";
import { cacheKey, fingerprintIcp } from "@/lib/intel/fingerprint";
import { readLlmCache, recordLlmCall, writeLlmCache } from "@/lib/intel/llm";

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
  const log = { promptVersion: ICP_PROMPT_VERSION, workspaceId: ctx.workspaceId, strategyId: ctx.strategyId };

  const business = [
    ctx.companyName && `Company: ${ctx.companyName}`,
    ctx.website && `Website: ${ctx.website}`,
    ctx.offering && `What we sell: ${ctx.offering}`,
    `Default country: ${ctx.defaultCountry}`,
  ].filter(Boolean).join("\n");

  const parts: InputPart[] = attachments.map((a): InputPart =>
    a.kind === "image" ? { kind: "image", mediaType: a.mediaType, base64: a.data }
      : a.kind === "pdf" ? { kind: "pdf", name: a.name, base64: a.data }
        : { kind: "document", name: a.name, text: a.data });
  const userText = `<my_business>\n${business}\n</my_business>\n\n<request>\n${prompt}\n</request>`;
  parts.push({ kind: "text", text: userText });

  const system = SYSTEM.replace("{LANGUAGE}", ctx.language === "ar" ? "Arabic" : "English");
  // The cached answer doesn't depend on which provider produced it.
  const key = attachments.length === 0 ? cacheKey(TASK, "any-provider", ICP_PROMPT_VERSION, system, userText.normalize("NFKC").trim()) : null;
  if (key) {
    const hit = await readLlmCache<IcpCriteria>(key).catch(() => null);
    const icp = hit ? parseIcp(hit.output) : null;
    if (icp) {
      await recordLlmCall({ ...log, task: TASK, model: "cache", cacheHit: true, ok: true, costUsd: 0 }).catch(() => {});
      return { icp, fingerprint: fingerprintIcp(icp), model: "cache", promptVersion: ICP_PROMPT_VERSION, costUsd: 0, cached: true };
    }
  }
  if (!(await routesFor(TASK)).length) throw new StrategyAiError("aiNotConfigured");

  try {
    const r = await runStructured(TASK, { system, parts, schema: icpJsonSchema, schemaName: "icp", maxTokens: 16000 }, (d) => {
      const parsed = IcpSchema.safeParse(d);
      return parsed.success ? normalize(parsed.data) : null;
    }, log);
    if (key) await writeLlmCache({ key, task: TASK, model: r.servedModel, promptVersion: ICP_PROMPT_VERSION, output: r.data, usage: r.usage, costUsd: r.costUsd }).catch(() => {});
    return { icp: r.data, fingerprint: fingerprintIcp(r.data), model: r.servedModel, promptVersion: ICP_PROMPT_VERSION, costUsd: r.costUsd, cached: false };
  } catch (e) {
    if (e instanceof LlmNotConfiguredError) throw new StrategyAiError("aiNotConfigured");
    if (e instanceof LlmProviderError) {
      const code: Record<LlmProviderError["kind"], StrategyAiErrorCode> = { auth: "aiAuth", rate_limited: "aiBusy", unavailable: "aiFailed", bad_output: "aiIncomplete", refused: "aiRefused", bad_request: "aiFailed" };
      throw new StrategyAiError(code[e.kind]);
    }
    throw e;
  }
}

const icpJsonSchema = (() => {
  const { $schema: _drop, ...rest } = z.toJSONSchema(IcpSchema, { io: "output" }) as Record<string, unknown>;
  void _drop;
  return rest;
})();

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
