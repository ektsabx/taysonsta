import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { integrationSecret } from "@/lib/integrations";

export const YOLIAS_MODEL = "claude-opus-5-5";

let client: { key: string; sdk: Anthropic } | null = null;

/** The SDK with the key from Yolias Admin → Integrations (D-132); rebuilt when the key changes. */
export function anthropic(): Anthropic {
  const key = integrationSecret("anthropic", "api_key") ?? "";
  if (client?.key !== key) client = { key, sdk: new Anthropic({ apiKey: key, baseURL: process.env.ANTHROPIC_BASE_URL || undefined }) };
  return client.sdk;
}
