import Link from "next/link";
import { requirePortalSection } from "@/lib/bos/portal-auth";
import { portalTickets } from "@/services/bos/portal";
import { formatDate } from "@/lib/bos/format";
import { PBadge, PEmpty, PTop } from "../ui";

export default async function PortalSupportPage() {
  const p = await requirePortalSection("support");
  const tickets = await portalTickets(p);
  return (
    <>
      <PTop title="الدعم" actions={<Link className="portal-btn" href="/portal/support/new">+ تذكرة</Link>} />
      <div className="portal-card">
        <h2>تذاكري</h2>
        {tickets.length ? (
          <table className="portal-table">
            <thead><tr><th>التذكرة</th><th>الأولوية</th><th>الحالة</th><th>آخر تحديث</th></tr></thead>
            <tbody>{tickets.map((t) => <tr key={t.id}><td><Link href={`/portal/support/${t.id}`}>{t.subject}</Link><div className="portal-muted">{t.ticket_number}</div></td><td><PBadge map="priority" value={t.priority} /></td><td><PBadge map="ticket_status" value={t.status} /></td><td>{formatDate(t.updated_at)}</td></tr>)}</tbody>
          </table>
        ) : <PEmpty title="لا توجد تذاكر" />}
      </div>
    </>
  );
}
