import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { meetingChanged } from "@/lib/crm";
import { notify, siteUrl, userRecipient, type Recipient } from "@/lib/email/notify";
import { freeSlots, isFree, type DaySlots } from "./availability";
import { accessToken, cancelEvent, createCalendar, createEvent, CalendarError } from "./google";
import type { BookingPageRow } from "@/types/database";

// Meetings inside Yolias (owner, 2026-10-30, D-267): each member's booking
// page at yolias.com/meet/<slug>, bookings that land in the CRM, optional
// Google Calendar with a Meet link, emails to the host and the guest, and a
// cancel link for the guest. Server only; the public page reads through here.

type Db = ReturnType<typeof createAdminClient>;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

export function bookingUrl(slug: string): string {
  return `${siteUrl()}/meet/${slug}`;
}

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);

/** The member's booking page, created with defaults the first time (slug from their name or email). */
export async function ensureBookingPage(userId: string, workspaceId: string, name: string | null, email: string, timezone: string | null, language: "en" | "ar" = "en"): Promise<BookingPageRow> {
  const db = createAdminClient();
  const { data: have } = await db.from("booking_pages").select("*").eq("user_id", userId).maybeSingle();
  if (have) return have;
  const base = slugify(name ?? "") .length >= 3 ? slugify(name ?? "") : slugify(email.split("@")[0]).padEnd(3, "0");
  for (let i = 0; i < 20; i++) {
    const slug = i ? `${base}-${i + 1}` : base;
    const { data, error } = await db.from("booking_pages").insert({ user_id: userId, workspace_id: workspaceId, slug, timezone: timezone || "Africa/Cairo", title: language === "ar" ? "اجتماع" : "Meeting" }).select("*").single();
    if (data) return data;
    if (error && error.code !== "23505") throw error;
    const { data: again } = await db.from("booking_pages").select("*").eq("user_id", userId).maybeSingle();
    if (again) return again;
  }
  throw new Error("no free booking link");
}

export async function pageBySlug(slug: string): Promise<(BookingPageRow & { host: { name: string; company: string | null } }) | null> {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return null;
  const db = createAdminClient();
  const { data: page } = await db.from("booking_pages").select("*").eq("slug", slug).maybeSingle();
  if (!page) return null;
  const [{ data: p }, { data: w }] = await Promise.all([
    db.from("profiles").select("full_name, email").eq("id", page.user_id).maybeSingle(),
    db.from("workspaces").select("name").eq("id", page.workspace_id).maybeSingle(),
  ]);
  return { ...page, host: { name: p?.full_name || p?.email?.split("@")[0] || "", company: w?.name ?? null } };
}

async function busy(db: Db, hostId: string, days: number) {
  const { data } = await db.from("sales_meetings").select("starts_at, ends_at").eq("host_id", hostId).eq("status", "scheduled")
    .gte("starts_at", new Date(Date.now() - 86_400_000).toISOString()).lte("starts_at", new Date(Date.now() + (days + 2) * 86_400_000).toISOString());
  return (data ?? []).map((m) => ({ start: m.starts_at, end: m.ends_at ?? new Date(Date.parse(m.starts_at) + 30 * 60_000).toISOString() }));
}

export async function slotsFor(page: BookingPageRow): Promise<DaySlots[]> {
  return freeSlots(page, await busy(createAdminClient(), page.user_id, page.window_days));
}

/** The next free times of a member's page, for the agent to offer in a reply. */
export async function nextSlots(userId: string, count = 2): Promise<{ url: string; slots: string[]; timezone: string } | null> {
  const db = createAdminClient();
  const { data: page } = await db.from("booking_pages").select("*").eq("user_id", userId).eq("enabled", true).maybeSingle();
  if (!page) return null;
  const days = await slotsFor(page);
  // One time on each of the first days, so the guest gets a real choice.
  const picks = days.slice(0, count).map((d) => d.slots[Math.min(1, d.slots.length - 1)]);
  return { url: bookingUrl(page.slug), slots: picks, timezone: page.timezone };
}

export type BookError = "not_found" | "closed" | "invalid" | "taken";

export async function book(input: { slug: string; start: string; name: string; email: string; note?: string | null }): Promise<{ ok: true; start: string; end: string; url: string | null; location: string | null } | { ok: false; error: BookError }> {
  const db = createAdminClient();
  const page = await pageBySlug(input.slug);
  if (!page) return { ok: false, error: "not_found" };
  if (!page.enabled) return { ok: false, error: "closed" };
  const name = input.name.trim().slice(0, 120);
  const email = input.email.trim().toLowerCase();
  const note = input.note?.trim().slice(0, 1000) || null;
  if (name.length < 2 || !EMAIL.test(email) || Number.isNaN(Date.parse(input.start))) return { ok: false, error: "invalid" };
  const start = new Date(input.start).toISOString();
  if (!isFree(page, await busy(db, page.user_id, page.window_days), start)) return { ok: false, error: "taken" };
  const end = new Date(Date.parse(start) + page.duration_min * 60_000).toISOString();

  // The guest is a lead of the host's workspace: the same person keeps one record.
  const { data: found } = await db.from("sales_leads").select("id").eq("workspace_id", page.workspace_id).ilike("email", email).limit(1).maybeSingle();
  let leadId = found?.id ?? null;
  if (!leadId) {
    const { data: made } = await db.from("sales_leads").insert({ workspace_id: page.workspace_id, lead_key: `email:${email}`, name, email, source: "manual", created_by: page.user_id, owner_id: page.user_id }).select("id").maybeSingle();
    leadId = made?.id ?? (await db.from("sales_leads").select("id").eq("workspace_id", page.workspace_id).eq("lead_key", `email:${email}`).maybeSingle()).data?.id ?? null;
  }
  if (!leadId) return { ok: false, error: "invalid" };

  const { data: meeting, error } = await db.from("sales_meetings").insert({
    workspace_id: page.workspace_id, lead_id: leadId, title: `${page.title}: ${name}`.slice(0, 200), starts_at: start, ends_at: end, status: "scheduled",
    source: "booking", host_id: page.user_id, guest_name: name, guest_email: email, guest_note: note, location: page.location, created_by: page.user_id,
  }).select("id, lead_id, status, cancel_token").single();
  if (error?.code === "23505") return { ok: false, error: "taken" };
  if (error || !meeting) throw error ?? new Error("meeting not saved");
  await meetingChanged(db, page.workspace_id, meeting, null, "system").catch((e) => console.error("[meetings] stage", e));
  await db.from("lead_activities").insert({ workspace_id: page.workspace_id, lead_id: leadId, kind: "meeting_scheduled", actor_kind: "system", body: `Booked "${page.title}" from the booking page.`, meta: { meeting_id: meeting.id, source: "booking" } });

  // Google Calendar (optional): the event with the guest invited, and a Meet link when no place is set.
  let url: string | null = null;
  const cal = await calendarAccess(db, page.user_id);
  if (cal) {
    try {
      const ev = await createEvent(cal.token, cal.calendarId, {
        summary: `${page.title}: ${name}`, description: [page.description, note && `Note from ${name}: ${note}`, `Booked with Yolias.`].filter(Boolean).join("\n\n"),
        start, end, timeZone: page.timezone, guest: { email, name }, location: page.location, meet: !page.location,
      });
      url = ev.meetUrl;
      await db.from("sales_meetings").update({ google_event_id: ev.id, ...(url ? { url } : {}) }).eq("id", meeting.id);
    } catch (e) {
      await calendarFailed(db, page.user_id, e);
    }
  }
  if (!url && page.location && /^https?:\/\//i.test(page.location)) {
    url = page.location;
    await db.from("sales_meetings").update({ url }).eq("id", meeting.id);
  }

  await tellHost(db, page, "booked", { meetingId: meeting.id, leadId, name, email, start, url, note });
  const guest: Recipient = { userId: null, email, locale: "en", prefs: {} };
  await notify("meeting_guest", [guest], {
    hostName: page.host.name, company: page.host.company, title: page.title, start, end, timeZone: page.timezone, location: page.location, url,
    calendarInvite: Boolean(cal), cancelUrl: `${siteUrl()}/meet/c/${meeting.cancel_token}`,
  }, { workspaceId: page.workspace_id, dedupe: meeting.id });
  return { ok: true, start, end, url, location: page.location };
}

/** Cancels a booking: by the guest (their link) or by the host (Meetings). The other side is told. */
export async function cancelMeeting(by: { token: string } | { id: string; userId: string }, reason?: string | null): Promise<boolean> {
  const db = createAdminClient();
  const q = db.from("sales_meetings").select("*").eq("status", "scheduled");
  const { data: m } = await ("token" in by ? q.eq("cancel_token", by.token) : q.eq("id", by.id)).maybeSingle();
  if (!m) return false;
  if ("id" in by) {
    const { data: member } = await db.from("workspace_members").select("user_id").eq("workspace_id", m.workspace_id).eq("user_id", by.userId).maybeSingle();
    if (!member) return false;
  }
  await db.from("sales_meetings").update({ status: "canceled", notes: [m.notes, reason && `Canceled: ${reason.slice(0, 300)}`].filter(Boolean).join("\n").slice(0, 6000) || null }).eq("id", m.id);
  const host = m.host_id ?? m.created_by;
  if (m.google_event_id && host) {
    const cal = await calendarAccess(db, host);
    if (cal) await cancelEvent(cal.token, cal.calendarId, m.google_event_id).catch((e) => calendarFailed(db, host, e));
  }
  await db.from("lead_activities").insert({ workspace_id: m.workspace_id, lead_id: m.lead_id, kind: "meeting_updated", actor_kind: "token" in by ? "system" : "user", actor_id: "id" in by ? by.userId : null, body: "token" in by ? "The guest canceled the meeting." : "Meeting canceled.", meta: { meeting_id: m.id } });
  const { data: page } = host ? await db.from("booking_pages").select("*").eq("user_id", host).maybeSingle() : { data: null };
  if ("token" in by && page) {
    const full = await pageBySlug(page.slug);
    if (full) await tellHost(db, full, "canceled", { meetingId: m.id, leadId: m.lead_id, name: m.guest_name ?? "", email: m.guest_email ?? "", start: m.starts_at, url: m.url, note: reason ?? null });
  }
  if ("id" in by && m.guest_email && !m.google_event_id) {
    // Google tells the guest itself when the event had been sent from Google Calendar.
    await notify("meeting_guest_canceled", [{ userId: null, email: m.guest_email, locale: "en", prefs: {} }], { title: m.title, start: m.starts_at, timeZone: page?.timezone ?? "UTC" }, { workspaceId: m.workspace_id, dedupe: m.id });
  }
  return true;
}

async function tellHost(db: Db, page: BookingPageRow & { host: { name: string } }, what: "booked" | "canceled", d: { meetingId: string; leadId: string; name: string; email: string; start: string; url: string | null; note: string | null }) {
  const { data: p } = await db.from("profiles").select("language, timezone").eq("id", page.user_id).maybeSingle();
  const tz = p?.timezone || page.timezone;
  const ar = p?.language === "ar";
  const at = new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-US", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(d.start));
  const title = what === "booked" ? (ar ? `${d.name} حجز اجتماعًا ${at}` : `${d.name} booked a meeting, ${at}`) : (ar ? `${d.name} ألغى اجتماع ${at}` : `${d.name} canceled the meeting on ${at}`);
  await db.from("notifications").upsert({ user_id: page.user_id, workspace_id: page.workspace_id, kind: "meeting", title: title.slice(0, 300), body: d.note?.slice(0, 1000) ?? null, link: `/crm/${d.leadId}`, dedupe_key: `meeting-${what}:${d.meetingId}:${page.user_id}` }, { onConflict: "dedupe_key", ignoreDuplicates: true });
  const atEn = new Intl.DateTimeFormat("en-US", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: tz, timeZoneName: "short" }).format(new Date(d.start));
  await notify(what === "booked" ? "meeting_booked" : "meeting_canceled", await userRecipient(page.user_id), { guest: d.name, guestEmail: d.email, time: atEn, leadId: d.leadId, url: d.url, note: d.note }, { workspaceId: page.workspace_id, dedupe: d.meetingId });
}

/** A working token and Yolias's calendar for the member, or null when Google Calendar isn't connected. */
async function calendarAccess(db: Db, userId: string): Promise<{ token: string; calendarId: string } | null> {
  const { data: c } = await db.from("calendar_connections").select("calendar_id, status").eq("user_id", userId).maybeSingle();
  if (!c || c.status === "disconnected") return null;
  const { data: refresh } = await db.rpc("calendar_token", { p_user: userId });
  if (!refresh) return null;
  try {
    const token = await accessToken(refresh);
    let calendarId = c.calendar_id;
    if (!calendarId) {
      const { data: page } = await db.from("booking_pages").select("timezone").eq("user_id", userId).maybeSingle();
      calendarId = await createCalendar(token, page?.timezone ?? "UTC");
      await db.from("calendar_connections").update({ calendar_id: calendarId }).eq("user_id", userId);
    }
    if (c.status === "error") await db.from("calendar_connections").update({ status: "connected", error: null }).eq("user_id", userId);
    return { token, calendarId };
  } catch (e) {
    await calendarFailed(db, userId, e);
    return null;
  }
}

async function calendarFailed(db: Db, userId: string, e: unknown) {
  console.error("[meetings] google calendar", e instanceof Error ? e.message : e);
  await db.from("calendar_connections").update({ status: "error", error: e instanceof CalendarError && e.kind === "auth" ? "Reconnect Google Calendar" : "Google Calendar didn't answer" }).eq("user_id", userId);
}
