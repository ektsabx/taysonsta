import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { getOnboardingDashboard, sectionLabels } from "@/services/bos/onboarding";
import { peopleEmployeeIds } from "@/services/bos/team-scope";
import { PageHeader, Card, EmptyState, KpiCard, ProgressBar, StatusBadge } from "@/components/bos/ui";
import { formatDate } from "@/lib/bos/format";

const filters: Record<string, string> = { new: "موظفون جدد", in_progress: "قيد التهيئة", completed: "مكتملة", overdue: "متأخرة", missing_documents: "مستندات/قراءة ناقصة", missing_training: "تدريب ناقص", pending_manager: "إجراءات المدير" };

// Onboarding Dashboard (IT §16).
export default async function OnboardingDashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("onboarding.read");
  const sp = await readParams(searchParams);
  const employeeIds = await peopleEmployeeIds(bos, "onboarding.read");
  const { rows, cards } = await getOnboardingDashboard(employeeIds);
  const f = sp.filter;
  const visible = rows.filter((r) =>
    !f ? true
    : f === "new" ? r.isNew
    : f === "in_progress" ? r.status === "in_progress"
    : f === "completed" ? r.status === "completed"
    : f === "overdue" ? r.overdue
    : f === "missing_documents" ? r.status === "in_progress" && r.missingDocuments > 0
    : f === "missing_training" ? r.status === "in_progress" && r.missingTraining > 0
    : f === "pending_manager" ? r.status === "in_progress" && r.pendingManager > 0
    : true,
  );
  const card = (key: string, value: number) => <KpiCard label={filters[key]} value={value} href={`/admin/team/onboarding?filter=${key}`} />;
  return (
    <>
      <PageHeader title="لوحة التهيئة" subtitle={f ? filters[f] : "كل الموظفين"} actions={can(bos, "employees.create") ? <Link className="admin-btn small" href="/admin/team/employees/new"><Tx>+ موظف جديد</Tx></Link> : null} />
      <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 14 }}>
        {card("new", cards.newEmployees)}
        {card("in_progress", cards.inProgress)}
        {card("completed", cards.completed)}
        {card("overdue", cards.overdue)}
        {card("missing_documents", cards.missingDocuments)}
        {card("missing_training", cards.missingTraining)}
        {card("pending_manager", cards.pendingManager)}
      </div>
      {f ? <div style={{ marginBottom: 8 }}><Link className="bos-link" href="/admin/team/onboarding"><Tx>إزالة الفلتر</Tx></Link></div> : null}
      <Card flush>
        {visible.length ? (
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>الموظف</Tx></th><th><Tx>التقدم</Tx></th><th><Tx>الأقسام</Tx></th><th><Tx>الاستحقاق</Tx></th><th><Tx>ينقص</Tx></th></tr></thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.checklistId}>
                  <td className="cell-primary"><Link href={`/admin/team/onboarding/${r.employee.id}`}>{r.employee.full_name}</Link><span className="cell-sub">{r.employee.position ?? ""}{r.employee.departments ? ` · ${r.employee.departments.name}` : ""}</span><StatusBadge map="employee_lifecycle_status" value={r.employee.lifecycle_status} /></td>
                  <td style={{ minWidth: 140 }}><ProgressBar value={r.percent} tone={r.percent === 100 ? "success" : undefined} /><span className="cell-sub">{r.percent}%</span></td>
                  <td style={{ fontSize: 12 }}>{r.sections.map((s) => <span key={s.section} style={{ marginInlineEnd: 8, whiteSpace: "nowrap" }}>{s.complete ? "✓" : "○"} {sectionLabels[s.section] ?? s.section}</span>)}</td>
                  <td style={r.overdue ? { color: "var(--bos-danger)" } : undefined}>{formatDate(r.dueDate)}{r.overdue ? " (متأخرة)" : ""}</td>
                  <td style={{ fontSize: 12 }}>
                    {r.missingDocuments ? <div><Tx vars={{ missingDocuments: r.missingDocuments }}>{"قراءة: {missingDocuments}"}</Tx></div> : null}
                    {r.missingTraining ? <div><Tx vars={{ missingTraining: r.missingTraining }}>{"تدريب: {missingTraining}"}</Tx></div> : null}
                    {r.pendingManager ? <div><Tx vars={{ pendingManager: r.pendingManager }}>{"المدير: {pendingManager}"}</Tx></div> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد قوائم تهيئة" description="تبدأ التهيئة تلقائياً عند إنشاء موظف جديد." />}
      </Card>
    </>
  );
}
