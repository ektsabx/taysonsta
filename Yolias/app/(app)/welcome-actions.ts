"use server";

import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";

/** The welcome video was watched or closed: don't open it again on its own (the menu still can). */
export async function markWelcomeSeen(): Promise<void> {
  const session = await requireSession();
  if (session.profile.welcome_video_seen_at) return;
  await (await createClient()).from("profiles").update({ welcome_video_seen_at: new Date().toISOString() }).eq("id", session.userId);
}
