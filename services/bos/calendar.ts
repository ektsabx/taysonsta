import "server-only";
import { db } from "@/lib/bos/db";
import { getTeamUserIds, type BosUser } from "@/lib/bos/auth";
import { managedUserIds } from "@/services/bos/team-scope";

// Unified calendar (docs/bos/14): meetings, follow-ups, leave, holidays and
// own attendance, scope-filtered.

export interface CalendarItem {
  id: string;
  type: "meeting" | "follow_up" | "leave" | "attendance" | "holiday";
  title: string;
  start: string; // ISO date or datetime
  allDay: boolean;
  href: string | null;
  status?: string | null;
  who?: string | null;
}

export const calendarTypeLabels: Record<CalendarItem["type"], string> = {
  meeting: "اجتماعات",
  follow_up: "متابعات",
  leave: "إجازات",
  attendance: "حضوري",
  holiday: "عطلات",
};

export async function getCalendarItems(bos: BosUser, from: string, to: string, f: { scope?: string; client?: string; types?: string[] }) {
  const c = db();
  const team = f.scope === "team";
  const users = team ? [...new Set([...(await getTeamUserIds(bos)), ...(await managedUserIds(bos))])] : [bos.userId];
  const want = (t: CalendarItem["type"]) => !f.types?.length || f.types.includes(t);
  const fromTs = `${from}T00:00:00Z`;
  const toTs = `${to}T23:59:59Z`;
  const { data: emps } = await c.from("employees").select("user_id, full_name").not("user_id", "is", null);
  const nameOf = new Map((emps ?? []).map((e) => [e.user_id as string, e.full_name]));
  const items: CalendarItem[] = [];

  const jobs: Promise<void>[] = [];
  if (want("meeting") && bos.permissions.get("meetings.read")) {
    jobs.push((async () => {
      const { data: attended } = await c.from("meeting_attendees").select("meeting_id").in("user_id", users);
      const ids = (attended ?? []).map((a) => a.meeting_id);
      let q = c.from("meetings").select("id, title, start_at, status, organizer_id, client_id").gte("start_at", fromTs).lte("start_at", toTs);
      q = q.or([`organizer_id.in.(${users.join(",")})`, ...(ids.length ? [`id.in.(${ids.join(",")})`] : [])].join(","));
      if (f.client) q = q.eq("client_id", f.client);
      const { data } = await q;
      for (const m of data ?? []) items.push({ id: m.id, type: "meeting", title: m.title, start: m.start_at, allDay: false, href: `/admin/communication/meetings/${m.id}`, status: m.status, who: m.organizer_id ? nameOf.get(m.organizer_id) : null });
    })());
  }
  if (want("follow_up") && bos.permissions.get("activities.read")) {
    jobs.push((async () => {
      let q = c.from("activities").select("id, title, due_at, start_at, status, assigned_to, type, deal_id, lead_id, client_id").in("status", ["pending", "in_progress", "overdue"]).in("assigned_to", users).is("archived_at", null).gte("due_at", fromTs).lte("due_at", toTs);
      if (f.client) q = q.eq("client_id", f.client);
      const { data } = await q;
      for (const a of data ?? []) items.push({ id: a.id, type: "follow_up", title: a.title, start: a.due_at as string, allDay: false, href: a.deal_id ? `/admin/sales/deals/${a.deal_id}?tab=activities` : a.lead_id ? `/admin/sales/leads/${a.lead_id}?tab=activities` : "/admin/sales/activities", status: a.status, who: a.assigned_to ? nameOf.get(a.assigned_to) : null });
    })());
  }
  if (want("leave") && !f.client) {
    jobs.push((async () => {
      const { data } = await c.from("leave_requests").select("id, user_id, start_date, end_date, status, half_day, leave_types(name)").in("user_id", users).in("status", ["approved", "pending"]).lte("start_date", to).gte("end_date", from);
      for (const l of data ?? []) {
        for (let d = l.start_date > from ? l.start_date : from; d <= l.end_date && d <= to; d = new Date(new Date(`${d}T00:00:00Z`).getTime() + 86400_000).toISOString().slice(0, 10)) {
          items.push({ id: `${l.id}:${d}`, type: "leave", title: `${nameOf.get(l.user_id) ?? ""} — ${(l.leave_types as unknown as { name: string } | null)?.name ?? "إجازة"}${l.half_day ? " (نصف يوم)" : ""}`, start: d, allDay: true, href: "/admin/team/leave?view=calendar", status: l.status });
        }
      }
    })());
  }
  if (want("holiday") && !f.client) {
    jobs.push((async () => {
      const { data: hol } = await c.from("holidays").select("id, date, name").gte("date", from).lte("date", to);
      for (const h of hol ?? []) items.push({ id: h.id, type: "holiday", title: h.name, start: h.date, allDay: true, href: null });
    })());
  }
  if (want("attendance") && !team && !f.client) {
    jobs.push((async () => {
      const { data } = await c.from("attendance_records").select("id, work_date, status, worked_minutes").eq("user_id", bos.userId).gte("work_date", from).lte("work_date", to);
      for (const r of data ?? []) items.push({ id: r.id, type: "attendance", title: `${Math.floor(r.worked_minutes / 60)}h ${String(r.worked_minutes % 60).padStart(2, "0")}m`, start: r.work_date, allDay: true, href: "/admin/team/attendance/me", status: r.status });
    })());
  }
  await Promise.all(jobs);
  return items.sort((a, b) => a.start.localeCompare(b.start));
}
