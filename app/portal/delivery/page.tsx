import { requirePortalSection } from "@/lib/bos/portal-auth";
import { portalDelivery } from "@/services/bos/portal-extra";
import { formatDate, formatDateTime } from "@/lib/bos/format";
import { PBadge, PEmpty, PProgress, PTop } from "../ui";

const depStatus: Record<string, { l: string; t: string }> = { planned: { l: "مخطط", t: "neutral" }, in_progress: { l: "جارٍ النشر", t: "info" }, deployed: { l: "منشور", t: "success" }, failed: { l: "فشل", t: "danger" }, rolled_back: { l: "تم التراجع", t: "warning" } };
const envLabel: Record<string, string> = { production: "الإنتاج", staging: "بيئة الاختبار (Staging)", testing: "اختبار", other: "أخرى" };

// Deployment status and handover documents per project (docs/bos/30 §23).
export default async function PortalDeliveryPage() {
  const p = await requirePortalSection("projects");
  const projects = await portalDelivery(p);
  return (
    <>
      <PTop title="النشر والتسليم" />
      {projects.length ? projects.map((pr) => (
        <div key={pr.id} className="portal-card">
          <h3 style={{ marginTop: 0 }}>{pr.project_number} · {pr.name}</h3>
          <PProgress value={Number(pr.progress ?? 0)} />
          <p className="portal-muted">الموعد: {formatDate(pr.deadline)}{pr.completed_at ? ` · اكتمل ${formatDate(pr.completed_at)}` : ""}</p>
          <h4>النشر</h4>
          {pr.deployments.length ? (
            <table className="portal-table">
              <thead><tr><th>البيئة</th><th>الإصدار</th><th>الحالة</th><th>التاريخ</th><th>الرابط</th></tr></thead>
              <tbody>{pr.deployments.map((d) => <tr key={d.id}><td>{envLabel[d.environment] ?? d.environment}</td><td dir="ltr">{d.version ?? "—"}</td><td><PBadge label={depStatus[d.status]?.l ?? d.status} tone={depStatus[d.status]?.t} />{d.notes ? <div className="portal-muted">{d.notes}</div> : null}</td><td>{formatDateTime(d.deployed_at ?? d.scheduled_at)}</td><td>{d.url ? <a href={d.url} target="_blank" rel="noreferrer">فتح</a> : "—"}</td></tr>)}</tbody>
            </table>
          ) : <PEmpty title="لا توجد عمليات نشر مسجلة" />}
          <h4>مستندات التسليم</h4>
          {pr.handovers.length ? pr.handovers.map((h) => <div key={h.id}><a href={`/portal/documents/${h.id}`}>{h.number} · {h.title}</a> <PBadge label={h.status === "signed" ? "موقّع" : "مُرسل"} tone={h.status === "signed" ? "success" : "info"} /></div>) : <p className="portal-muted">لا توجد مستندات تسليم بعد.</p>}
        </div>
      )) : <PEmpty title="لا توجد مشاريع" />}
    </>
  );
}
