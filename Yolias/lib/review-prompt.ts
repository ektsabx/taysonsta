import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Session } from "@/lib/session";
import { POPUPS_KEY, parsePopups } from "@/lib/popups";

// Review request (Trustpilot, 2026-10-12; D-276: managed in Yolias Admin →
// Popups). Asked once per user, only after a real success in their
// workspace, the one the owner picks: the first meeting booked (default),
// the first interested reply, or the first campaign launched. Once shown, it
// never comes back, on any device. Returns the review link, or null.
export async function reviewPrompt(session: Session): Promise<string | null> {
  if (session.profile.review_prompted_at) return null;
  const db = createAdminClient();
  const { data: setting } = await db.from("site_settings").select("value").eq("key", POPUPS_KEY).maybeSingle();
  const { review } = parsePopups(setting?.value);
  if (!review.enabled) return null;
  const ws = session.workspace.id;
  let reached = false;
  if (review.trigger === "first_campaign") {
    const { count } = await db.from("outreach_campaigns").select("id", { count: "exact", head: true }).eq("workspace_id", ws).not("approved_at", "is", null);
    reached = (count ?? 0) > 0;
  } else if (review.trigger === "first_positive_reply") {
    const { count } = await db.from("outreach_messages").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("direction", "inbound").in("analysis->>kind", ["interested", "meeting_request"]);
    reached = (count ?? 0) > 0;
  } else {
    const { count } = await db.from("sales_meetings").select("id", { count: "exact", head: true }).eq("workspace_id", ws).neq("status", "canceled");
    reached = (count ?? 0) > 0;
  }
  return reached ? review.url : null;
}
