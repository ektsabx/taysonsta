import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const YOLIAS_MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function anthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}
