"use server";

import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calendarConfigured } from "@/lib/meetings/google";

// Settings → Integrations → Google Calendar (D-268): the member's connection.
export async function calendarState(): Promise<{ available: boolean; connection: { email: string | null; status: string; error: string | null } | null }> {
  const session = await requireSession();
  const [{ data }, available] = await Promise.all([
    (await createClient()).from("calendar_connections").select("email, status, error").eq("user_id", session.userId).maybeSingle(),
    calendarConfigured(),
  ]);
  return { available, connection: data && data.status !== "disconnected" ? data : null };
}

export async function disconnectCalendar(): Promise<{ ok: true }> {
  const session = await requireSession();
  await createAdminClient().rpc("clear_calendar_token", { p_user: session.userId });
  return { ok: true };
}
