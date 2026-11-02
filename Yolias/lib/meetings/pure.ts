// Pure helpers of meetings (D-274), apart from lib/meetings/index.ts so they
// are unit-tested without the server modules.

const HOUR = 3_600_000;

/** D-274: the booking link for one lead (?r=<lead>), so its visit is counted for the lead's campaign. */
export const leadLink = (url: string, leadId: string | null | undefined) => (leadId ? `${url}${url.includes("?") ? "&" : "?"}r=${leadId}` : url);

/** Pure: which reminder a guest is due now, if any (D-274). A day before (unless booked within the last day), then an hour before. */
export function guestReminderDue(m: { starts_at: string; created_at: string; guest_reminded_day_at: string | null; guest_reminded_hour_at: string | null }, now = Date.now()): "day" | "hour" | null {
  const until = Date.parse(m.starts_at) - now;
  if (until <= 0) return null;
  if (until <= HOUR) return m.guest_reminded_hour_at ? null : "hour";
  const bookedAhead = Date.parse(m.starts_at) - Date.parse(m.created_at);
  if (until <= 24 * HOUR && until > 2 * HOUR && bookedAhead > 24 * HOUR && !m.guest_reminded_day_at) return "day";
  return null;
}

/** Pure: a visit's state (a form left 30 minutes without booking counts as abandoned). */
export function visitState(v: { started_at: string | null; meeting_id: string | null; updated_at: string }, now = Date.now()): "visited" | "started" | "booked" | "open" {
  if (v.meeting_id) return "booked";
  if (!v.started_at) return "visited";
  return now - Date.parse(v.updated_at) > 30 * 60_000 ? "started" : "open";
}
