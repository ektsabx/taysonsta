import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Stops a lead's active outreach (enrollments → stopped) and cancels the
 * follow-up drafts that were not sent. Sent messages and replies stay in the
 * history. Returns how many enrollments were stopped.
 */
export async function stopFollowUps(leadId: string, reason: string, status: "stopped" | "replied" = "stopped"): Promise<number> {
  return (await stopEnrollments(leadId, reason, status)).length;
}

/** stopFollowUps, returning the ids of the enrollments it stopped. */
export async function stopEnrollments(leadId: string, reason: string, status: "stopped" | "replied" = "stopped"): Promise<string[]> {
  const db = createAdminClient();
  const { data: stopped } = await db.from("outreach_enrollments")
    .update({ status, stop_reason: reason.slice(0, 200), next_step_at: null })
    .eq("lead_id", leadId).in("status", ["active", "paused"]).select("id");
  const ids = (stopped ?? []).map((e) => e.id);
  if (ids.length) {
    await db.from("outreach_messages").update({ status: "canceled" })
      .in("enrollment_id", ids).eq("direction", "outbound").in("status", ["draft", "approved"]);
  }
  return ids;
}

/**
 * Out of office: the lead's next follow-up waits `days` instead of the
 * sequence stopping (an auto-reply is not a person answering). Active
 * enrollments move their next step to `days` from now unless it was already
 * later; `resume` gives back the enrollments a reply had just stopped (their
 * canceled drafts are written again when the step comes due).
 */
export async function postponeFollowUps(leadId: string, days: number, resume: string[] = []): Promise<number> {
  const db = createAdminClient();
  const at = new Date(Date.now() + days * 86_400_000).toISOString();
  const { data: moved } = await db.from("outreach_enrollments").update({ next_step_at: at })
    .eq("lead_id", leadId).eq("status", "active").not("next_step_at", "is", null).lt("next_step_at", at).select("id");
  let n = moved?.length ?? 0;
  if (resume.length) {
    const { data: back } = await db.from("outreach_enrollments").update({ status: "active", stop_reason: null, next_step_at: at })
      .in("id", resume).eq("lead_id", leadId).eq("status", "replied").select("id");
    n += back?.length ?? 0;
  }
  return n;
}
