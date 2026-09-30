import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePortalSection } from "@/lib/bos/portal-auth";
import { NotFoundError } from "@/lib/bos/errors";
import { portalProject } from "@/services/bos/portal";
import { formatDate, formatDateTime } from "@/lib/bos/format";
import { PBadge, PEmpty, PMoney, PProgress, PStepper, PTop } from "../../ui";
import { ApprovalButtons, SatisfactionForm } from "../../PortalControls";

export default async function PortalProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const p = await requirePortalSection("projects");
  const { id } = await params;
  let d;
  try {
    d = await portalProject(p, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const { project } = d;
  return (
    <>
      <PTop title={project.name} actions={<><Link className="portal-btn secondary" href={`/portal/messages?project=${id}`}>مراسلة الفريق</Link><Link className="portal-btn secondary" href={`/portal/change-requests/new?project=${id}`}>طلب تغيير</Link><Link className="portal-btn secondary" href={`/portal/support/new?project=${id}`}>تذكرة دعم</Link></>} />
      <div className="portal-card">
        <PStepper status={project.status} />
        <PProgress value={project.progress} />
        <div className="portal-muted" style={{ marginTop: 6 }}>{project.progress}% · البدء {formatDate(project.start_date)} · التسليم {formatDate(project.deadline)}{project.support_until ? ` · الدعم حتى ${formatDate(project.support_until)}` : ""}</div>
      </div>
      <div className="portal-card">
        <h2>المراحل</h2>
        {d.milestones.length ? (
          <table className="portal-table">
            <thead><tr><th>المرحلة</th><th>التسليمات</th><th>الاستحقاق</th><th>الحالة</th><th>موافقتك</th></tr></thead>
            <tbody>
              {d.milestones.map((m) => (
                <tr key={m.id}>
                  <td><strong>{m.name}</strong>{m.description ? <div className="portal-muted">{m.description}</div> : null}<PProgress value={m.progress} /></td>
                  <td style={{ whiteSpace: "pre-wrap" }}>{m.deliverables ?? "—"}</td>
                  <td>{formatDate(m.due_date)}</td>
                  <td><PBadge map="milestone_status" value={m.status} /></td>
                  <td>{m.requires_client_approval ? <PBadge map="simple_approval" value={m.approval_status === "not_required" ? "pending" : m.approval_status} /> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <PEmpty title="لا توجد مراحل" />}
      </div>
      <div className="portal-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <div className="portal-card">
          <h2>الموافقات</h2>
          {d.approvals.length ? d.approvals.map((a) => (
            <div key={a.id} style={{ borderBottom: "1px solid var(--p-border)", padding: "8px 0" }}>
              <strong>{a.title}</strong> <PBadge map="approval_status" value={a.status} />
              <div className="portal-muted">{formatDateTime(a.requested_at)}{a.decision_comment ? ` · ${a.decision_comment}` : ""}</div>
              {a.canDecide ? <ApprovalButtons id={a.id} /> : null}
            </div>
          )) : <PEmpty title="لا توجد موافقات" />}
        </div>
        <div className="portal-card">
          <h2>الملفات</h2>
          {d.files.length ? d.files.map((f) => <div key={f.id} style={{ marginBottom: 6 }}><a href={`/portal/files/${f.id}`} target="_blank" rel="noreferrer">{f.name}</a> <span className="portal-muted">v{f.version} · {formatDate(f.created_at)}</span></div>) : <PEmpty title="لا توجد ملفات مشتركة" />}
        </div>
        <div className="portal-card">
          <h2>طلبات التغيير</h2>
          {d.changeRequests.length ? d.changeRequests.map((c) => <div key={c.id} style={{ marginBottom: 6 }}><strong>{c.title}</strong> <PBadge map="change_request_status" value={c.status} /><div className="portal-muted">{c.cr_number}{Number(c.additional_cost) ? <> · <PMoney value={c.additional_cost} currency={c.currency} /></> : null}{c.additional_days ? ` · +${c.additional_days} يوم` : ""}</div></div>) : <PEmpty title="لا توجد طلبات تغيير" />}
        </div>
        <div className="portal-card">
          <h2>الاجتماعات</h2>
          {d.meetings.length ? d.meetings.map((m) => <div key={m.id} style={{ marginBottom: 6 }}><strong>{m.title}</strong> <PBadge map="meeting_status" value={m.status} /><div className="portal-muted">{formatDateTime(m.start_at)}{m.meeting_link && m.status === "scheduled" ? <> · <a href={m.meeting_link} target="_blank" rel="noreferrer">رابط الاجتماع</a></> : null}</div></div>) : <PEmpty title="لا توجد اجتماعات" />}
        </div>
      </div>
      {project.status === "completed" ? (
        <div className="portal-card">
          <h2>تقييم المشروع</h2>
          {project.satisfaction_score != null ? <p>شكراً! تقييمك: <strong>{project.satisfaction_score}/10</strong></p> : <SatisfactionForm projectId={id} />}
        </div>
      ) : null}
    </>
  );
}
