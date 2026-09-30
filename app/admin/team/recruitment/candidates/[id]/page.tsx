import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { NotFoundError } from "@/lib/bos/errors";
import { getCandidate } from "@/services/bos/hr/recruitment";
import { PageHeader, Card, EmptyState, KeyValues, Money, StatusBadge } from "@/components/bos/ui";
import { FileManager } from "@/components/bos/FileManager";
import { ActivityTimeline } from "@/components/bos/ActivityTimeline";
import { formatDate, formatDateTime } from "@/lib/bos/format";
import { CandidateEditButton } from "../../RecruitmentControls";

export default async function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("recruitment.read");
  const { id } = await params;
  if (!(await canAccessEntity(bos, "candidate", id))) notFound();
  let data;
  try {
    data = await getCandidate(id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const { candidate: c, applications, offers } = data;
  const canEdit = bos.permissions.get("recruitment.update") === "all" || bos.isSuperAdmin;
  return (
    <>
      <PageHeader title={`${c.first_name} ${c.last_name}`} subtitle={<StatusBadge map="candidate_status" value={c.status} />} breadcrumbs={[{ label: "التوظيف", href: "/admin/team/recruitment" }, { label: "المرشحون", href: "/admin/team/recruitment/candidates" }, { label: `${c.first_name} ${c.last_name}` }]}
        actions={<span className="bos-row" style={{ gap: 6 }}>{c.employee_id ? <Link className="admin-btn small success" href={`/admin/team/employees/${c.employee_id}`}><Tx>ملف الموظف</Tx></Link> : null}{canEdit ? <CandidateEditButton id={c.id} initial={c} /> : null}</span>} />
      <div className="bos-grid main-side">
        <div>
          <Card title="الطلبات">
            {applications.length ? applications.map((a) => (
              <div key={a.id} style={{ borderBottom: "1px solid var(--bos-border)", padding: "8px 0" }}>
                <div className="bos-row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <Link href={`/admin/team/recruitment/applications/${a.id}`}><strong>{(a.career_jobs as { title: string } | null)?.title}</strong></Link>
                  <span className="bos-row" style={{ gap: 6 }}><StatusBadge map="application_status" value={a.status} /><span className="bos-faint" style={{ fontSize: 12 }}>{formatDate(a.created_at)}</span></span>
                </div>
                {((a.career_interviews as { id: string; scheduled_at: string; round: number; status: string; outcome: string }[]) ?? []).map((i) => <div key={i.id} className="bos-faint" style={{ fontSize: 12 }}><Tx vars={{ round: i.round, v: formatDateTime(i.scheduled_at) }}>{"مقابلة جولة {round} — {v} ·"}</Tx> <StatusBadge map="interview_status" value={i.status} /> <StatusBadge map="interview_outcome" value={i.outcome} /></div>)}
              </div>
            )) : <EmptyState title="لا توجد طلبات" />}
          </Card>
          <Card title="عروض العمل">
            {offers.length ? offers.map((o) => <div key={o.id} style={{ fontSize: 13, marginBottom: 6 }}>{o.offer_number} — {o.position_title} · <Money value={o.basic_salary} currency={o.currency} /> <Tx vars={{ v: formatDate(o.start_date) }}>{"· يبدأ {v}"}</Tx> <StatusBadge map="offer_status" value={o.status} /></div>) : <EmptyState title="لا توجد عروض" />}
          </Card>
          <Card title="مستندات المرشح"><FileManager entityType="candidate" entityId={c.id} canUpload={canEdit} /></Card>
        </div>
        <div>
          <Card title="البيانات">
            <KeyValues items={[
              { label: "البريد", value: <span dir="ltr">{c.email}</span> },
              { label: "الهاتف", value: c.phone ? <span dir="ltr">{c.phone}</span> : null },
              { label: "الدولة", value: c.country },
              { label: "المسمى الحالي", value: c.current_title },
              { label: "الخبرة", value: c.years_experience != null ? `${c.years_experience} سنة` : null },
              { label: "الراتب المتوقع", value: c.expected_salary },
              { label: "المصدر", value: c.source },
              { label: "وسوم", value: c.tags.join("، ") || null },
              { label: "ملاحظات", value: c.notes },
            ]} />
          </Card>
          <Card title="السجل الزمني"><ActivityTimeline entityType="candidate" entityId={c.id} limit={40} /></Card>
        </div>
      </div>
    </>
  );
}
