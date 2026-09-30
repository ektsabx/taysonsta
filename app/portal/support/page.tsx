import Link from "next/link";
import { requirePortalSection } from "@/lib/bos/portal-auth";
import { portalFeatureRequests, portalProjects, portalTickets } from "@/services/bos/portal";
import { formatDate } from "@/lib/bos/format";
import { PBadge, PEmpty, PTop } from "../ui";
import { PortalForm } from "../PortalControls";
import { portalCreateFeatureAction } from "../actions";

export default async function PortalSupportPage() {
  const p = await requirePortalSection("support");
  const [tickets, features, projects] = await Promise.all([portalTickets(p), portalFeatureRequests(p), portalProjects(p)]);
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
      <div className="portal-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <div className="portal-card">
          <h2>طلبات الميزات</h2>
          {features.length ? features.map((f) => <div key={f.id} style={{ marginBottom: 6 }}>{f.title} <PBadge map="feature_request_status" value={f.status} /></div>) : <PEmpty title="لا توجد طلبات" />}
        </div>
        <div className="portal-card">
          <h2>اقترح ميزة جديدة</h2>
          <PortalForm action={portalCreateFeatureAction} submit="إرسال" reset>
            <div className="field"><label htmlFor="ft">الميزة</label><input id="ft" name="title" required maxLength={300} /></div>
            <div className="field"><label htmlFor="fd">الوصف</label><textarea id="fd" name="description" rows={3} required /></div>
            <div className="field"><label htmlFor="fv">القيمة المتوقعة لعملك</label><textarea id="fv" name="business_value" rows={2} /></div>
            <div className="field"><label htmlFor="fp">المشروع</label><select id="fp" name="project_id" defaultValue=""><option value="">—</option>{projects.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}</select></div>
          </PortalForm>
        </div>
      </div>
    </>
  );
}
