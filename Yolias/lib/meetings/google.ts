import "server-only";
import { integrationSecret, loadIntegrations } from "@/lib/integrations";

// Google Calendar for booked meetings (D-267), with the same Google OAuth app
// as Gmail (Yolias Admin → Integrations → google_oauth). One scope beyond the
// sign-in: calendar.app.created, so Yolias can only create and edit calendars
// it made itself; the member's other calendars stay private. On connect
// Yolias creates "Yolias meetings"; every booking becomes an event there and
// Google emails the invitation to the guest.

const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/calendar/v3";
// calendar.freebusy (D-269): only whether a time is busy in the member's own
// calendar, never what the events are, so the booking page skips those times.
const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.app.created", "https://www.googleapis.com/auth/calendar.freebusy"];

export class CalendarError extends Error {
  constructor(public kind: "not_configured" | "auth" | "failed", message: string) {
    super(message);
  }
}

async function keys() {
  await loadIntegrations();
  const id = integrationSecret("google_oauth", "client_id");
  const secret = integrationSecret("google_oauth", "client_secret");
  if (!id || !secret) throw new CalendarError("not_configured", "Google OAuth isn't set in Yolias Admin");
  return { id, secret };
}

export async function calendarConfigured(): Promise<boolean> {
  try { await keys(); return true; } catch { return false; }
}

export async function authorizeUrl(state: string, redirectUri: string): Promise<string> {
  const { id } = await keys();
  const q = new URLSearchParams({ client_id: id, redirect_uri: redirectUri, response_type: "code", scope: SCOPES.join(" "), access_type: "offline", prompt: "consent", include_granted_scopes: "true", state });
  return `${AUTH}?${q}`;
}

export async function exchange(code: string, redirectUri: string): Promise<{ refreshToken: string; accessToken: string; email: string | null }> {
  const { id, secret } = await keys();
  const res = await fetch(TOKEN, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: redirectUri, grant_type: "authorization_code" }) });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; scope?: string };
  if (!res.ok || !body.access_token || !body.refresh_token) throw new CalendarError("auth", "google token exchange failed");
  if (!(body.scope ?? "").split(/\s+/).includes(SCOPES[2])) throw new CalendarError("auth", "calendar permission not granted");
  const me = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${body.access_token}` } }).then((r) => r.json()).catch(() => ({})) as { email?: string };
  return { refreshToken: body.refresh_token, accessToken: body.access_token, email: me.email?.toLowerCase() ?? null };
}

export async function accessToken(refreshToken: string): Promise<string> {
  const { id, secret } = await keys();
  const res = await fetch(TOKEN, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ refresh_token: refreshToken, client_id: id, client_secret: secret, grant_type: "refresh_token" }) });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!res.ok || !body.access_token) throw new CalendarError(body.error === "invalid_grant" ? "auth" : "failed", `google refresh failed: ${body.error ?? res.status}`);
  return body.access_token;
}

async function call<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(20_000) });
  if (res.status === 401 || res.status === 403) throw new CalendarError("auth", `calendar ${res.status}`);
  if (res.status === 404 || res.status === 410) return null as T;
  if (!res.ok) throw new CalendarError("failed", `calendar ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (res.status === 204 ? null : await res.json()) as T;
}

/** true when this Google account can still open the calendar (a reconnect keeps the same "Yolias meetings"). */
export async function calendarExists(token: string, calendarId: string): Promise<boolean> {
  try {
    return Boolean(await call<{ id: string } | null>(token, `/calendars/${encodeURIComponent(calendarId)}`));
  } catch {
    return false;
  }
}

/** The calendar Yolias owns in the member's Google Calendar. */
export async function createCalendar(token: string, timeZone: string): Promise<string> {
  const c = await call<{ id: string }>(token, "/calendars", { method: "POST", body: JSON.stringify({ summary: "Yolias meetings", description: "Meetings booked through Yolias.", timeZone }) });
  return c.id;
}

export interface EventInput { summary: string; description: string; start: string; end: string; timeZone: string; guest: { email: string; name: string }; location: string | null }

/** One event with the guest invited (Google sends the invitation). */
export async function createEvent(token: string, calendarId: string, e: EventInput): Promise<{ id: string }> {
  const body = {
    summary: e.summary, description: e.description, location: e.location ?? undefined,
    start: { dateTime: e.start, timeZone: e.timeZone }, end: { dateTime: e.end, timeZone: e.timeZone },
    attendees: [{ email: e.guest.email, displayName: e.guest.name }],
  };
  const r = await call<{ id: string }>(token, `/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`, { method: "POST", body: JSON.stringify(body) });
  return { id: r.id };
}

/** The guest's answer to the invitation on an event Yolias created (D-273): accepted, declined, tentative or not answered. */
export async function guestResponse(token: string, calendarId: string, eventId: string, guestEmail: string): Promise<"accepted" | "declined" | "tentative" | "needsAction" | null> {
  const r = await call<{ attendees?: { email?: string; responseStatus?: string }[] } | null>(token, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`);
  const a = r?.attendees?.find((x) => x.email?.toLowerCase() === guestEmail.toLowerCase());
  const s = a?.responseStatus;
  return s === "accepted" || s === "declined" || s === "tentative" || s === "needsAction" ? s : null;
}

/** true when Google deleted the event (and told the guest); false when it wasn't in this calendar. */
export async function cancelEvent(token: string, calendarId: string, eventId: string): Promise<boolean> {
  const res = await fetch(`${API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
  if (res.status === 401 || res.status === 403) throw new CalendarError("auth", `calendar ${res.status}`);
  if (res.status === 404 || res.status === 410) return false;
  if (!res.ok) throw new CalendarError("failed", `calendar ${res.status}`);
  return true;
}

/** Busy times in the member's primary calendar. denied: the connection has no calendar.freebusy permission. */
export async function busyTimes(token: string, from: string, to: string): Promise<{ busy: { start: string; end: string }[]; denied: boolean }> {
  const res = await fetch(`${API}/freeBusy`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ timeMin: from, timeMax: to, items: [{ id: "primary" }] }), signal: AbortSignal.timeout(20_000) }).catch(() => null);
  if (!res) return { busy: [], denied: false };
  if (res.status === 401 || res.status === 403) return { busy: [], denied: true };
  if (!res.ok) return { busy: [], denied: false };
  const r = await res.json().catch(() => null) as { calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: { reason?: string }[] }> } | null;
  const p = r?.calendars?.primary;
  return { busy: p?.busy ?? [], denied: Boolean(p?.errors?.some((e) => e.reason === "notFound" || e.reason === "forbidden" || e.reason === "insufficientPermissions")) };
}
