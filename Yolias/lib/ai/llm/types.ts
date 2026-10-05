// Provider-agnostic LLM contract (rule 25: no model lock-in). Product code
// asks for a task; lib/ai/llm/index.ts picks the configured providers in
// order and falls back to the next one when a call fails.

export type LlmProvider = "anthropic" | "openai" | "gemini";

export interface LlmRoute {
  provider: LlmProvider;
  model: string;
}

export interface LlmUsageCount {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export type InputPart =
  | { kind: "text"; text: string }
  | { kind: "image"; mediaType: string; base64: string }
  | { kind: "pdf"; name: string; base64: string }
  | { kind: "document"; name: string; text: string };

export interface StructuredRequest {
  system: string;
  parts: InputPart[];
  /** JSON Schema of the expected object (validated again with zod by the caller). */
  schema: Record<string, unknown>;
  schemaName: string;
  maxTokens: number;
}

export interface StructuredResult {
  data: unknown;
  usage: LlmUsageCount;
  servedModel: string;
  refused: boolean;
}

export interface ChatTool {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  /** Returns the tool result as a string (JSON). */
  run: (input: unknown) => Promise<string>;
}

export interface ChatRequest {
  /** Stable instructions (cached where the provider supports it). */
  system: string;
  /** Per-request context appended after the stable part (not cached). */
  context?: string;
  /** Plain text turns, oldest first, starting with the user. */
  messages: { role: "user" | "assistant"; text: string }[];
  tools: ChatTool[];
  maxTokens: number;
  maxIterations: number;
}

/** One model call inside a chat loop (each is logged with its cost). */
export interface ChatStep {
  servedModel: string;
  usage: LlmUsageCount;
  latencyMs: number;
  refused: boolean;
}

export interface ChatResult {
  reply: string;
  steps: ChatStep[];
}

/** An error worth trying the next provider for (network, 429, 5xx, bad output, refusal). */
export class LlmProviderError extends Error {
  constructor(
    message: string,
    public kind: "auth" | "rate_limited" | "unavailable" | "bad_output" | "refused" | "bad_request",
    public steps: ChatStep[] = [],
  ) {
    super(message);
  }
}

export interface LlmAdapter {
  configured(): boolean;
  structured(model: string, req: StructuredRequest): Promise<StructuredResult>;
  chat(model: string, req: ChatRequest): Promise<ChatResult>;
}

/** HTTP status → error kind (shared by the fetch-based adapters). */
export function errorKind(status: number): LlmProviderError["kind"] {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "unavailable";
  return "bad_request";
}
