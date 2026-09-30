import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { listApplications, listJobs } from "@/services/bos/hr/recruitment";
import { PageHeader, Card, EmptyState, StatusBadge } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { SubNav } from "@/components/bos/SubNav";
import { hrSection } from "@/lib/bos/hr-nav";
import { formatDate } from "@/lib/bos/format";
import { statusOptions } from "@/lib/bos/labels";
import { ManualApplicationButton } from "../RecruitmentControls";

// Applications (website + manual) with job / stage / status filters (§41).
export default async function ApplicationsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("recruitment.read");
  const sp = await readParams(searchParams);
  const [rows, jobs] = await Promise.all([listApplications({ job: sp.job, stage: sp.stage, q: sp.q, active: sp.active }), listJobs()]);
  const canCreate = bos.permissions.get("recruitment.create") === "all" || bos.isSuperAdmin;
  return (
    <>
      <PageHeader title="طلبات التوظيف" subtitle={<Tx vars={{ rows_count: rows.length }}>{"{rows_count} طلب"}</Tx>} breadcrumbs={[{ label: "التوظيف", href: "/admin/team/recruitment" }, { label: "الطلبات" }]} actions={canCreate ? <ManualApplicationButton jobs={jobs.map((j) => ({ value: j.id, label: j.title }))} /> : null} />
      <SubNav items={hrSection(bos, "recruitment")} active="applications" label="التوظيف" />
      <FilterBar searchPlaceholder="بحث بالاسم أو البريد أو الهاتف..." filters={[
        { key: "job", label: "الوظيفة", type: "select", options: jobs.map((j) => ({ value: j.id, label: j.title })) },
        { key: "stage", label: "المرحلة", type: "select", options: statusOptions("application_status") },
        { key: "active", label: "الحالة", type: "select", options: [{ value: "1", label: "النشطة فقط" }] },
      ]} />
      <Card flush>
        {rows.length ? (
          <table className="bos-table responsive">
            <thead><tr><th><Tx>المرشح</Tx></th><th><Tx>الوظيفة</Tx></th><th><Tx>الدولة</Tx></th><th><Tx>الخبرة</Tx></th><th><Tx>المصدر</Tx></th><th><Tx>المرحلة</Tx></th><th><Tx>التقييم</Tx></th><th><Tx>التاريخ</Tx></th></tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td className="cell-primary"><Link href={`/admin/team/recruitment/applications/${a.id}`}>{a.first_name} {a.last_name}</Link><span className="cell-sub" dir="ltr">{a.email}</span></td>
                  <td>{(a.career_jobs as { title: string } | null)?.title}</td>
                  <td><Tx>{a.country}</Tx></td>
                  <td><Tx vars={{ years_experience: a.years_experience }}>{"{years_experience} سنة"}</Tx></td>
                  <td><Tx>{a.source}</Tx></td>
                  <td><StatusBadge map="application_status" value={a.status} /></td>
                  <td>{a.rating ? "★".repeat(Math.round(Number(a.rating))) : "—"}</td>
                  <td>{formatDate(a.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState title="لا توجد طلبات" />}
      </Card>
    </>
  );
}
