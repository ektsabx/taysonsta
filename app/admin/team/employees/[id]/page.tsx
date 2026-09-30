import { RecordDocuments } from "@/components/bos/RecordDocuments";
import { RelTime } from "@/components/bos/RelTime";
import { getT } from "@/lib/bos/i18n/server";
import { Tx } from "@/components/bos/I18n";
import { nowMs } from "@/lib/bos/clock";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { NotFoundError } from "@/lib/bos/errors";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { getEmployee, lifecycleTransitions } from "@/services/bos/employees";
import { canSeeUser } from "@/services/bos/team-scope";
import { getAttendanceRange, getTimesheets, summarize } from "@/services/bos/attendance";
import { getBalances, listLeaveRequests, listLeaveTypes } from "@/services/bos/leave";
import { computeUserKpis } from "@/services/bos/kpis";
import { getAccessProfile, listApps } from "@/services/bos/it-access";
import { listEmployeeChecklists } from "@/services/bos/onboarding";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, Summary, Card, KeyValues, StatusBadge, Money, Tabs, EmptyState, UserAvatar, ProgressBar } from "@/components/bos/ui";
import { ActivityTimeline } from "@/components/bos/ActivityTimeline";
import { AuditLogPanel } from "@/components/bos/AuditLogPanel";
import { formatDate, formatDateTime, formatMinutes, todayIn, addDays, startOfMonth } from "@/lib/bos/format";
import { kpiUnitLabels, kpiPeriodLabels } from "@/lib/bos/kpi-metrics";
import { AccessProfileView, AttendanceTable, ChecklistView, LeaveTable } from "../../TeamViews";
import { EmployeeHrTab, hrTabVisibility } from "./HrTabs";
import { PhotoUploader } from "../../HrControls";
import { managedEmployeeIds } from "@/services/bos/team-scope";
import {
  AddGrantButton,
  CompanyAccountButton,
  ConfirmReceiptButton,
  CorrectionButton,
  HrEditButton,
  LeaveRequestButton,
  LifecycleControls,
  LoginControls,
  ManualKpiButton,
  MfaControls,
  RefreshOnboardingButton,
  RegenerateAccessButton,
  RequestAccessButton,
} from "../../TeamControls";

export default async function EmployeePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const t = await getT();
  const { bos } = await requirePermission("employees.read");
  const { id } = await params;
  const sp = await readParams(searchParams);
  let emp;
  try {
    emp = await getEmployee(id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const isSelf = emp.user_id === bos.userId;
  const readScope = bos.permissions.get("employees.read");
  if (readScope !== "all" && !isSelf && !(emp.user_id && (await canSeeUser(bos, "employees.read", emp.user_id)))) notFound();
  const sees = async (key: Parameters<typeof canSeeUser>[1]) => isSelf ? can(bos, key) : !!emp.user_id && can(bos, key) && (bos.permissions.get(key) === "all" || (await canSeeUser(bos, key, emp.user_id)));

  const [seeAttendance, seeLeave, seeKpis, seePerf, seeAccess, seeDevices, seeOnboarding, seeTime, seeCommission, seeTasks] = await Promise.all([
    sees("attendance.read"), sees("leave.read"), sees("kpis.read"), sees("performance.read"), sees("access.read"), sees("devices.read"), sees("onboarding.read"), sees("timesheets.read"), sees("commissions.read"), sees("tasks.read"),
  ]);
  const canSensitive = can(bos, "employees.view_sensitive");
  const canUpdate = can(bos, "employees.update") && (bos.permissions.get("employees.update") === "all" || (!!emp.user_id && (await canSeeUser(bos, "employees.update", emp.user_id))));
  const canLifecycle = bos.permissions.get("employees.update") === "all";
  const canManageAccess = bos.permissions.get("access.manage") === "all";
  const isManager = (await managedEmployeeIds(bos)).includes(emp.id);
  const hrVis = hrTabVisibility({ bos, employee: emp, isSelf, isManager });
  const canPhoto = isSelf || canUpdate;

  // Employee 360 (docs/bos/28 §7): every HR domain reachable from the profile.
  const tabs = [
    { key: "profile", label: "نظرة عامة" },
    { key: "personal", label: "البيانات الشخصية", hidden: !hrVis.personal },
    { key: "employment", label: "التوظيف والسجل", hidden: !hrVis.employment },
    { key: "schedule", label: "الجدول", hidden: !hrVis.schedule },
    { key: "payroll", label: "الرواتب", hidden: !hrVis.payroll },
    { key: "bonuses", label: "المكافآت والسلف", hidden: !hrVis.bonuses },
    { key: "overtime", label: "العمل الإضافي", hidden: !hrVis.overtime },
    { key: "expenses", label: "المصروفات", hidden: !hrVis.expenses },
    { key: "requests", label: "الطلبات", hidden: !hrVis.requests },
    { key: "documents", label: "المستندات", hidden: !hrVis.documents },
    { key: "contracts", label: "العقود", hidden: !hrVis.contracts },
    { key: "goals", label: "الأهداف و360", hidden: !hrVis.goals },
    { key: "tasks", label: "المهام", hidden: !seeTasks || !emp.user_id },
    { key: "attendance", label: "الحضور", hidden: !seeAttendance || !emp.user_id },
    { key: "timesheets", label: "سجلات الوقت", hidden: !seeTime || !emp.user_id },
    { key: "kpis", label: "المؤشرات والأهداف", hidden: !seeKpis || !emp.user_id },
    { key: "performance", label: "الأداء", hidden: !seePerf || !emp.user_id },
    { key: "commission", label: "العمولات", hidden: !seeCommission || !emp.user_id },
    { key: "leave", label: "الإجازات", hidden: !seeLeave || !emp.user_id },
    { key: "access", label: "الصلاحيات", hidden: !seeAccess },
    { key: "devices", label: "الأجهزة", hidden: !seeDevices },
    { key: "onboarding", label: "التهيئة", hidden: !seeOnboarding },
    { key: "timeline", label: "السجل الزمني" },
    { key: "history", label: "سجل التدقيق", hidden: !can(bos, "audit.read") },
  ];
  const tab = tabs.some((t) => t.key === sp.tab && !t.hidden) ? (sp.tab as string) : "profile";
  const hrTab = ["personal", "employment", "schedule", "payroll", "bonuses", "overtime", "expenses", "requests", "documents", "contracts", "goals"].includes(tab);
  const names = await userNameMap();
  const today = todayIn(emp.timezone);
  const from = sp.from ?? startOfMonth(today);
  const to = sp.to ?? today;
  const uid = emp.user_id as string;

  const { data: authUser } = emp.user_id && canLifecycle ? await db().auth.admin.getUserById(emp.user_id) : { data: null };
  const bannedUntil = (authUser?.user as { banned_until?: string | null } | undefined)?.banned_until;
  const loginDisabled = !!bannedUntil && new Date(bannedUntil).getTime() > nowMs();

  // Tab data (loaded only for the active tab).
  const c = db();
  const [tasks, attendance, timesheets, kpis, commissions, leave, balances, leaveTypes, access, apps, devices, checklists, reviews] = await Promise.all([
    tab === "tasks" ? c.from("tasks").select("id, title, status, priority, due_date, projects(id, name)").eq("assigned_to", uid).not("status", "in", "(completed,cancelled)").order("due_date", { nullsFirst: false }).limit(100).then((r) => r.data ?? []) : Promise.resolve([]),
    tab === "attendance" || tab === "profile" ? getAttendanceRange(uid, tab === "profile" ? addDays(today, -6) : from, tab === "profile" ? today : to) : Promise.resolve([]),
    tab === "timesheets" ? getTimesheets([uid], from, to) : Promise.resolve(null),
    tab === "kpis" ? computeUserKpis(uid, today, false) : Promise.resolve([]),
    tab === "commission" ? c.from("commissions").select("id, amount, currency, status, created_at, deals(id, name, deal_number), commission_rules(name)").eq("user_id", uid).order("created_at", { ascending: false }).limit(100).then((r) => r.data ?? []) : Promise.resolve([]),
    tab === "leave" ? listLeaveRequests(bos, "all", { view: "all", user: uid }) : Promise.resolve([]),
    tab === "leave" ? getBalances(uid, Number(today.slice(0, 4))) : Promise.resolve([]),
    tab === "leave" ? listLeaveTypes() : Promise.resolve([]),
    tab === "access" ? getAccessProfile(id) : Promise.resolve(null),
    tab === "access" ? listApps(false) : Promise.resolve([]),
    tab === "devices" ? c.from("devices").select("*, device_assignments(id, employee_id, assigned_at, confirmed_by_employee_at, returned_at)").eq("assigned_employee_id", id).then((r) => r.data ?? []) : Promise.resolve([]),
    tab === "onboarding" ? listEmployeeChecklists(id) : Promise.resolve([]),
    tab === "performance" ? c.from("performance_reviews").select("*").eq("user_id", uid).order("period_end", { ascending: false }).then((r) => r.data ?? []) : Promise.resolve([]),
  ]);
  const deviceHistory = tab === "devices" ? (await c.from("device_assignments").select("*, devices(id, asset_id, type, model)").eq("employee_id", id).order("assigned_at", { ascending: false })).data ?? [] : [];
  const week = summarize(attendance);
  const sched = emp.work_schedules as unknown as { id: string; name: string; timezone: string; start_time: string; end_time: string; work_days: number[]; break_minutes: number; grace_minutes: number } | null;
  const dayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const transitions = canLifecycle ? lifecycleTransitions[emp.lifecycle_status] : [];

  return (
    <>
      <PageHeader
        title={<span className="bos-profile-hero"><UserAvatar name={emp.full_name} employeeId={emp.id} version={emp.photo_updated_at} size="xl" /><span>{emp.full_name}{emp.employee_code ? <span className="cell-sub" style={{ fontSize: 12 }}><Tx>{emp.employee_code}</Tx></span> : null}</span></span>}
        subtitle={
          <span className="bos-row" style={{ gap: 8, flexWrap: "wrap" }}>
            <StatusBadge map="employee_lifecycle_status" value={emp.lifecycle_status} />
            {emp.position ? <span>{emp.position}</span> : null}
            {emp.roles.map((r) => <StatusBadge key={r.id} tone="neutral" label={r.name} />)}
          </span>
        }
        breadcrumbs={[{ label: "الفريق" }, { label: "الموظفون", href: "/admin/team/employees" }, { label: emp.full_name }]}
        actions={
          <>
            {canPhoto && !emp.archived_at ? <PhotoUploader employeeId={id} hasPhoto={!!emp.photo_path} /> : null}
            {canUpdate && !emp.archived_at ? <Link href={`/admin/team/employees/${id}/edit`} className="admin-btn small secondary"><Tx>تعديل</Tx></Link> : null}
            {can(bos, "employees.manage") && !emp.archived_at ? <LoginControls employeeId={id} hasLogin={!!emp.user_id} disabled={loginDisabled} /> : null}
            {canLifecycle ? <LifecycleControls employeeId={id} transitions={transitions.filter((t) => t !== "active" || emp.lifecycle_status !== "onboarding")} canRestore={bos.isSuperAdmin && emp.lifecycle_status === "archived"} /> : null}
          </>
        }
      />

      <Summary
        items={[
          { label: "القسم", value: (emp.departments as { name: string } | null)?.name ?? "—" },
          { label: "الفريق", value: (emp.teams as { name: string } | null)?.name ?? "—" },
          { label: "الفرع", value: (emp as { branches?: { name: string } | null }).branches?.name ?? "—" },
          { label: "مكان العمل", value: emp.work_location ?? "—" },
          { label: "تاريخ التعيين", value: formatDate(emp.start_date) },
          { label: "المدير", value: emp.manager ? <Link href={`/admin/team/employees/${emp.manager.id}`}>{emp.manager.full_name}</Link> : "—" },
          { label: "البريد الرسمي", value: emp.email ? <span dir="ltr">{emp.email}</span> : "—" },
          { label: "2FA", value: <StatusBadge map="mfa_status" value={emp.mfa_status} /> },
          { label: "آخر نشاط في النظام", value: emp.last_activity_at ? <span title={t("آخر إجراء مسجل في النظام — ليس دليلاً على العمل المتواصل")}><RelTime value={emp.last_activity_at} /></span> : "—" },
        ]}
      />

      <Tabs tabs={tabs} active={tab} baseHref={`/admin/team/employees/${id}`} />

      {tab === "profile" ? (
        <div className="bos-grid main-side">
          <div>
            <Card title="البيانات">
              <KeyValues
                items={[
                  { label: "كود الموظف", value: emp.employee_code },
                  { label: "الهاتف", value: emp.phone ? <span dir="ltr">{emp.phone}</span> : null },
                  { label: "البريد الشخصي", value: emp.personal_email ? <span dir="ltr"><Tx>{emp.personal_email}</Tx></span> : null, hidden: !canSensitive && !isSelf },
                  { label: "تاريخ البدء", value: formatDate(emp.start_date) },
                  { label: "نوع التوظيف", value: <StatusBadge map="employment_type" value={emp.employment_type} /> },
                  { label: "الدولة", value: emp.country },
                  { label: "المنطقة الزمنية", value: <span dir="ltr">{emp.timezone}</span> },
                  { label: "عن بُعد", value: emp.is_remote ? "نعم" : "لا" },
                  { label: "تكلفة الساعة", value: emp.hourly_cost != null ? <Money value={emp.hourly_cost} currency={emp.cost_currency} /> : null, hidden: !canSensitive },
                  { label: "حساب الدخول", value: emp.user_id ? (loginDisabled ? "معطّل" : "مفعّل") : "لا يوجد" },
                ]}
              />
            </Card>
            <Card title="جدول العمل">
              {sched ? (
                <KeyValues
                  items={[
                    { label: "الجدول", value: sched.name },
                    { label: "أيام العمل", value: sched.work_days.map((d) => dayNames[d]).join("، ") },
                    { label: "الساعات", value: `${sched.start_time.slice(0, 5)} – ${sched.end_time.slice(0, 5)} (${sched.timezone})` },
                    { label: "الاستراحة", value: `${sched.break_minutes} دقيقة` },
                    { label: "السماح", value: `${sched.grace_minutes} دقيقة` },
                  ]}
                />
              ) : <div className="bos-faint"><Tx>الجدول الافتراضي</Tx></div>}
            </Card>
          </div>
          <div>
            {emp.user_id && seeAttendance ? (
              <Card title="آخر 7 أيام" actions={<Link className="bos-link" href={`/admin/team/employees/${id}?tab=attendance`}><Tx>الحضور</Tx></Link>}>
                <KeyValues items={[{ label: "ساعات العمل", value: formatMinutes(week.worked) }, { label: "أيام التأخير", value: week.lateDays }, { label: "الغياب", value: week.absences }, { label: "إضافي", value: formatMinutes(week.overtime) }]} />
              </Card>
            ) : null}
            <Card title={<Tx vars={{ directReports_count: emp.directReports.length }}>{"المرؤوسون المباشرون ({directReports_count})"}</Tx>}>
              {emp.directReports.length ? emp.directReports.map((r) => (
                <div key={r.id} style={{ marginBottom: 6 }}>
                  <Link href={`/admin/team/employees/${r.id}`}>{r.full_name}</Link> <span className="bos-faint" style={{ fontSize: 12 }}>{r.position ?? ""}</span>
                </div>
              )) : <div className="bos-faint" style={{ fontSize: 13 }}><Tx>لا يوجد.</Tx></div>}
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "tasks" ? (
        <Card title="المهام المفتوحة">
          {tasks.length ? (
            <table className="bos-table responsive">
              <tbody>
                {(tasks as { id: string; title: string; status: string; priority: string; due_date: string | null; projects: unknown }[]).map((t) => (
                  <tr key={t.id}>
                    <td className="cell-primary"><Link href={`/admin/projects/tasks/${t.id}`}><Tx>{t.title}</Tx></Link><span className="cell-sub">{(t.projects as { name: string } | null)?.name ?? ""}</span></td>
                    <td><StatusBadge map="task_status" value={t.status} /></td>
                    <td><StatusBadge map="priority" value={t.priority} /></td>
                    <td style={t.due_date && t.due_date < today ? { color: "#f87171" } : undefined}>{formatDate(t.due_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyState title="لا توجد مهام مفتوحة" />}
        </Card>
      ) : null}

      {tab === "attendance" ? (
        <>
          <form className="bos-row" style={{ gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <input type="hidden" name="tab" value="attendance" />
            <label className="bos-faint" style={{ fontSize: 12.5 }}><Tx>من</Tx> <input type="date" name="from" defaultValue={from} /></label>
            <label className="bos-faint" style={{ fontSize: 12.5 }}><Tx>إلى</Tx> <input type="date" name="to" defaultValue={to} /></label>
            <button className="admin-btn small secondary" type="submit"><Tx>عرض</Tx></button>
            {isSelf ? <CorrectionButton /> : null}
            {can(bos, "attendance.update") && bos.permissions.get("attendance.update") === "all" ? <HrEditButton userId={uid} label="إضافة/تعديل جلسة (HR)" /> : null}
          </form>
          <Summary
            items={[
              { label: "ساعات العمل", value: formatMinutes(summarize(attendance).worked) },
              { label: "المتوقع", value: formatMinutes(summarize(attendance).expected) },
              { label: "إضافي", value: formatMinutes(summarize(attendance).overtime) },
              { label: "أيام التأخير", value: summarize(attendance).lateDays },
              { label: "الغياب", value: summarize(attendance).absences },
              { label: "الإجازات", value: summarize(attendance).leave },
            ]}
          />
          <Card>
            <AttendanceTable
              rows={attendance}
              actions={(r) => {
                const sessions = ((r.attendance_sessions as { id: string; clock_in_at: string; clock_out_at: string | null }[]) ?? []).map((s) => ({ value: s.id, label: `${formatDateTime(s.clock_in_at, r.timezone)} → ${s.clock_out_at ? formatDateTime(s.clock_out_at, r.timezone) : "مفتوحة"}` }));
                return (
                  <span className="bos-row" style={{ gap: 4 }}>
                    {isSelf ? <CorrectionButton workDate={r.work_date} sessions={sessions} label="تصحيح" /> : null}
                    {bos.permissions.get("attendance.update") === "all" ? <HrEditButton userId={uid} workDate={r.work_date} sessions={sessions} label="HR" /> : null}
                  </span>
                );
              }}
            />
          </Card>
        </>
      ) : null}

      {tab === "timesheets" && timesheets ? (
        <>
          <form className="bos-row" style={{ gap: 8, marginBottom: 10 }}>
            <input type="hidden" name="tab" value="timesheets" />
            <label className="bos-faint" style={{ fontSize: 12.5 }}><Tx>من</Tx> <input type="date" name="from" defaultValue={from} /></label>
            <label className="bos-faint" style={{ fontSize: 12.5 }}><Tx>إلى</Tx> <input type="date" name="to" defaultValue={to} /></label>
            <button className="admin-btn small secondary" type="submit"><Tx>عرض</Tx></button>
          </form>
          <Summary items={[{ label: "جلسات العمل", value: formatMinutes(timesheets.sessions.reduce((s, x) => s + (x.clock_out_at ? Math.round((new Date(x.clock_out_at).getTime() - new Date(x.clock_in_at).getTime()) / 60000) : 0), 0)) }, { label: "وقت المشاريع", value: formatMinutes(timesheets.entries.reduce((s, x) => s + (x.duration_minutes ?? 0), 0)) }, { label: "قابل للفوترة", value: formatMinutes(timesheets.entries.filter((x) => x.billable).reduce((s, x) => s + (x.duration_minutes ?? 0), 0)) }]} />
          <Card title="الوقت على المشاريع والمهام">
            {timesheets.entries.length ? (
              <table className="bos-table responsive">
                <thead><tr><th><Tx>التاريخ</Tx></th><th><Tx>المشروع / المهمة</Tx></th><th><Tx>المدة</Tx></th><th><Tx>الوصف</Tx></th></tr></thead>
                <tbody>
                  {timesheets.entries.map((t) => (
                    <tr key={t.id}>
                      <td>{formatDateTime(t.started_at, emp.timezone)}</td>
                      <td>{(t.projects as { name: string } | null)?.name ?? "—"}{(t.tasks as { title: string } | null)?.title ? <span className="cell-sub">{(t.tasks as { title: string }).title}</span> : null}</td>
                      <td>{t.duration_minutes ? formatMinutes(t.duration_minutes) : <span className="bos-faint"><Tx>جارٍ</Tx></span>}{t.billable ? "" : <span className="cell-sub"><Tx>غير قابل للفوترة</Tx></span>}</td>
                      <td><Tx>{t.description ?? "—"}</Tx></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <EmptyState title="لا يوجد وقت مسجل" />}
          </Card>
        </>
      ) : null}

      {tab === "kpis" ? (
        <Card title={<Tx>{"المؤشرات — الفترة الحالية"}</Tx>} actions={<Link className="bos-link" href={`/admin/team/performance/${uid}`}><Tx>ملف الأداء</Tx></Link>}>
          {kpis.length ? (
            <table className="bos-table responsive">
              <thead><tr><th><Tx>المؤشر</Tx></th><th><Tx>الفترة</Tx></th><th><Tx>الفعلي</Tx></th><th><Tx>المستهدف</Tx></th><th><Tx>التحقيق</Tx></th><th /></tr></thead>
              <tbody>
                {kpis.map((k) => (
                  <tr key={k.kpi.id}>
                    <td className="cell-primary">{k.kpi.name}<span className="cell-sub">{k.kpi.category ?? ""} · {kpiUnitLabels[k.kpi.unit]}{k.kpi.direction === "lower_better" ? " · الأقل أفضل" : ""}</span></td>
                    <td><Tx>{kpiPeriodLabels[k.kpi.period]}</Tx><span className="cell-sub">{formatDate(k.start)} → {formatDate(k.end)}</span></td>
                    <td>{k.valid ? (k.actual ?? "—") : <span className="bos-faint"><Tx>مصدر غير صالح</Tx></span>}</td>
                    <td><Tx>{k.target}</Tx></td>
                    <td style={{ minWidth: 120 }}>{k.attainment != null ? <><ProgressBar value={Math.min(100, k.attainment)} tone={k.attainment >= 100 ? "success" : k.attainment < 60 ? "warning" : undefined} /><span className="cell-sub">{k.attainment}%</span></> : "—"}</td>
                    <td>{(k.kpi.calculation === "manual" || k.kpi.data_source === "manual") && can(bos, "kpis.update") && !isSelf ? <ManualKpiButton kpiId={k.kpi.id} userId={uid} date={today} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyState title="لا توجد مؤشرات مخصصة" description="المؤشرات تُخصص حسب الدور أو يدوياً من صفحة مؤشرات الأداء." />}
        </Card>
      ) : null}

      {tab === "performance" ? (
        <Card title="مراجعات الأداء" actions={<Link className="admin-btn small secondary" href={`/admin/team/performance/${uid}`}><Tx>ملف الأداء الكامل</Tx></Link>}>
          {reviews.filter((r) => !isSelf || r.status !== "draft").length ? reviews.filter((r) => !isSelf || r.status !== "draft").map((r) => (
            <div key={r.id} style={{ borderBottom: "1px solid rgba(var(--bos-fg-rgb), 0.06)", padding: "8px 0" }}>
              <strong>{formatDate(r.period_start)} → {formatDate(r.period_end)}</strong> <StatusBadge map="review_status" value={r.status} />
              <div className="bos-faint" style={{ fontSize: 12 }}>المراجِع: {r.reviewer_id ? names.get(r.reviewer_id) ?? "—" : "—"}</div>
              {r.summary ? <div className="bos-prose" style={{ fontSize: 13, marginTop: 4 }}>{r.summary}</div> : null}
            </div>
          )) : <EmptyState title="لا توجد مراجعات" />}
        </Card>
      ) : null}

      {tab === "commission" ? (
        <Card title="العمولات">
          {commissions.length ? (
            <table className="bos-table responsive">
              <tbody>
                {(commissions as { id: string; amount: number; currency: string; status: string; created_at: string; deals: unknown; commission_rules: unknown }[]).map((cm) => (
                  <tr key={cm.id}>
                    <td className="cell-primary">{(cm.deals as { id: string; name: string } | null) ? <Link href={`/admin/sales/deals/${(cm.deals as { id: string }).id}`}>{(cm.deals as { name: string }).name}</Link> : "—"}<span className="cell-sub">{(cm.commission_rules as { name: string } | null)?.name ?? ""}</span></td>
                    <td><Money value={cm.amount} currency={cm.currency} /></td>
                    <td><StatusBadge map="commission_status" value={cm.status} /></td>
                    <td>{formatDate(cm.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyState title="لا توجد عمولات" />}
        </Card>
      ) : null}

      {tab === "leave" ? (
        <>
          <Card title={<Tx vars={{ v: today.slice(0, 4) }}>{"أرصدة {v}"}</Tx>} actions={isSelf || bos.permissions.get("leave.create") === "all" ? <LeaveRequestButton types={leaveTypes.map((t) => ({ value: t.id, label: t.name }))} forUsers={!isSelf ? [{ value: uid, label: emp.full_name }] : undefined} /> : null}>
            <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
              {balances.map((b) => (
                <div key={b.type.id} className="bos-kpi">
                  <div className="bos-kpi-label">{b.type.name}</div>
                  <div className="bos-kpi-value"><Tx>{b.remaining ?? "∞"}</Tx></div>
                  <div className="bos-kpi-sub">مستخدم {b.used}{b.pending ? ` · معلّق ${b.pending}` : ""}{b.allowance != null ? ` من ${b.allowance}` : ""}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card title="الطلبات"><LeaveTable rows={leave} names={names} viewerId={bos.userId} canManage={can(bos, "leave.manage")} /></Card>
        </>
      ) : null}

      {tab === "access" && access ? (
        <>
          <Card
            title="ملف الصلاحيات"
            actions={
              <span className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}>
                {canManageAccess ? <AddGrantButton employeeId={id} apps={apps.filter((a) => !access.grants.some((g) => g.app_id === a.id)).map((a) => ({ id: a.id, name: a.name, access_levels: a.access_levels }))} /> : null}
                {canManageAccess && emp.user_id ? <RegenerateAccessButton employeeId={id} /> : null}
                {(isSelf || can(bos, "access.create")) && !["suspended", "offboarding", "archived"].includes(emp.lifecycle_status) ? <RequestAccessButton employeeId={id} apps={apps.map((a) => ({ id: a.id, name: a.name, access_levels: a.access_levels, is_sensitive: a.is_sensitive }))} /> : null}
              </span>
            }
          >
            <KeyValues
              items={[
                { label: "الدور", value: emp.roles.map((r) => r.name).join("، ") || "—" },
                { label: "القسم", value: (emp.departments as { name: string } | null)?.name ?? "—" },
                { label: "المدير", value: emp.manager?.full_name ?? "—" },
                { label: "البريد الرسمي", value: emp.email ? <span dir="ltr">{emp.email}</span> : "—" },
                { label: "2FA", value: <span className="bos-row" style={{ gap: 8 }}><StatusBadge map="mfa_status" value={emp.mfa_status} />{canManageAccess || isSelf ? <MfaControls employeeId={id} status={emp.mfa_status} canManage={canManageAccess} /> : null}</span> },
              ]}
            />
            <div className="bos-row" style={{ gap: 12, flexWrap: "wrap", margin: "10px 0", fontSize: 12.5 }}>
              <span><Tx vars={{ required_count: access.groups.required.length }}>{"مطلوب: {required_count}"}</Tx></span>
              <span style={{ color: "var(--bos-success)" }}><Tx vars={{ granted_count: access.groups.granted.length }}>{"مفعّل: {granted_count}"}</Tx></span>
              <span style={{ color: "#f87171" }}><Tx vars={{ missing_count: access.groups.missing.length }}>{"ناقص: {missing_count}"}</Tx></span>
              <span style={{ color: "var(--bos-warning)" }}><Tx vars={{ pending_count: access.groups.pending.length }}>{"قيد الطلب: {pending_count}"}</Tx></span>
              <span><Tx vars={{ revoked_count: access.groups.revoked.length }}>{"مسحوب: {revoked_count}"}</Tx></span>
              <span><Tx vars={{ expired_count: access.groups.expired.length }}>{"منتهي: {expired_count}"}</Tx></span>
              {access.groups.review.length ? <span style={{ color: "var(--bos-warning)" }}><Tx vars={{ review_count: access.groups.review.length }}>{"يحتاج مراجعة: {review_count}"}</Tx></span> : null}
            </div>
            <AccessProfileView employeeId={id} grants={access.grants} canManage={canManageAccess} />
          </Card>
          <Card title="حسابات الشركة" actions={canManageAccess ? <CompanyAccountButton initial={{ employee_id: id }} employees={[{ value: id, label: emp.full_name }]} apps={apps.map((a) => ({ value: a.id, label: a.name }))} staff={[...names.entries()].map(([value, label]) => ({ value, label }))} /> : null}>
            {access.accounts.length ? (
              <table className="bos-table responsive">
                <tbody>
                  {access.accounts.map((a) => (
                    <tr key={a.id}>
                      <td className="cell-primary"><span dir="ltr">{a.identifier}</span><span className="cell-sub">{a.provider} · {a.account_type}</span></td>
                      <td><StatusBadge map="access_status" value={a.status} /></td>
                      <td><StatusBadge map="mfa_status" value={a.mfa_status} /></td>
                      <td className="bos-faint" style={{ fontSize: 12 }}>{a.last_reviewed_at ? `مراجعة ${formatDate(a.last_reviewed_at)}` : "لم تُراجع"}</td>
                      <td>{canManageAccess ? <CompanyAccountButton label="تعديل" initial={{ ...a }} employees={[{ value: id, label: emp.full_name }]} apps={apps.map((x) => ({ value: x.id, label: x.name }))} staff={[...names.entries()].map(([value, label]) => ({ value, label }))} /> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <EmptyState title="لا توجد حسابات مسجلة" />}
          </Card>
          <Card title="طلبات الوصول">
            {access.requests.length ? access.requests.map((r) => (
              <div key={r.id} style={{ fontSize: 13, marginBottom: 6 }}>
                {(r.external_apps as { name: string } | null)?.name}{r.access_level ? ` (${r.access_level})` : ""} — <StatusBadge map="simple_approval" value={r.status} /> <span className="bos-faint" style={{ fontSize: 12 }}>{formatDate(r.created_at)} · {r.reason}</span>
              </div>
            )) : <div className="bos-faint" style={{ fontSize: 13 }}><Tx>لا توجد طلبات.</Tx></div>}
          </Card>
        </>
      ) : null}

      {tab === "devices" ? (
        <>
          <Card title="الأجهزة المسلّمة">
            {devices.length ? (
              <table className="bos-table responsive">
                <tbody>
                  {devices.map((d) => {
                    const open = ((d.device_assignments as { id: string; employee_id: string; confirmed_by_employee_at: string | null; returned_at: string | null }[]) ?? []).find((x) => !x.returned_at && x.employee_id === id);
                    return (
                      <tr key={d.id}>
                        <td className="cell-primary"><Link href={`/admin/team/devices/${d.id}`}>{d.asset_id}</Link><span className="cell-sub">{d.model ?? ""} · {d.serial_number ?? ""}</span></td>
                        <td><StatusBadge map="device_type" value={d.type} /></td>
                        <td><StatusBadge map="device_security_status" value={d.security_status} /></td>
                        <td>{d.return_status === "pending_return" ? <StatusBadge map="return_status" value={d.return_status} /> : null}</td>
                        <td>{open?.confirmed_by_employee_at ? <span className="bos-faint" style={{ fontSize: 12 }}><Tx vars={{ v: formatDate(open.confirmed_by_employee_at) }}>{"استُلم {v}"}</Tx></span> : isSelf ? <ConfirmReceiptButton deviceId={d.id} /> : <span className="bos-faint" style={{ fontSize: 12 }}><Tx>لم يؤكد الاستلام</Tx></span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : <EmptyState title="لا توجد أجهزة مسلّمة" />}
          </Card>
          <Card title="سجل التسليم والاسترجاع">
            {deviceHistory.length ? deviceHistory.map((h) => (
              <div key={h.id} style={{ fontSize: 13, marginBottom: 6 }}>
                {(h.devices as { asset_id: string } | null)?.asset_id} — سُلّم {formatDate(h.assigned_at)}{h.returned_at ? ` · استُرجع ${formatDate(h.returned_at)} (${h.condition_in ?? ""})` : ""}
              </div>
            )) : <div className="bos-faint" style={{ fontSize: 13 }}><Tx>لا يوجد.</Tx></div>}
          </Card>
        </>
      ) : null}

      {tab === "onboarding" ? (
        checklists.length ? (
          checklists.map((cl) => (
            <Card key={cl.id} title={cl.template_key === "employee_offboarding" ? "إنهاء الخدمة (مستنتج — بانتظار تأكيد المواصفات)" : "التهيئة"} actions={<span className="bos-row" style={{ gap: 6 }}><RefreshOnboardingButton employeeId={id} /><Link className="bos-link" href={`/admin/team/onboarding/${id}`}><Tx>صفحة التهيئة</Tx></Link></span>}>
              <ChecklistView employeeId={id} checklist={cl} names={names} canManage={can(bos, "onboarding.update") || can(bos, "onboarding.manage")} links={{ device_assigned: { href: "/admin/team/devices", label: "الأجهزة" }, company_email: { href: `/admin/team/employees/${id}?tab=access`, label: "حسابات الشركة" }, kpis_assigned: { href: "/admin/team/kpis", label: "المؤشرات" } }} />
            </Card>
          ))
        ) : <EmptyState title="لا توجد قائمة تهيئة" />
      ) : null}

      {hrTab ? <EmployeeHrTab tab={tab} ctx={{ bos, employee: emp, isSelf, isManager, today }} /> : null}

      {tab === "timeline" ? <Card title="السجل الزمني"><ActivityTimeline entityType="employee" entityId={id} limit={80} /></Card> : null}
      {tab === "history" ? <Card title="سجل التدقيق"><AuditLogPanel entityType="employee" entityId={id} /></Card> : null}
      {tab === "profile" ? <RecordDocuments bos={bos} entityType="employee" entityId={id} /> : null}
    </>
  );
}
