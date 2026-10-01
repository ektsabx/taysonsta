// Cost of a call from registry/settings prices (rule 14: prices are config).

export interface LlmPrice {
  /** USD per million input tokens */
  input: number;
  /** USD per million output tokens */
  output: number;
  cache_read_multiplier?: number;
  cache_write_multiplier?: number;
}

export interface LlmUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

/** null when the model has no price configured (shown as "unpriced", never as $0). */
export function llmCostUsd(usage: LlmUsage, price: LlmPrice | undefined): number | null {
  if (!price) return null;
  const read = usage.cache_read_input_tokens ?? 0;
  const write = usage.cache_creation_input_tokens ?? 0;
  const usd =
    (usage.input_tokens * price.input +
      read * price.input * (price.cache_read_multiplier ?? 0.1) +
      write * price.input * (price.cache_write_multiplier ?? 1.25) +
      usage.output_tokens * price.output) /
    1_000_000;
  return Math.round(usd * 1_000_000) / 1_000_000;
}

export interface CapabilityPrice {
  unit?: string;
  unit_cost_usd?: number;
}

export function unitCost(pricing: unknown, capability: string): number | null {
  const p = (pricing as Record<string, CapabilityPrice> | null)?.[capability];
  return typeof p?.unit_cost_usd === "number" && p.unit_cost_usd >= 0 ? p.unit_cost_usd : null;
}
