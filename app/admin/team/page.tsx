import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { getSystemTime } from "@/lib/bos/system-time";
import { peopleEmployeeIds, peopleScope } from "@/services/bos/team-scope";
import { getHrOverview } from "@/services/bos/hr/dashboard";
import { branchFilter } from "@/lib/bos/branch";
import { daysUntil } from "@/services/bos/hr/documents";
import { PageHeader, Card, KpiCard, EmptyState, StatusBadge, UserAvatar } from "@/components/bos/ui";
import { formatDate, formatMinutes, formatTime } from "@/lib/bos/format";

// HR Overview (docs/bos/28 §27) — live data in the viewer's people scope.
export default async function HrOverviewPage() {
  const { bos } = await requirePermission("attendance.read");
  const scope = await peopleScope(bos, "attendance.read");
  if (scope.users !== null && !scope.manages && scope.scope === "own") redirect("/admin/team/me");
  const time = await getSystemTime();
  const employeeIds = await peopleEmployeeIds(bos, "attendance.read");
  const o = await getHrOverview(bos, {
    userIds: scope.users,
    employeeIds,
    canPayroll: bos.permissions.get("payroll.read") === "all",
    canDocuments: bos.permissions.get("hr_documents.read") === "all",
    canRecruitment: can(bos, "recruitment.read"),
    branchIds: await branchFilter(bos),
  }, time.today);
  const r = o.requests;
  const totalRequests = r.leave + r.overtime + r.corrections + r.expenses + r.loans + r.bonuses + r.other;

  return (
    <>
      <PageHeader title="الموارد البشرية — نظرة عامة" subtitle={`${time.dateLabel} · ${time.timeLabel}`} />

      <h3 className="bos-section-title"><Tx>اليوم</Tx></h3>
      <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 16 }}>
        <KpiCard label="الموظفون" value={o.today.employees} href="/admin/team/employees" />
        <KpiCard label="حاضر" value={o.today.present} href="/admin/team/attendance" />
        <KpiCard label="متأخر" value={o.today.late} href="/admin/team/attendance?status=late" />
        <KpiCard label="غائب" value={o.today.absent} href="/admin/team/attendance?status=absent" />
        <KpiCard label="في إجازة" value={o.today.onLeave} href="/admin/team/leave" />
        <KpiCard label="يوم راحة / عطلة" value={o.today.dayOff} href="/admin/team/schedules" />
        <KpiCard label="لم يسجل الحضور" value={o.today.notSignedIn} href="/admin/team/attendance?status=not_clocked_in" />
      </div>

      <div className="bos-grid cols-2" style={{ gap: 12 }}>
        <Card title="ساعات العمل">
          <BosTable className="bos-table">
            <thead><tr><th /><th><Tx>المتوقع</Tx></th><th><Tx>الفعلي</Tx></th><th><Tx>إضافي</Tx></th></tr></thead>
            <tbody>
              <tr><td><Tx>اليوم</Tx></td><td>{formatMinutes(o.hours.today.expected)}</td><td>{formatMinutes(o.hours.today.worked)}</td><td>{formatMinutes(o.hours.today.overtime)}</td></tr>
              <tr><td><Tx>هذا الشهر</Tx></td><td>{formatMinutes(o.hours.month.expected)}</td><td>{formatMinutes(o.hours.month.worked)}</td><td>{formatMinutes(o.hours.month.overtime)}</td></tr>
            </tbody>
          </BosTable>
        </Card>
        <Card title={<Tx vars={{ totalRequests }}>{"الطلبات المعلقة ({totalRequests})"}</Tx>} actions={<Link className="bos-link" href="/admin/approvals"><Tx vars={{ myApprovals: r.myApprovals }}>{"موافقاتي ({myApprovals})"}</Tx></Link>}>
          <ul className="bos-alert-list">
            <li><Link href="/admin/team/leave?view=team&status=pending"><Tx>الإجازات</Tx></Link><strong><Tx>{r.leave}</Tx></strong></li>
            <li><Link href="/admin/team/overtime?status=pending"><Tx>العمل الإضافي</Tx></Link><strong><Tx>{r.overtime}</Tx></strong></li>
            <li><Link href="/admin/team/attendance/corrections"><Tx>تصحيحات الحضور</Tx></Link><strong><Tx>{r.corrections}</Tx></strong></li>
            <li><Link href="/admin/team/requests/expenses?status=pending"><Tx>المصروفات</Tx></Link><strong><Tx>{r.expenses}</Tx></strong></li>
            <li><Link href="/admin/team/payroll/loans?status=pending"><Tx>السلف والقروض</Tx></Link><strong><Tx>{r.loans}</Tx></strong></li>
            <li><Link href="/admin/team/payroll/bonuses?status=pending"><Tx>المكافآت</Tx></Link><strong><Tx>{r.bonuses}</Tx></strong></li>
            <li><Link href="/admin/team/requests/other?status=pending"><Tx>طلبات أخرى</Tx></Link><strong><Tx>{r.other}</Tx></strong></li>
          </ul>
        </Card>
      </div>

      <h3 className="bos-section-title"><Tx>التنبيهات</Tx></h3>
      <div className="bos-grid cols-2" style={{ gap: 12 }}>
        <Card title={<Tx vars={{ lateList_count: o.lateList.length }}>{"المتأخرون اليوم ({lateList_count})"}</Tx>}>
          {o.lateList.length ? (
            <ul className="bos-alert-list">
              {o.lateList.map((l) => (
                <li key={l.employee.id}>
                  <Link href={`/admin/team/employees/${l.employee.id}?tab=attendance`} className="bos-row" style={{ gap: 8 }}><UserAvatar name={l.employee.full_name} employeeId={l.employee.id} />{l.employee.full_name}</Link>
                  <span className="bos-faint">{l.firstIn ? formatTime(l.firstIn, l.employee.timezone) : ""} · {formatMinutes(l.lateMinutes)}</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="لا يوجد متأخرون" />}
        </Card>
        {bos.permissions.get("hr_documents.read") === "all" ? (
          <Card title={<Tx vars={{ contracts_count: o.alerts.contracts.length }}>{"عقود تنتهي خلال 30 يوماً ({contracts_count})"}</Tx>} actions={<Link className="bos-link" href="/admin/team/documents/contracts?expiring=1"><Tx>كل العقود</Tx></Link>}>
            {o.alerts.contracts.length ? (
              <ul className="bos-alert-list">
                {o.alerts.contracts.map((k) => (
                  <li key={k.id}><Link href={`/admin/team/documents/contracts/${k.id}`}>{(k.employees as unknown as { full_name: string } | null)?.full_name} — {k.contract_number}</Link><span className={daysUntil(k.end_date as string, time.today) < 0 ? "bos-danger" : "bos-faint"}>{formatDate(k.end_date)} ({daysUntil(k.end_date as string, time.today)} يوم)</span></li>
                ))}
              </ul>
            ) : <EmptyState title="لا توجد عقود قريبة الانتهاء" />}
          </Card>
        ) : null}
        {bos.permissions.get("hr_documents.read") === "all" ? (
          <Card title={<Tx vars={{ documents_count: o.alerts.documents.length }}>{"مستندات تنتهي أو منتهية ({documents_count})"}</Tx>} actions={<Link className="bos-link" href="/admin/team/documents?expiry=expiring"><Tx>المستندات</Tx></Link>}>
            {o.alerts.documents.length ? (
              <ul className="bos-alert-list">
                {o.alerts.documents.map((d) => {
                  const days = daysUntil(d.expiry_date as string, time.today);
                  return (
                    <li key={d.id}>
                      <Link href={`/admin/team/employees/${d.employee_id}?tab=documents`}>{(d.employees as unknown as { full_name: string } | null)?.full_name} — {(d.document_types as unknown as { name: string } | null)?.name ?? d.title}</Link>
                      <span className={days < 0 ? "bos-danger" : "bos-faint"}>{days < 0 ? <Tx vars={{ days: -days }}>{"منتهي منذ {days} يوم"}</Tx> : <Tx vars={{ days }}>{"ينتهي خلال {days} يوم"}</Tx>}</span>
                    </li>
                  );
                })}
              </ul>
            ) : <EmptyState title="لا توجد مستندات قريبة الانتهاء" />}
          </Card>
        ) : null}
        <Card title={<Tx vars={{ onboarding_count: o.alerts.onboarding.length }}>{"التهيئة الجارية ({onboarding_count})"}</Tx>} actions={<Link className="bos-link" href="/admin/team/onboarding"><Tx>التهيئة</Tx></Link>}>
          {o.alerts.onboarding.length ? (
            <ul className="bos-alert-list">
              {o.alerts.onboarding.map((c) => <li key={c.id}><Link href={`/admin/team/onboarding/${c.employee_id}`}>{(c.employees as unknown as { full_name: string } | null)?.full_name}</Link><span className={c.overdue ? "bos-danger" : "bos-faint"}>{c.open} مهمة مفتوحة{c.overdue ? " · متأخرة" : ""}</span></li>)}
            </ul>
          ) : <EmptyState title="لا توجد تهيئة جارية" />}
        </Card>
        <Card title={<Tx vars={{ offboarding_count: o.alerts.offboarding.length }}>{"إنهاء الخدمة الجاري ({offboarding_count})"}</Tx>} actions={<Link className="bos-link" href="/admin/team/offboarding"><Tx>إنهاء الخدمة</Tx></Link>}>
          {o.alerts.offboarding.length ? (
            <ul className="bos-alert-list">
              {o.alerts.offboarding.map((c) => <li key={c.id}><Link href={`/admin/team/employees/${c.employee_id}?tab=onboarding`}>{(c.employees as unknown as { full_name: string } | null)?.full_name}</Link><span className={c.overdue ? "bos-danger" : "bos-faint"}><Tx vars={{ open: c.open }}>{"{open} مهمة مفتوحة"}</Tx></span></li>)}
            </ul>
          ) : <EmptyState title="لا يوجد" />}
          {o.alerts.overdueChecklistTasks ? <p className="bos-faint" style={{ fontSize: 12, marginTop: 6 }}><Tx vars={{ overdueChecklistTasks: o.alerts.overdueChecklistTasks }}>{"{overdueChecklistTasks} مهمة تهيئة/إنهاء خدمة متأخرة عن موعدها."}</Tx></p> : null}
        </Card>
        {o.alerts.probation.length ? (
          <Card title="فترات اختبار تنتهي قريباً">
            <ul className="bos-alert-list">
              {o.alerts.probation.map((e) => <li key={e.id}><Link href={`/admin/team/employees/${e.id}`}>{e.full_name}</Link><span className="bos-faint">{formatDate(e.probation_end_date)}</span></li>)}
            </ul>
          </Card>
        ) : null}
        {bos.permissions.get("payroll.read") === "all" ? (
          <Card title="الرواتب" actions={<Link className="bos-link" href="/admin/team/payroll"><Tx>دورات الرواتب</Tx></Link>}>
            {o.alerts.payrollRuns.length ? (
              <ul className="bos-alert-list">{o.alerts.payrollRuns.map((p) => <li key={p.id}><Link href={`/admin/team/payroll/runs/${p.id}`}>{p.run_number} — {p.period_start.slice(0, 7)}</Link><StatusBadge map="payroll_run_status" value={p.status} /></li>)}</ul>
            ) : <EmptyState title="لا توجد دورات مفتوحة" />}
          </Card>
        ) : null}
        {can(bos, "recruitment.read") ? (
          <Card title="التوظيف">
            <p style={{ fontSize: 13 }}><Link className="bos-link" href="/admin/team/recruitment/applications?stage=new"><Tx vars={{ newApplications: o.alerts.newApplications }}>{"{newApplications} طلب توظيف جديد"}</Tx></Link> <Tx>بانتظار المراجعة.</Tx></p>
          </Card>
        ) : null}
      </div>

      <h3 className="bos-section-title"><Tx>تقارير الموارد البشرية</Tx></h3>
      <div className="bos-row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        <Link className="admin-btn small secondary" href="/admin/reports/hr?r=attendance_monthly"><Tx>الحضور الشهري</Tx></Link>
        <Link className="admin-btn small secondary" href="/admin/reports/hr?r=late"><Tx>التأخير</Tx></Link>
        <Link className="admin-btn small secondary" href="/admin/reports/hr?r=headcount"><Tx>عدد الموظفين</Tx></Link>
        <Link className="admin-btn small secondary" href="/admin/reports/hr?r=turnover"><Tx>معدل الدوران</Tx></Link>
        {bos.permissions.get("payroll.read") === "all" ? <Link className="admin-btn small secondary" href="/admin/reports/hr?r=payroll_summary"><Tx>ملخص الرواتب</Tx></Link> : null}
      </div>
    </>
  );
}
