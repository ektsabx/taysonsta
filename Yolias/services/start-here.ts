import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { StartSteps } from "@/components/app/StartHere";

// Start here (owner, 2026-10-28; on the dashboard since D-270): each step is
// done from real rows, read as the member (RLS: their workspace).
export async function startSteps(workspaceId: string, userId: string): Promise<StartSteps> {
  const db = await createClient();
  const [mailboxes, made, approved, calendar, page] = await Promise.all([
    db.from("mailboxes").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "connected"),
    db.from("outreach_campaigns").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    db.from("outreach_campaigns").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).not("approved_at", "is", null),
    db.from("calendar_connections").select("user_id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "connected"),
    db.from("booking_pages").select("created_at, updated_at").eq("user_id", userId).maybeSingle(),
  ]);
  return {
    mailbox: (mailboxes.count ?? 0) > 0,
    search: (made.count ?? 0) > 0,
    campaign: (approved.count ?? 0) > 0,
    // The booking page is set once Google Calendar is connected or the page was edited (D-269).
    booking: (calendar.count ?? 0) > 0 || (!!page.data && page.data.updated_at > page.data.created_at),
  };
}
