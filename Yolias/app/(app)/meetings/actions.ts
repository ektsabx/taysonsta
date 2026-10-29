"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDictionary } from "@/lib/i18n/server";
import { meetingChanged } from "@/lib/crm";
import { cancelMeeting, ensureBookingPage } from "@/lib/meetings";
import { DAYS, isTime } from "@/lib/meetings/availability";
import { isValidTimeZone } from "@/lib/regions";
import type { MeetingStatus } from "@/types/database";

// Meetings (D-267): the member's booking page settings and their bookings.
type R = { ok: true } | { ok: false; error: string };

const range = z.tuple([z.string().refine(isTime), z.string().refine(isTime)]).refine(([a, b]) => a < b);
const pageInput = z.object({
  enabled: z.boolean(),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/),
  title: z.string().trim().min(1).max(120),
  location: z.string().trim().max(300),
  description: z.string().trim().max(500),
  duration_min: z.number().int().min(10).max(240),
  timezone: z.string().refine(isValidTimeZone),
  buffer_min: z.number().int().min(0).max(120),
  min_notice_hours: z.number().int().min(0).max(336),
  window_days: z.number().int().min(1).max(90),
  hours: z.object(Object.fromEntries(DAYS.map((d) => [d, z.array(range).max(3)])) as Record<(typeof DAYS)[number], z.ZodArray<typeof range>>),
});

export async function saveBookingPage(input: z.input<typeof pageInput>): Promise<R> {
  const session = await requireSession();
  const t = (await getDictionary()).meetings.errors;
  const p = pageInput.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.path[0] === "slug" ? t.slug : t.invalid };
  await ensureBookingPage(session.userId, session.workspace.id, session.profile.full_name, session.email, session.profile.timezone ?? null, session.profile.language);
  const { error } = await createAdminClient().from("booking_pages").update({ ...p.data, location: p.data.location || null, description: p.data.description || null }).eq("user_id", session.userId);
  if (error) return { ok: false, error: error.code === "23505" ? t.slugTaken : t.invalid };
  revalidatePath("/meetings");
  return { ok: true };
}

export async function disconnectCalendar(): Promise<R> {
  const session = await requireSession();
  await createAdminClient().rpc("clear_calendar_token", { p_user: session.userId });
  revalidatePath("/meetings");
  return { ok: true };
}

export async function setMeetingStatus(id: string, status: MeetingStatus): Promise<R> {
  const session = await requireSession();
  const t = (await getDictionary()).meetings.errors;
  if (!z.string().uuid().safeParse(id).success || !["scheduled", "completed", "canceled", "no_show"].includes(status)) return { ok: false, error: t.invalid };
  if (status === "canceled") {
    const ok = await cancelMeeting({ id, userId: session.userId });
    revalidatePath("/meetings");
    return ok ? { ok: true } : { ok: false, error: t.invalid };
  }
  const db = await createClient();
  const { data: old } = await db.from("sales_meetings").select("status, lead_id").eq("id", id).eq("workspace_id", session.workspace.id).maybeSingle();
  if (!old) return { ok: false, error: t.invalid };
  const { data: saved } = await db.from("sales_meetings").update({ status }).eq("id", id).select("id, lead_id, status").single();
  if (!saved) return { ok: false, error: t.invalid };
  await meetingChanged(db, session.workspace.id, saved, old.status, "user");
  revalidatePath("/meetings");
  revalidatePath(`/crm/${old.lead_id}`);
  return { ok: true };
}
