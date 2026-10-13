import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/session";

// Trustpilot review request (2026-10-12). Asked once per user, only after a
// real success: a search this user started has delivered results. Everyone
// who reaches that point is asked the same way (no filtering on how happy
// they are) and nothing is offered in return, as Trustpilot's guidelines
// require. Once shown, it never comes back, on any device.

export async function shouldAskForReview(session: Session): Promise<boolean> {
  if (session.profile.review_prompted_at) return false;
  const supabase = await createClient();
  const { data: campaigns } = await supabase.from("campaigns").select("id").eq("workspace_id", session.workspace.id).eq("created_by", session.userId).limit(200);
  if (!campaigns?.length) return false;
  const { count } = await supabase.from("companies").select("id", { count: "exact", head: true })
    .in("campaign_id", campaigns.map((c) => c.id)).not("delivered_at", "is", null).limit(1);
  return (count ?? 0) > 0;
}
