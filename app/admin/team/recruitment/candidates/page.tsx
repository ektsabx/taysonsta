import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { listCandidates, listJobs } from "@/services/bos/hr/recruitment";
import { PageHeader, Card, EmptyState, StatusBadge } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { SubNav } from "@/components/bos/SubNav";
import { hrSection } from "@/lib/bos/hr-nav";
import { formatDate } from "@/lib/bos/format";
import { statusLabel, statusOptions } from "@/lib/bos/labels";
import { ManualApplicationButton } from "../RecruitmentControls";

// Candidates = people; each may apply to several jobs (docs/bos/28 §20).
export default async function CandidatesPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("recruitment.read");
  const sp = await readParams(searchParams);
  const [rows, jobs] = await Promise.all([listCandidates({ q: sp.q, status: sp.status, job: sp.job, stage: sp.stage }), listJobs()]);
  const canCreate = bos.permissions.get("recruitment.create") === "all" || bos.isSuperAdmin;
  return (
    <>
      <PageHeader title="المرشحون" subtitle={<Tx vars={{ rows_count: rows.length }}>{"{rows_count} مرشح"}</Tx>} breadcrumbs={[{ label: "التوظيف", href: "/admin/team/recruitment" }, { label: "المرشحون" }]} actions={canCreate ? <ManualApplicationButton jobs={jobs.map((j) => ({ value: j.id, label: j.title }))} /> : null} />
      <SubNav items={hrSection(bos, "recruitment")} active="candidates" label="التوظيف" />
      <FilterBar searchPlaceholder="بحث بالاسم أو البريد أو الهاتف..." filters={[
        { key: "job", label: "الوظيفة", type: "select", options: jobs.map((j) => ({ value: j.id, label: j.title })) },
        { key: "stage", label: "المرحلة", type: "select", options: statusOptions("application_status") },
        { key: "status", label: "الحالة", type: "select", options: statusOptions("candidate_status") },
      ]} />
      <Card flush>
        {rows.length ? (
          <table className="bos-table responsive">
            <thead><tr><th><Tx>المرشح</Tx></th><th><Tx>الطلبات</Tx></th><th><Tx>المصدر</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>آخر تحديث</Tx></th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="cell-primary"><Link href={`/admin/team/recruitment/candidates/${c.id}`}>{c.first_name} {c.last_name}</Link><span className="cell-sub" dir="ltr">{c.email}{c.phone ? ` · ${c.phone}` : ""}</span></td>
                  <td>{((c.career_applications as { id: string; status: string; career_jobs: unknown }[]) ?? []).map((a) => <div key={a.id} style={{ fontSize: 12.5 }}>{(a.career_jobs as { title: string } | null)?.title}: {statusLabel("application_status", a.status)}</div>)}</td>
                  <td><Tx>{c.source}</Tx></td>
                  <td><StatusBadge map="candidate_status" value={c.status} /></td>
                  <td>{formatDate(c.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState title="لا يوجد مرشحون" description="يُنشأ المرشح تلقائياً عند التقديم من صفحة الوظائف على الموقع أو يدوياً." />}
      </Card>
    </>
  );
}
