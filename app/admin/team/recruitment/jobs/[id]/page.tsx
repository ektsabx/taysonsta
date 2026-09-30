import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/bos/auth";
import { NotFoundError } from "@/lib/bos/errors";
import { getJob, listApplications } from "@/services/bos/hr/recruitment";
import { PageHeader, Card, EmptyState, StatusBadge } from "@/components/bos/ui";
import { formatDate } from "@/lib/bos/format";
import { JobControls, JobForm, ManualApplicationButton } from "../../RecruitmentControls";
import { recruitmentLookups } from "../../lookups";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("recruitment.read");
  const { id } = await params;
  let job;
  try {
    job = await getJob(id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const [apps, l] = await Promise.all([listApplications({ job: id }), recruitmentLookups()]);
  const canEdit = bos.permissions.get("recruitment.update") === "all" || bos.isSuperAdmin;
  return (
    <>
      <PageHeader title={job.title} subtitle={<span className="bos-row" style={{ gap: 8 }}><StatusBadge map="job_status" value={job.status} />{job.is_published ? <StatusBadge tone="success" label="منشورة على الموقع" /> : null}</span>}
       
        actions={canEdit ? <span className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}><JobControls id={job.id} status={job.status} published={job.is_published} canDelete={(bos.permissions.get("recruitment.delete") === "all" || bos.isSuperAdmin) && apps.length === 0} /><ManualApplicationButton jobs={[]} fixedJobId={job.id} /></span> : null} />
      <Card title={<Tx vars={{ apps_count: apps.length }}>{"الطلبات ({apps_count})"}</Tx>} actions={<Link className="bos-link" href={`/admin/team/recruitment/pipeline?job=${job.id}`}><Tx>مسار التوظيف</Tx></Link>}>
        {apps.length ? (
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>المرشح</Tx></th><th><Tx>المصدر</Tx></th><th><Tx>المرحلة</Tx></th><th><Tx>التقييم</Tx></th><th><Tx>التاريخ</Tx></th></tr></thead>
            <tbody>{apps.map((a) => <tr key={a.id}><td className="cell-primary"><Link href={`/admin/team/recruitment/applications/${a.id}`}>{a.first_name} {a.last_name}</Link><span className="cell-sub" dir="ltr">{a.email}</span></td><td><Tx>{a.source}</Tx></td><td><StatusBadge map="application_status" value={a.status} /></td><td>{a.rating ? "★".repeat(Math.round(Number(a.rating))) : "—"}</td><td>{formatDate(a.created_at)}</td></tr>)}</tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد طلبات بعد" />}
      </Card>
      {canEdit ? <JobForm initial={{ ...job, openings: job.openings }} departments={l.departments} teams={l.teams} managers={l.users} currencies={l.currencies} /> : null}
    </>
  );
}
