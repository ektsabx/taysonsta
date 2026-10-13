import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WorkspaceRow } from "@/types/database";

// Free trial (owner brief 2026-10-12, D-184): 7 days on the plan the member
// chose, card required by the payment provider, with trial limits (50
// prospects, 50 emails, 50 uploaded contacts). The first payment converts it
// to the full plan; what the trial used is deducted from that first paid
// month (convert_trial, usage_summary). One trial per workspace. Egypt pays
// the first period through Paymob instead (no trial there yet).
//
// Limits are configuration: site_settings "yolias_trial" (the database reads
// the same row in usage_summary / monthly_limit).

export const TRIAL_KEY = "yolias_trial";

export interface TrialLimits {
  days: number;
  prospects: number;
  emails: number;
  contacts: number;
}

export const DEFAULT_TRIAL: TrialLimits = { days: 7, prospects: 50, emails: 50, contacts: 50 };

export function parseTrial(raw: unknown): TrialLimits {
  const out = { ...DEFAULT_TRIAL };
  if (!raw || typeof raw !== "object") return out;
  for (const k of Object.keys(out) as (keyof TrialLimits)[]) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 100_000) out[k] = v;
  }
  return out;
}

export async function trialLimits(): Promise<TrialLimits> {
  try {
    const { data } = await createAdminClient().from("site_settings").select("value").eq("key", TRIAL_KEY).maybeSingle();
    return parseTrial(data?.value);
  } catch {
    return DEFAULT_TRIAL;
  }
}

/** A workspace gets one trial, ever. */
export function canStartTrial(ws: Pick<WorkspaceRow, "trial_started_at">): boolean {
  return !ws.trial_started_at;
}

/** Whole days left in a running trial (0 on the last day). */
export function trialDaysLeft(ws: Pick<WorkspaceRow, "subscription_status" | "trial_ends_at">, now = new Date()): number | null {
  if (ws.subscription_status !== "trialing" || !ws.trial_ends_at) return null;
  return Math.max(0, Math.ceil((new Date(ws.trial_ends_at).getTime() - now.getTime()) / 86_400_000));
}
