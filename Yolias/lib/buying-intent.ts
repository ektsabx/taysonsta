// Will this person buy? (owner, 2026-11-05). Yolias AI reads it from the whole
// conversation; replies analysed before that fall back on the kind of reply.
export type BuyingIntent = "high" | "medium" | "low";
export const BUYING_INTENTS: BuyingIntent[] = ["high", "medium", "low"];

export function buyingIntent(saved: string | null | undefined, kind: string | null | undefined): BuyingIntent | null {
  if (saved === "high" || saved === "medium" || saved === "low") return saved;
  if (kind === "meeting_request" || kind === "interested") return "high";
  if (kind === "question" || kind === "objection" || kind === "asks_for_human") return "medium";
  if (kind === "not_interested" || kind === "stop_request") return "low";
  return null;
}
