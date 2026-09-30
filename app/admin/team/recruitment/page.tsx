import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { listJobs, recruitmentStats } from "@/services/bos/hr/recruitment";
import { listDepartments } from "@/services/bos/shared";
import { PageHeader, Card, EmptyState, KpiCard, StatusBadge } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDate } from "@/lib/bos/format";
import { statusOptions } from "@/lib/bos/labels";

// Team → Recruitment: job openings (website listings live here too) and the
// hiring funnel (docs/bos/28 §20, §36).
export default async function RecruitmentPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("recruitment.read");
  const sp = await readParams(searchParams);
  const [jobs, stats, departments] = await Promise.all([listJobs({ status: sp.status, published: sp.published, department: sp.department, q: sp.q }), recruitmentStats(), listDepartments()]);
  const canCreate = bos.permissions.get("recruitment.create") === "all" || bos.isSuperAdmin;
  return (
    <>
      <PageHeader title="التوظيف" subtitle={sp.published === "1" ? "الوظائف المنشورة على الموقع" : "الوظائف والمرشحون والمقابلات والعروض والتعيين"}
        actions={canCreate ? <Link className="admin-btn small" href="/admin/team/recruitment/jobs/new"><Tx>+ وظيفة جديدة</Tx></Link> : null} />
      <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
        <KpiCard label="وظائف مفتوحة" value={stats.openJobs} sub={<Tx vars={{ openings: stats.openings, published: stats.published }}>{"{openings} شاغر · {published} منشورة"}</Tx>} href="/admin/team/recruitment?status=open" />
        <KpiCard label="طلبات جديدة" value={stats.newApplications} href="/admin/team/recruitment/applications?stage=new" />
        <KpiCard label="في مرحلة المقابلات" value={(stats.byStage.interview ?? 0) + (stats.byStage.evaluation ?? 0)} href="/admin/team/recruitment/pipeline" />
        <KpiCard label="مقابلات قادمة" value={stats.upcomingInterviews} href="/admin/team/recruitment/interviews" />
        <KpiCard label="عروض قائمة" value={stats.offersOut} href="/admin/team/recruitment/offers?status=sent" />
        <KpiCard label="تم التعيين" value={stats.hires} />
      </div>
      <FilterBar searchPlaceholder="بحث بالمسمى..." filters={[
        { key: "status", label: "الحالة", type: "select", options: statusOptions("job_status") },
        { key: "published", label: "النشر", type: "select", options: [{ value: "1", label: "منشورة" }, { value: "0", label: "غير منشورة" }] },
        { key: "department", label: "القسم", type: "select", options: departments.map((d) => ({ value: d.id, label: d.name })) },
      ]} />
      <Card flush>
        {jobs.length ? (
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>الوظيفة</Tx></th><th><Tx>القسم</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>الموقع</Tx></th><th><Tx>الشواغر</Tx></th><th><Tx>الطلبات (النشطة)</Tx></th><th><Tx>تم التعيين</Tx></th><th><Tx>آخر موعد</Tx></th></tr></thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td className="cell-primary"><Link href={`/admin/team/recruitment/jobs/${j.id}`}><Tx>{j.title}</Tx></Link><span className="cell-sub" dir="ltr">/careers/{j.slug}</span></td>
                  <td>{(j.departments as { name: string } | null)?.name ?? j.team ?? "—"}</td>
                  <td><StatusBadge map="job_status" value={j.status} /></td>
                  <td>{j.is_published ? <StatusBadge tone="success" label="منشورة" /> : <span className="bos-faint"><Tx>غير منشورة</Tx></span>}</td>
                  <td><Tx>{j.openings}</Tx></td>
                  <td><Link className="bos-link" href={`/admin/team/recruitment/applications?job=${j.id}`}>{j.applications} ({j.active})</Link></td>
                  <td><Tx>{j.hired}</Tx></td>
                  <td>{formatDate(j.closes_at)}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد وظائف" />}
      </Card>
      {can(bos, "reports.read") ? <p className="bos-faint" style={{ fontSize: 12 }}><Link className="bos-link" href="/admin/reports/hr?r=candidates_by_stage"><Tx>تقارير التوظيف</Tx></Link></p> : null}
    </>
  );
}
