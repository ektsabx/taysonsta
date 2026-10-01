import type { CampaignStatus } from "@/types/database";

// Campaign lifecycle (docs/05 "Campaign states"). Pure, shared by UI and worker.

/** Stages a running discovery job moves through, in order. */
export const runningStates = [
  "discovering_companies",
  "matching_companies",
  "discovering_people",
  "enriching",
  "verifying",
  "researching",
  "scoring",
  "delivering",
] as const satisfies readonly CampaignStatus[];

export function isRunning(status: CampaignStatus): boolean {
  return (runningStates as readonly string[]).includes(status);
}

/** Waiting for, or in, the background job. */
export function isActive(status: CampaignStatus): boolean {
  return status === "created" || status === "queued" || isRunning(status);
}

export function isFinished(status: CampaignStatus): boolean {
  return status === "completed" || status === "partial" || status === "failed";
}

/** Outcome when the work is done: fewer than asked is "partial", with a reason the user sees. */
export function finalState(found: number, target: number): { status: "completed" | "partial"; partialReason: string | null } {
  if (found >= target) return { status: "completed", partialReason: null };
  return { status: "partial", partialReason: found === 0 ? "no_matches" : "fewer_matches" };
}
