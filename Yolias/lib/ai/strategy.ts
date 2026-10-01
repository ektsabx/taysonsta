import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { aiConfigured, anthropic, YOLIAS_MODEL } from "@/lib/ai/anthropic";
import { IcpSchema, type IcpCriteria } from "@/lib/discovery/icp";

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

export class StrategyAiError extends Error {}

export async function understandStrategy(prompt: string, attachments: StrategyAttachment[], ctx: StrategyContext): Promise<IcpCriteria> {
  if (!aiConfigured()) throw new StrategyAiError("Yolias AI is not configured yet (missing ANTHROPIC_API_KEY).");

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
  content.push({ type: "text", text: `<my_business>\n${business}\n</my_business>\n\n<request>\n${prompt}\n</request>` });

  try {
    const response = await anthropic().beta.messages.parse({
      model: YOLIAS_MODEL,
      max_tokens: 16000,
      // Extraction task: low effort keeps it fast and cheap.
      output_config: { effort: "low", format: betaZodOutputFormat(IcpSchema) },
      // Server-side refusal fallback: if the model declines, the API retries on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM.replace("{LANGUAGE}", ctx.language === "ar" ? "Arabic" : "English"),
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal") throw new StrategyAiError("Yolias AI couldn't process this request. Try rephrasing it.");
    if (!response.parsed_output) throw new StrategyAiError("Yolias AI returned an incomplete answer. Please try again.");
    return normalize(response.parsed_output);
  } catch (e) {
    if (e instanceof StrategyAiError) throw e;
    if (e instanceof Anthropic.RateLimitError) throw new StrategyAiError("Yolias AI is busy right now. Please try again in a moment.");
    if (e instanceof Anthropic.AuthenticationError) throw new StrategyAiError("Yolias AI credentials are invalid.");
    if (e instanceof Anthropic.APIError) throw new StrategyAiError(`Yolias AI request failed (${e.status ?? "network"}).`);
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
