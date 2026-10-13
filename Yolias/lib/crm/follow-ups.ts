import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Stops a lead's active outreach (enrollments → stopped) and cancels the
 * follow-up drafts that were not sent. Sent messages and replies stay in the
 * history. Returns how many enrollments were stopped.
 */
export async function stopFollowUps(leadId: string, reason: string, status: "stopped" | "replied" = "stopped"): Promise<number> {
  const db = createAdminClient();
  const { data: stopped } = await db.from("outreach_enrollments")
    .update({ status, stop_reason: reason.slice(0, 200), next_step_at: null })
    .eq("lead_id", leadId).in("status", ["active", "paused"]).select("id");
  const ids = (stopped ?? []).map((e) => e.id);
  if (ids.length) {
    await db.from("outreach_messages").update({ status: "canceled" })
      .in("enrollment_id", ids).eq("direction", "outbound").in("status", ["draft", "approved"]);
  }
  return ids.length;
}
