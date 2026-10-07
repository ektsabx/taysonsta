import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { OutreachMessageRow } from "@/types/database";

// Messages Yolias prepared for one prospect (email and LinkedIn), newest
// first. Read with the member's own client (RLS).
export async function messagesFor(prospectId: string): Promise<OutreachMessageRow[]> {
  const db = await createClient();
  const { data } = await db.from("outreach_messages").select("*").eq("prospect_id", prospectId).order("created_at", { ascending: false }).limit(10);
  return data ?? [];
}
