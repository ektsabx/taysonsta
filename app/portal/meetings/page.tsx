import { nowIso } from "@/lib/bos/clock";
import { requirePortalSection } from "@/lib/bos/portal-auth";
import { portalMeetings } from "@/services/bos/portal";
import { formatDateTime } from "@/lib/bos/format";
import { PBadge, PEmpty, PTop } from "../ui";

export default async function PortalMeetingsPage() {
  const p = await requirePortalSection("meetings");
  const rows = await portalMeetings(p);
  const now = nowIso();
  const upcoming = rows.filter((m) => m.start_at >= now && m.status === "scheduled").reverse();
  const past = rows.filter((m) => !(m.start_at >= now && m.status === "scheduled"));
  const list = (items: typeof rows) => items.length ? (
    <table className="portal-table">
      <thead><tr><th>الاجتماع</th><th>الموعد</th><th>المدة</th><th>الحالة</th><th /></tr></thead>
      <tbody>{items.map((m) => <tr key={m.id}><td>{m.title}{m.location ? <div className="portal-muted">{m.location}</div> : null}</td><td>{formatDateTime(m.start_at)}</td><td>{m.duration_minutes} د</td><td><PBadge map="meeting_status" value={m.status} /></td><td>{m.meeting_link && m.status === "scheduled" ? <a href={m.meeting_link} target="_blank" rel="noreferrer">الانضمام</a> : null}</td></tr>)}</tbody>
    </table>
  ) : <PEmpty title="لا يوجد" />;
  return (
    <>
      <PTop title="الاجتماعات" />
      <div className="portal-card"><h2>القادمة</h2>{list(upcoming)}</div>
      <div className="portal-card"><h2>السابقة</h2>{list(past)}</div>
    </>
  );
}
