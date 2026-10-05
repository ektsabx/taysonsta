import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";

export interface AgentTurn {
  role: "user" | "assistant";
  text: string;
}

/** Saved turns → API messages: starts with the user, same-role neighbours merged (a failed reply leaves two user turns). */
export function toMessages(history: AgentTurn[]): BetaMessageParam[] {
  const out: BetaMessageParam[] = [];
  for (const t of history) {
    const last = out.at(-1);
    if (!last && t.role !== "user") continue;
    if (last && last.role === t.role) last.content = `${last.content as string}\n\n${t.text}`;
    else out.push({ role: t.role, content: t.text });
  }
  return out;
}
