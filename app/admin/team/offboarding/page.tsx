import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { getOffboardingDashboard, sectionLabels } from "@/services/bos/onboarding";
import { peopleEmployeeIds } from "@/services/bos/team-scope";
import { PageHeader, Card, EmptyState, KpiCard, ProgressBar, StatusBadge, UserAvatar } from "@/components/bos/ui";
import { formatDate } from "@/lib/bos/format";
import { statusLabel } from "@/lib/bos/labels";

// Offboarding (docs/bos/28 §24): Resignation / Termination → checklist →
// Terminated once every item incl. the final approval is complete.
export default async function OffboardingPage() {
  const { bos } = await requirePermission("onboarding.read");
  const employeeIds = await peopleEmployeeIds(bos, "onboarding.read");
  const rows = await getOffboardingDashboard(employeeIds);
  const open = rows.filter((r) => r.status === "in_progress");
  return (
    <>
      <PageHeader title="إنهاء الخدمة" subtitle="الاستقالات وإنهاء الخدمة والتسويات" />
      <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 14 }}>
        <KpiCard label="قيد التنفيذ" value={open.length} />
        <KpiCard label="متأخرة" value={open.filter((r) => r.overdue).length} />
        <KpiCard label="مكتملة" value={rows.filter((r) => r.status === "completed").length} />
      </div>
      <Card flush>
        {rows.length ? (
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>الموظف</Tx></th><th><Tx>النوع</Tx></th><th><Tx>آخر يوم</Tx></th><th><Tx>التقدم</Tx></th><th><Tx>الأقسام</Tx></th><th><Tx>الحالة</Tx></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.checklistId}>
                  <td className="cell-primary"><Link href={`/admin/team/employees/${r.employee.id}?tab=onboarding`} className="bos-row" style={{ gap: 8 }}><UserAvatar name={r.employee.full_name} employeeId={r.employee.id} /><span>{r.employee.full_name}<span className="cell-sub">{[r.employee.position, r.employee.departments?.name].filter(Boolean).join(" · ")}</span></span></Link></td>
                  <td>{r.separation ? statusLabel("separation_type", r.separation.separation_type) : "—"}</td>
                  <td>{formatDate(r.separation?.last_working_day ?? null)}</td>
                  <td style={{ minWidth: 120 }}><ProgressBar value={r.percent} tone={r.percent === 100 ? "success" : undefined} /><span className="cell-sub">{r.percent}% · {r.openTasks} مفتوح{r.overdue ? " · متأخرة" : ""}</span></td>
                  <td style={{ fontSize: 12 }}>{r.sections.map((s) => <span key={s.section} style={{ marginInlineEnd: 8 }}>{s.complete ? "✓" : "○"} {sectionLabels[s.section] ?? s.section}</span>)}</td>
                  <td><StatusBadge map="onboarding_status" value={r.status} /> <StatusBadge map="employee_lifecycle_status" value={r.employee.lifecycle_status} /></td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد إجراءات إنهاء خدمة" description="يبدأ إنهاء الخدمة من صفحة الموظف (استقالة / إنهاء خدمة)." />}
      </Card>
    </>
  );
}
