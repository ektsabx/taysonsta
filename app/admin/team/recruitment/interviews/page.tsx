import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { listInterviews } from "@/services/bos/hr/recruitment";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, EmptyState, StatusBadge } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { SubNav } from "@/components/bos/SubNav";
import { hrSection } from "@/lib/bos/hr-nav";
import { formatDateTime } from "@/lib/bos/format";
import { statusOptions } from "@/lib/bos/labels";

// Interviews across applications; scheduling happens from the application
// (and appears in the interviewer's calendar).
export default async function InterviewsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("recruitment.read");
  const sp = await readParams(searchParams);
  const [rows, names] = await Promise.all([listInterviews({ from: sp.from, to: sp.to, status: sp.status, interviewer: sp.mine === "1" ? bos.userId : undefined }), userNameMap()]);
  return (
    <>
      <PageHeader title="المقابلات" breadcrumbs={[{ label: "التوظيف", href: "/admin/team/recruitment" }, { label: "المقابلات" }]} actions={<Link className="admin-btn small ghost" href="/admin/calendar"><Tx>التقويم</Tx></Link>} />
      <SubNav items={hrSection(bos, "recruitment")} active="interviews" label="التوظيف" />
      <FilterBar filters={[{ key: "status", label: "الحالة", type: "select", options: statusOptions("interview_status") }, { key: "mine", label: "المُقابِل", type: "select", options: [{ value: "1", label: "مقابلاتي" }] }, { key: "from", label: "من", type: "date" }, { key: "to", label: "إلى", type: "date" }]} />
      <Card flush>
        {rows.length ? (
          <table className="bos-table responsive">
            <thead><tr><th><Tx>الموعد</Tx></th><th><Tx>المرشح</Tx></th><th><Tx>الوظيفة</Tx></th><th><Tx>الجولة</Tx></th><th><Tx>المُقابِل</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>النتيجة</Tx></th><th><Tx>التقييمات</Tx></th></tr></thead>
            <tbody>
              {rows.map((i) => {
                const a = i.career_applications as unknown as { id: string; first_name: string; last_name: string; career_jobs: { title: string } | null } | null;
                const fb = (i.interview_feedback as { rating: number }[]) ?? [];
                return (
                  <tr key={i.id}>
                    <td>{formatDateTime(i.scheduled_at)}</td>
                    <td className="cell-primary">{a ? <Link href={`/admin/team/recruitment/applications/${a.id}`}>{a.first_name} {a.last_name}</Link> : "—"}</td>
                    <td><Tx>{a?.career_jobs?.title}</Tx></td>
                    <td><Tx>{i.round}</Tx></td>
                    <td>{i.interviewer_user_id ? names.get(i.interviewer_user_id) : i.interviewer_name ?? "—"}</td>
                    <td><StatusBadge map="interview_status" value={i.status} /></td>
                    <td><StatusBadge map="interview_outcome" value={i.outcome} /></td>
                    <td>{fb.length ? `${fb.length} · متوسط ${(fb.reduce((s, x) => s + x.rating, 0) / fb.length).toFixed(1)}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <EmptyState title="لا توجد مقابلات" />}
      </Card>
    </>
  );
}
