import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { db } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { Card, EmptyState, KeyValues, Money, StatusBadge, ProgressBar } from "@/components/bos/ui";
import { formatDate, formatDateTime, formatMinutes, addDays } from "@/lib/bos/format";
import { statusLabel } from "@/lib/bos/labels";
import { listCurrencies, listDepartments, userNameMap } from "@/services/bos/shared";
import { getEmployeePrivate, listCompensation, listEmployeeComponents, listJobHistory, listSalaryComponents } from "@/services/bos/hr/people";
import { listDocuments, listDocumentTypes, listContracts, daysUntil } from "@/services/bos/hr/documents";
import { listPayslips } from "@/services/bos/hr/payroll";
import { listBonuses, listLoans, listExpenseClaims, listHrRequests, listRequestTypes } from "@/services/bos/hr/requests";
import { listGoals, listFeedback, listCycles } from "@/services/bos/hr/performance";
import { getRoster, weekdayNames } from "@/services/bos/hr/schedules";
import { listOvertime } from "@/services/bos/attendance";
import {
  BonusButton, CompensationButton, ComponentButton, EndComponentButton, ExpenseClaimButton, GoalButton, GoalProgressButton, HrRequestButton, HrRequestSteps,
  LoanButton, LoanSteps, NewContractButton, NewDocumentButton, DocumentRowActions, PrivateDataButton, PromoteButton, RequestFeedbackButton, ExitInterviewButton,
  OvertimeMinutesButton,
} from "../../HrControls";

export interface HrTabContext {
  bos: BosUser;
  employee: { id: string; user_id: string | null; full_name: string; position: string | null; lifecycle_status: string; timezone: string; team_id: string | null; department_id: string | null; country: string | null; photo_updated_at: string | null };
  isSelf: boolean;
  isManager: boolean;
  today: string;
}

const all = (bos: BosUser, key: Parameters<BosUser["permissions"]["get"]>[0]) => bos.isSuperAdmin || bos.permissions.get(key) === "all";

// Which HR tabs the viewer may open (docs/bos/28 §7, §31).
export function hrTabVisibility(ctx: Omit<HrTabContext, "today">) {
  const { bos, isSelf, isManager, employee } = ctx;
  const hasLogin = !!employee.user_id;
  return {
    personal: isSelf || bos.permissions.has("employees.view_sensitive") || bos.isSuperAdmin,
    employment: isSelf || isManager || all(bos, "employees.update") || bos.permissions.has("employees.view_sensitive"),
    schedule: hasLogin && (isSelf || isManager || all(bos, "attendance.read")),
    payroll: isSelf || all(bos, "payroll.read"),
    bonuses: isSelf || isManager || all(bos, "payroll.read"),
    expenses: hasLogin && (isSelf || isManager || all(bos, "hr_requests.read") || all(bos, "expenses.read")),
    overtime: hasLogin && (isSelf || isManager || all(bos, "overtime.read")),
    requests: isSelf || isManager || all(bos, "hr_requests.read"),
    documents: isSelf || isManager || all(bos, "hr_documents.read"),
    contracts: isSelf || all(bos, "hr_documents.read"),
    goals: hasLogin && (isSelf || isManager || all(bos, "performance.read")),
  };
}

export async function EmployeeHrTab({ tab, ctx }: { tab: string; ctx: HrTabContext }) {
  switch (tab) {
    case "personal": return <PersonalTab ctx={ctx} />;
    case "employment": return <EmploymentTab ctx={ctx} />;
    case "schedule": return <ScheduleTab ctx={ctx} />;
    case "payroll": return <PayrollTab ctx={ctx} />;
    case "bonuses": return <BonusesLoansTab ctx={ctx} />;
    case "expenses": return <ExpensesTab ctx={ctx} />;
    case "overtime": return <OvertimeTab ctx={ctx} />;
    case "requests": return <RequestsTab ctx={ctx} />;
    case "documents": return <DocumentsTab ctx={ctx} />;
    case "contracts": return <ContractsTab ctx={ctx} />;
    case "goals": return <GoalsTab ctx={ctx} />;
    default: return null;
  }
}

async function PersonalTab({ ctx }: { ctx: HrTabContext }) {
  const p = await getEmployeePrivate(ctx.employee.id);
  const hr = ctx.bos.permissions.has("employees.view_sensitive") && all(ctx.bos, "employees.update");
  const canEdit = ctx.isSelf || hr;
  const mask = (v: string | null | undefined) => (v ? (ctx.isSelf || hr ? v : `••••${v.slice(-4)}`) : null);
  const initial = Object.fromEntries(Object.entries(p ?? {}).map(([k, v]) => [k, v == null ? null : String(v)]));
  return (
    <div className="bos-grid cols-2" style={{ gap: 12 }}>
      <Card title="البيانات الشخصية" actions={canEdit ? <PrivateDataButton employeeId={ctx.employee.id} initial={initial} selfOnly={ctx.isSelf && !hr} /> : null}>
        <KeyValues items={[
          { label: "تاريخ الميلاد", value: formatDate(p?.date_of_birth) },
          { label: "النوع", value: p?.gender === "male" ? "ذكر" : p?.gender === "female" ? "أنثى" : null },
          { label: "الجنسية", value: p?.nationality },
          { label: "الحالة الاجتماعية", value: p?.marital_status ? { single: "أعزب", married: "متزوج", divorced: "مطلق", widowed: "أرمل" }[p.marital_status] : null },
          { label: "العنوان", value: p?.address },
        ]} />
      </Card>
      <Card title="جهة الاتصال للطوارئ">
        <KeyValues items={[
          { label: "الاسم", value: p?.emergency_contact_name },
          { label: "صلة القرابة", value: p?.emergency_contact_relation },
          { label: "الهاتف", value: p?.emergency_contact_phone ? <span dir="ltr"><Tx>{p.emergency_contact_phone}</Tx></span> : null },
        ]} />
      </Card>
      <Card title="الهوية والضرائب والتأمينات">
        <KeyValues items={[
          { label: "الرقم القومي", value: mask(p?.national_id) ? <span dir="ltr">{mask(p?.national_id)}</span> : null },
          { label: "انتهاء البطاقة", value: formatDate(p?.national_id_expiry) },
          { label: "جواز السفر", value: mask(p?.passport_number) ? <span dir="ltr">{mask(p?.passport_number)}</span> : null },
          { label: "انتهاء الجواز", value: formatDate(p?.passport_expiry) },
          { label: "الرقم الضريبي", value: mask(p?.tax_id) },
          { label: "الرقم التأميني", value: mask(p?.insurance_number) },
          { label: "بداية التأمين", value: formatDate(p?.insurance_start_date) },
        ]} />
      </Card>
      <Card title="البيانات البنكية">
        <KeyValues items={[
          { label: "البنك", value: p?.bank_name },
          { label: "اسم الحساب", value: p?.bank_account_name },
          { label: "رقم الحساب", value: mask(p?.bank_account_number) ? <span dir="ltr">{mask(p?.bank_account_number)}</span> : null },
          { label: "IBAN", value: mask(p?.bank_iban) ? <span dir="ltr">{mask(p?.bank_iban)}</span> : null },
        ]} />
      </Card>
      {hr && p?.hr_notes ? <Card title="ملاحظات الموارد البشرية (سرية)"><div className="bos-prose"><Tx>{p.hr_notes}</Tx></div></Card> : null}
    </div>
  );
}

async function EmploymentTab({ ctx }: { ctx: HrTabContext }) {
  const [{ data: emp }, history, departments, { data: managers }, currencies, names, { data: sep }] = await Promise.all([
    db().from("employees").select("*, departments(name), teams(name), employee_categories(name)").eq("id", ctx.employee.id).single(),
    listJobHistory(ctx.employee.id),
    listDepartments(),
    db().from("employees").select("id, full_name").is("archived_at", null).neq("id", ctx.employee.id).order("full_name"),
    listCurrencies(),
    userNameMap(),
    db().from("employee_separations").select("*").eq("employee_id", ctx.employee.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const canHr = all(ctx.bos, "employees.update");
  const deptName = (id: string | null) => departments.find((d) => d.id === id)?.name ?? null;
  return (
    <>
      <div className="bos-grid cols-2" style={{ gap: 12 }}>
        <Card title="بيانات التوظيف" actions={canHr && ["active", "on_leave", "onboarding"].includes(ctx.employee.lifecycle_status) ? <PromoteButton employeeId={ctx.employee.id} position={ctx.employee.position} departments={departments.map((d) => ({ value: d.id, label: d.name }))} managers={(managers ?? []).map((m) => ({ value: m.id, label: m.full_name }))} currencies={currencies} canSalary={all(ctx.bos, "payroll.update")} /> : null}>
          <KeyValues items={[
            { label: "المسمى الوظيفي", value: emp?.position },
            { label: "القسم", value: (emp?.departments as { name: string } | null)?.name },
            { label: "الفريق", value: (emp?.teams as { name: string } | null)?.name },
            { label: "نوع التوظيف", value: <StatusBadge map="employment_type" value={emp?.employment_type} /> },
            { label: "التصنيف", value: (emp?.employee_categories as { name: string } | null)?.name },
            { label: "الفرع / الموقع", value: emp?.work_location },
            { label: "تاريخ التعيين", value: formatDate(emp?.start_date) },
            { label: "فترة الاختبار", value: emp?.probation_status && emp.probation_status !== "none" ? <span><StatusBadge map="probation_status" value={emp.probation_status} /> {emp.probation_end_date ? `حتى ${formatDate(emp.probation_end_date)}` : ""}</span> : "لا يوجد" },
            { label: "الحالة", value: <StatusBadge map="employee_lifecycle_status" value={emp?.lifecycle_status} /> },
          ]} />
        </Card>
        <Card title="المهارات والمؤهلات">
          <KeyValues items={[
            { label: "المهارات", value: emp?.skills?.length ? <span className="bos-row" style={{ gap: 4, flexWrap: "wrap" }}>{emp.skills.map((s: string) => <span key={s} className="bos-badge tone-neutral plain">{s}</span>)}</span> : null },
            { label: "سنوات الخبرة", value: emp?.experience_years },
            { label: "المؤهلات", value: emp?.qualifications },
            { label: "الشهادات", value: emp?.certifications },
            { label: "ملاحظات", value: emp?.profile_notes },
          ]} />
        </Card>
      </div>
      {sep ? (
        <Card title="إنهاء الخدمة" actions={canHr && sep.status !== "cancelled" ? <ExitInterviewButton employeeId={ctx.employee.id} initial={{ exit_interview_at: sep.exit_interview_at, exit_interview_notes: sep.exit_interview_notes, rehire_eligible: sep.rehire_eligible, last_working_day: sep.last_working_day }} /> : null}>
          <KeyValues items={[
            { label: "النوع", value: statusLabel("separation_type", sep.separation_type) },
            { label: "الحالة", value: sep.status === "completed" ? "مكتمل" : sep.status === "cancelled" ? "ملغي" : "قيد التنفيذ" },
            { label: "تاريخ الإخطار", value: formatDate(sep.notice_date) },
            { label: "آخر يوم عمل", value: formatDate(sep.last_working_day) },
            { label: "السبب", value: sep.reason },
            { label: "مقابلة الخروج", value: sep.exit_interview_at ? formatDateTime(sep.exit_interview_at) : "لم تتم" },
            { label: "مؤهل لإعادة التعيين", value: sep.rehire_eligible == null ? "—" : sep.rehire_eligible ? "نعم" : "لا" },
            { label: "ملاحظات المقابلة", value: canHr ? sep.exit_interview_notes : null, hidden: !canHr },
          ]} />
        </Card>
      ) : null}
      <Card title="السجل الوظيفي (تعيين، ترقية، نقل، تعديل راتب)">
        {history.length ? (
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>التاريخ</Tx></th><th><Tx>التغيير</Tx></th><th><Tx>من</Tx></th><th><Tx>إلى</Tx></th><th><Tx>السبب</Tx></th><th><Tx>بواسطة</Tx></th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{formatDate(h.effective_date)}</td>
                  <td><StatusBadge map="job_change_type" value={h.change_type} /></td>
                  <td>{[h.from_position, deptName(h.from_department_id)].filter(Boolean).join(" · ") || "—"}</td>
                  <td>{[h.to_position, deptName(h.to_department_id)].filter(Boolean).join(" · ") || "—"}</td>
                  <td>{h.reason ?? "—"}</td>
                  <td>{h.created_by ? names.get(h.created_by) ?? "—" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا يوجد سجل" />}
      </Card>
    </>
  );
}

async function ScheduleTab({ ctx }: { ctx: HrTabContext }) {
  const dow = new Date(`${ctx.today}T00:00:00Z`).getUTCDay();
  const weekStart = addDays(ctx.today, -((dow + 1) % 7));
  const [roster, next] = await Promise.all([
    getRoster([{ ...ctx.employee }], weekStart),
    getRoster([{ ...ctx.employee }], addDays(weekStart, 7)),
  ]);
  const rows = [...roster.rows[0].days, ...next.rows[0].days];
  return (
    <Card title="جدول العمل — هذا الأسبوع والقادم" actions={<Link className="bos-link" href="/admin/team/schedules"><Tx>جدول الفريق</Tx></Link>}>
      <BosTable className="bos-table responsive">
        <thead><tr><th><Tx>اليوم</Tx></th><th><Tx>الجدول</Tx></th><th><Tx>الدوام</Tx></th><th><Tx>ملاحظة</Tx></th></tr></thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.date} style={d.date === ctx.today ? { background: "rgba(229,31,38,0.06)" } : undefined}>
              <td>{weekdayNames[new Date(`${d.date}T00:00:00Z`).getUTCDay()]} <span className="cell-sub">{formatDate(d.date)}</span></td>
              <td>{d.schedule?.name ?? "—"}{d.shift ? <span className="cell-sub"><Tx>وردية محددة</Tx></span> : null}</td>
              <td>{d.leave ? <StatusBadge tone="accent" label={d.leave} /> : d.holiday ? <StatusBadge tone="warning" label={d.holiday} /> : d.dayOff ? <StatusBadge tone="neutral" label={`راحة: ${d.dayOff}`} /> : d.working ? `${d.start} – ${d.end}` : <span className="bos-faint"><Tx>يوم راحة</Tx></span>}</td>
              <td><Tx>{d.schedule?.type === "flexible" ? "دوام مرن" : ""}</Tx></td>
            </tr>
          ))}
        </tbody>
      </BosTable>
    </Card>
  );
}

async function PayrollTab({ ctx }: { ctx: HrTabContext }) {
  const canHr = all(ctx.bos, "payroll.read");
  const canEdit = all(ctx.bos, "payroll.update");
  const [comp, components, catalog, currencies, slips] = await Promise.all([
    listCompensation(ctx.employee.id),
    listEmployeeComponents(ctx.employee.id),
    listSalaryComponents(),
    listCurrencies(),
    listPayslips({ employee: ctx.employee.id, publishedOnly: !canHr }),
  ]);
  const current = comp.find((c) => c.approval_status === "approved" && c.effective_from <= ctx.today) ?? null;
  const activeComponents = components.filter((c) => !c.effective_to || c.effective_to >= ctx.today);
  return (
    <>
      <div className="bos-grid cols-2" style={{ gap: 12 }}>
        <Card title="الراتب الحالي" actions={canEdit ? <CompensationButton employeeId={ctx.employee.id} currencies={currencies} hasSalary={comp.some((c) => c.approval_status === "approved")} /> : null}>
          {current ? (
            <KeyValues items={[
              { label: "الراتب الأساسي الشهري", value: <Money value={current.basic_salary} currency={current.currency} /> },
              { label: "ساري من", value: formatDate(current.effective_from) },
              { label: "نوع آخر تغيير", value: <StatusBadge map="compensation_change" value={current.change_type} /> },
            ]} />
          ) : <EmptyState title="لم يُحدد راتب بعد" />}
          {comp.some((c) => c.approval_status === "pending") ? <p className="bos-alert warning" style={{ marginTop: 8 }}><Tx>يوجد تعديل راتب بانتظار الاعتماد.</Tx></p> : null}
        </Card>
        <Card title="البدلات والاستقطاعات الثابتة" actions={canEdit ? <ComponentButton employeeId={ctx.employee.id} components={catalog.map((c) => ({ value: c.id, label: `${c.name}${c.calc_type === "percent_of_basic" ? " (%)" : ""}`, calc: c.calc_type }))} /> : null}>
          {activeComponents.length ? (
            <BosTable className="bos-table">
              <tbody>
                {activeComponents.map((c) => {
                  const def = c.salary_components as unknown as { name: string; kind: string; calc_type: string } | null;
                  return (
                    <tr key={c.id}>
                      <td>{def?.name}<span className="cell-sub">{def?.kind === "deduction" ? "استقطاع" : "استحقاق"} · من {formatDate(c.effective_from)}{c.effective_to ? ` حتى ${formatDate(c.effective_to)}` : ""}</span></td>
                      <td className="bos-num">{def?.calc_type === "percent_of_basic" ? `${c.amount}%` : <Money value={c.amount} currency={current?.currency ?? null} />}</td>
                      <td>{canEdit && !c.effective_to ? <EndComponentButton id={c.id} /> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </BosTable>
          ) : <EmptyState title="لا توجد بنود" />}
        </Card>
      </div>
      <Card title="سجل الرواتب">
        {comp.length ? (
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>ساري من</Tx></th><th><Tx>الأساسي</Tx></th><th><Tx>النوع</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>السبب</Tx></th></tr></thead>
            <tbody>{comp.map((c) => <tr key={c.id}><td>{formatDate(c.effective_from)}</td><td><Money value={c.basic_salary} currency={c.currency} /></td><td><StatusBadge map="compensation_change" value={c.change_type} /></td><td><StatusBadge map="simple_approval" value={c.approval_status} /></td><td>{c.reason ?? "—"}</td></tr>)}</tbody>
          </BosTable>
        ) : <EmptyState title="لا يوجد" />}
      </Card>
      <Card title="قسائم الرواتب">
        {slips.length ? (
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>الفترة</Tx></th><th><Tx>الإجمالي</Tx></th><th><Tx>الاستقطاعات</Tx></th><th><Tx>الصافي</Tx></th><th><Tx>الحالة</Tx></th><th /></tr></thead>
            <tbody>
              {slips.map((s) => (
                <tr key={s.id}>
                  <td>{(s.payroll_runs as unknown as { period_start: string }).period_start.slice(0, 7)}<span className="cell-sub">{statusLabel("payroll_run_type", (s.payroll_runs as unknown as { run_type: string }).run_type)}</span></td>
                  <td><Money value={s.gross_pay} currency={s.currency} /></td>
                  <td><Money value={s.total_deductions} currency={s.currency} /></td>
                  <td><strong><Money value={s.net_pay} currency={s.currency} /></strong></td>
                  <td><StatusBadge map="payslip_status" value={s.status} /></td>
                  <td><Link className="bos-link" href={`/admin/team/payroll/payslips/${s.id}`}><Tx>عرض / تحميل</Tx></Link></td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد قسائم" description={canHr ? undefined : "تظهر القسائم هنا بعد اعتماد ونشر الرواتب."} />}
      </Card>
    </>
  );
}

async function BonusesLoansTab({ ctx }: { ctx: HrTabContext }) {
  const [bonuses, loans, currencies] = await Promise.all([listBonuses({ employee: ctx.employee.id }), listLoans({ employee: ctx.employee.id }), listCurrencies()]);
  const period = ctx.today.slice(0, 7);
  const canBonus = all(ctx.bos, "payroll.create") || ctx.isManager;
  const canLoan = ctx.isSelf || all(ctx.bos, "payroll.create");
  const finance = all(ctx.bos, "payroll.approve") || all(ctx.bos, "payroll.manage");
  return (
    <>
      <Card title="المكافآت" actions={canBonus ? <BonusButton employees={[]} fixedEmployeeId={ctx.employee.id} currencies={currencies} defaultPeriod={period} /> : null}>
        {bonuses.length ? (
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>البيان</Tx></th><th><Tx>النوع</Tx></th><th><Tx>شهر الصرف</Tx></th><th><Tx>المبلغ</Tx></th><th><Tx>الحالة</Tx></th></tr></thead>
            <tbody>{bonuses.map((b) => <tr key={b.id}><td><Tx>{b.title}</Tx><span className="cell-sub">{b.reason}</span></td><td><StatusBadge map="bonus_type" value={b.bonus_type} /></td><td>{b.pay_period.slice(0, 7)}</td><td><Money value={b.amount} currency={b.currency} /></td><td><StatusBadge map="bonus_status" value={b.status} /></td></tr>)}</tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد مكافآت" />}
      </Card>
      <Card title="السلف والقروض" actions={canLoan && ["active", "on_leave", "onboarding"].includes(ctx.employee.lifecycle_status) ? <LoanButton employees={[]} fixedEmployeeId={ctx.employee.id} currencies={currencies} defaultPeriod={period} /> : null}>
        {loans.length ? loans.map((l) => (
          <div key={l.id} style={{ borderBottom: "1px solid var(--bos-border)", padding: "8px 0" }}>
            <div className="bos-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <span><strong><Tx>{l.loan_number}</Tx></strong> — <StatusBadge map="loan_type" value={l.loan_type} /> <Money value={l.amount} currency={l.currency} /> <Tx vars={{ installments: l.installments }}>{"/ {installments} قسط ·"}</Tx> <StatusBadge map="loan_status" value={l.status} /></span>
              <LoanSteps id={l.id} status={l.status} canFinance={finance} canCancel={ctx.isSelf || all(ctx.bos, "payroll.update")} />
            </div>
            <div style={{ marginTop: 6 }}><ProgressBar value={Number(l.amount) ? Math.round((l.paid / Number(l.amount)) * 100) : 0} tone="success" /><span className="cell-sub"><Tx vars={{ v: l.paid.toFixed(2), v2: l.remaining.toFixed(2), currency: l.currency }}>{"مسدد {v} · متبقي {v2} {currency}"}</Tx></span></div>
          </div>
        )) : <EmptyState title="لا توجد سلف أو قروض" />}
      </Card>
    </>
  );
}

async function ExpensesTab({ ctx }: { ctx: HrTabContext }) {
  const [claims, { data: categories }, currencies] = await Promise.all([
    listExpenseClaims({ userId: ctx.employee.user_id as string }),
    db().from("expense_categories").select("id, name").eq("is_active", true).order("name"),
    listCurrencies(),
  ]);
  return (
    <Card title="المصروفات والاسترداد" actions={ctx.isSelf || all(ctx.bos, "hr_requests.create") ? <ExpenseClaimButton employees={[]} fixedEmployeeId={ctx.employee.id} categories={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))} currencies={currencies} /> : null}>
      {claims.length ? (
        <BosTable className="bos-table responsive">
          <thead><tr><th><Tx>التاريخ</Tx></th><th><Tx>الوصف</Tx></th><th><Tx>المبلغ</Tx></th><th><Tx>الموافقة</Tx></th><th><Tx>الاسترداد</Tx></th><th><Tx>الإيصال</Tx></th></tr></thead>
          <tbody>
            {claims.map((e) => (
              <tr key={e.id}>
                <td>{formatDate(e.expense_date)}</td>
                <td><Tx>{e.description}</Tx><span className="cell-sub">{(e.expense_categories as { name: string } | null)?.name ?? ""}</span></td>
                <td><Money value={e.amount} currency={e.currency} /></td>
                <td><StatusBadge map="simple_approval" value={e.approval_status} /></td>
                <td><StatusBadge map="reimbursement_status" value={e.reimbursement_status} />{e.reimbursement_method ? <span className="cell-sub"><Tx>{e.reimbursement_method === "payroll" ? "مع الراتب" : "مباشر"}</Tx></span> : null}</td>
                <td><Link className="bos-link" href={`/admin/team/requests/expenses?open=${e.id}`}><Tx>الملفات</Tx></Link></td>
              </tr>
            ))}
          </tbody>
        </BosTable>
      ) : <EmptyState title="لا توجد مصروفات" />}
    </Card>
  );
}

async function OvertimeTab({ ctx }: { ctx: HrTabContext }) {
  const rows = await listOvertime([ctx.employee.user_id as string], { userId: ctx.employee.user_id as string });
  const canAdjust = all(ctx.bos, "overtime.update");
  return (
    <Card title="العمل الإضافي" actions={<Link className="bos-link" href="/admin/team/overtime"><Tx>صفحة العمل الإضافي</Tx></Link>}>
      {rows.length ? (
        <BosTable className="bos-table responsive">
          <thead><tr><th><Tx>التاريخ</Tx></th><th><Tx>نوع اليوم</Tx></th><th><Tx>الفعلي</Tx></th><th><Tx>المطلوب</Tx></th><th><Tx>المعتمد</Tx></th><th><Tx>المعامل</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>الصرف</Tx></th><th /></tr></thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <td>{formatDate(o.work_date)}<span className="cell-sub">{o.reason}</span></td>
                <td><StatusBadge map="overtime_day_type" value={o.day_type} /></td>
                <td>{o.actual_minutes != null ? formatMinutes(o.actual_minutes) : "—"}</td>
                <td>{formatMinutes(o.minutes)}</td>
                <td>{o.approved_minutes != null ? formatMinutes(o.approved_minutes) : "—"}</td>
                <td>{o.rate_multiplier ? `×${o.rate_multiplier}` : "—"}</td>
                <td><StatusBadge map="overtime_status" value={o.status} /></td>
                <td><StatusBadge map="compensation_status" value={o.compensation_status} />{o.amount != null && all(ctx.bos, "payroll.read") ? <span className="cell-sub"><Money value={o.amount} currency={o.currency} /></span> : null}</td>
                <td>{canAdjust && o.status === "approved" && !o.payslip_id ? <OvertimeMinutesButton id={o.id} minutes={o.approved_minutes ?? o.minutes} /> : null}</td>
              </tr>
            ))}
          </tbody>
        </BosTable>
      ) : <EmptyState title="لا يوجد عمل إضافي" />}
    </Card>
  );
}

async function RequestsTab({ ctx }: { ctx: HrTabContext }) {
  const [rows, types] = await Promise.all([listHrRequests({ employee: ctx.employee.id }), listRequestTypes()]);
  const canManage = all(ctx.bos, "hr_requests.update");
  return (
    <Card title="طلبات الموارد البشرية" actions={ctx.isSelf || all(ctx.bos, "hr_requests.create") ? <HrRequestButton employees={[]} fixedEmployeeId={ctx.employee.id} types={types.map((t) => ({ value: t.id, label: t.name }))} /> : null}>
      {rows.length ? (
        <BosTable className="bos-table responsive">
          <thead><tr><th><Tx>الرقم</Tx></th><th><Tx>النوع</Tx></th><th><Tx>الموضوع</Tx></th><th><Tx>التاريخ</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>الرد</Tx></th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Tx>{r.request_number}</Tx></td>
                <td>{(r.hr_request_types as { name: string } | null)?.name}</td>
                <td>{r.subject}{r.details ? <span className="cell-sub"><Tx>{r.details}</Tx></span> : null}</td>
                <td>{formatDate(r.created_at)}</td>
                <td><StatusBadge map="hr_request_status" value={r.status} /></td>
                <td><Tx>{r.response ?? "—"}</Tx></td>
                <td><HrRequestSteps id={r.id} status={r.status} canManage={canManage} isOwner={ctx.isSelf} /></td>
              </tr>
            ))}
          </tbody>
        </BosTable>
      ) : <EmptyState title="لا توجد طلبات" />}
    </Card>
  );
}

async function DocumentsTab({ ctx }: { ctx: HrTabContext }) {
  const hrAll = all(ctx.bos, "hr_documents.read");
  const [docs, types] = await Promise.all([
    listDocuments(hrAll ? null : [ctx.employee.id], { employee: ctx.employee.id }, ctx.today, { selfEmployeeId: ctx.isSelf ? ctx.employee.id : null, managerView: ctx.isManager }),
    listDocumentTypes(),
  ]);
  const canCreate = all(ctx.bos, "hr_documents.create") || ctx.isSelf;
  const uploadableTypes = all(ctx.bos, "hr_documents.create") ? types : types.filter((t) => t.employee_can_upload);
  return (
    <Card title="ملف الموظف — المستندات" actions={canCreate ? <NewDocumentButton employees={[]} fixedEmployeeId={ctx.employee.id} types={uploadableTypes.map((t) => ({ value: t.id, label: t.name, requires_expiry: t.requires_expiry }))} canConfidential={all(ctx.bos, "hr_documents.create")} /> : null}>
      {docs.length ? (
        <BosTable className="bos-table responsive">
          <thead><tr><th><Tx>المستند</Tx></th><th><Tx>النوع</Tx></th><th><Tx>الإصدار / الانتهاء</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>الملف</Tx></th><th /></tr></thead>
          <tbody>
            {docs.map((d) => {
              const t = d.document_types as unknown as { name: string; category: string; employee_can_upload: boolean } | null;
              const days = d.expiry_date ? daysUntil(d.expiry_date, ctx.today) : null;
              return (
                <tr key={d.id}>
                  <td className="cell-primary">{d.title}{d.document_number ? <span className="cell-sub" dir="ltr"><Tx>{d.document_number}</Tx></span> : null}{d.confidential ? <span className="bos-badge tone-danger plain"><Tx>سري</Tx></span> : null}</td>
                  <td>{t?.name}<span className="cell-sub">{statusLabel("document_category", t?.category)}</span></td>
                  <td>{formatDate(d.issue_date)} → {formatDate(d.expiry_date)}{d.expiry === "expiring" ? <span className="cell-sub" style={{ color: "var(--bos-warning)" }}><Tx vars={{ days }}>{"ينتهي خلال {days} يوم"}</Tx></span> : d.expiry === "expired" ? <span className="cell-sub bos-danger"><Tx>منتهي</Tx></span> : null}</td>
                  <td><StatusBadge map="document_status" value={d.status} />{d.rejection_reason ? <span className="cell-sub"><Tx>{d.rejection_reason}</Tx></span> : null}</td>
                  <td>{d.file ? <a className="bos-link" href={`/api/bos/files/${d.file.id}`} target="_blank" rel="noreferrer">{d.file.name} (v{d.file.version})</a> : <span className="bos-faint"><Tx>لا يوجد ملف</Tx></span>}</td>
                  <td><DocumentRowActions doc={{ ...d, hasFile: !!d.file }} canManage={all(ctx.bos, "hr_documents.update")} canVerify={all(ctx.bos, "hr_documents.approve")} canUpload={all(ctx.bos, "hr_documents.update") || (ctx.isSelf && !!t?.employee_can_upload && ["pending_verification", "rejected"].includes(d.status))} /></td>
                </tr>
              );
            })}
          </tbody>
        </BosTable>
      ) : <EmptyState title="لا توجد مستندات" description="السيرة الذاتية، العقود، الهوية، المؤهلات، المستندات البنكية والتأمينية…" />}
    </Card>
  );
}

async function ContractsTab({ ctx }: { ctx: HrTabContext }) {
  const hrAll = all(ctx.bos, "hr_documents.read");
  const [rows, currencies] = await Promise.all([listContracts(null, { employee: ctx.employee.id }, ctx.today), listCurrencies()]);
  const visible = hrAll ? rows : rows.filter((r) => r.status !== "draft");
  return (
    <Card title="العقود" actions={all(ctx.bos, "hr_documents.update") ? <NewContractButton employees={[]} currencies={currencies} fixedEmployeeId={ctx.employee.id} /> : null}>
      {visible.length ? (
        <BosTable className="bos-table responsive">
          <thead><tr><th><Tx>العقد</Tx></th><th><Tx>النوع</Tx></th><th><Tx>النسخة</Tx></th><th><Tx>البداية</Tx></th><th><Tx>النهاية</Tx></th><th><Tx>التوقيع</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>الملف</Tx></th></tr></thead>
          <tbody>
            {visible.map((k) => (
              <tr key={k.id}>
                <td className="cell-primary"><Link href={`/admin/team/documents/contracts/${k.id}`}><Tx>{k.title}</Tx></Link><span className="cell-sub">{k.contract_number}</span></td>
                <td><StatusBadge map="employee_contract_type" value={k.contract_type} /></td>
                <td>v{k.version}</td>
                <td>{formatDate(k.start_date)}</td>
                <td>{formatDate(k.end_date)}{k.expiry === "expiring" ? <span className="cell-sub" style={{ color: "var(--bos-warning)" }}><Tx>ينتهي قريباً</Tx></span> : null}</td>
                <td><StatusBadge map="signature_status" value={k.signature_status} /></td>
                <td><StatusBadge map="employee_contract_status" value={k.status} /></td>
                <td>{k.file ? <a className="bos-link" href={`/api/bos/files/${k.file.id}`} target="_blank" rel="noreferrer">v{k.file.version}</a> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </BosTable>
      ) : <EmptyState title="لا توجد عقود" />}
    </Card>
  );
}

async function GoalsTab({ ctx }: { ctx: HrTabContext }) {
  const uid = ctx.employee.user_id as string;
  const canManage = ctx.isManager || all(ctx.bos, "performance.update");
  const revealAuthors = all(ctx.bos, "performance.manage");
  const [goals, feedback, cycles, { data: kpis }, names, { data: people }] = await Promise.all([
    listGoals({ userId: uid }),
    ctx.isSelf || canManage ? listFeedback({ subjectUserId: uid, status: "submitted" }, revealAuthors) : Promise.resolve([]),
    listCycles(),
    db().from("kpis").select("id, name").eq("is_active", true).order("name"),
    userNameMap(),
    canManage ? db().from("employees").select("user_id, full_name").not("user_id", "is", null).in("lifecycle_status", ["active", "on_leave", "onboarding"]).order("full_name") : Promise.resolve({ data: [] as { user_id: string | null; full_name: string }[] }),
  ]);
  const cycleOpts = cycles.map((c) => ({ value: c.id, label: c.name }));
  return (
    <>
      <Card title="الأهداف" actions={canManage || ctx.isSelf ? <GoalButton users={[]} fixedUserId={uid} kpis={(kpis ?? []).map((k) => ({ value: k.id, label: k.name }))} cycles={cycleOpts} /> : null}>
        {goals.length ? (
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>الهدف</Tx></th><th><Tx>المستهدف</Tx></th><th><Tx>التقدم</Tx></th><th><Tx>الاستحقاق</Tx></th><th><Tx>الحالة</Tx></th><th /></tr></thead>
            <tbody>
              {goals.map((g) => (
                <tr key={g.id}>
                  <td className="cell-primary"><Tx>{g.title}</Tx><span className="cell-sub">{[g.metric, (g.kpis as { name: string } | null)?.name, (g.review_cycles as { name: string } | null)?.name].filter(Boolean).join(" · ")}</span></td>
                  <td>{g.target_value != null ? `${g.current_value ?? 0} / ${g.target_value} ${g.unit ?? ""}` : "—"}</td>
                  <td style={{ minWidth: 110 }}><ProgressBar value={g.progress} tone={g.status === "completed" ? "success" : g.status === "at_risk" || g.status === "off_track" ? "warning" : undefined} /><span className="cell-sub">{g.progress}%</span></td>
                  <td>{formatDate(g.due_date)}</td>
                  <td><StatusBadge map="goal_status" value={g.status} /></td>
                  <td>{canManage || ctx.isSelf ? <span className="bos-row" style={{ gap: 4 }}><GoalProgressButton goal={g} /><GoalButton users={[]} kpis={(kpis ?? []).map((k) => ({ value: k.id, label: k.name }))} cycles={cycleOpts} initial={g as unknown as Record<string, string | number | null>} /></span> : null}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد أهداف" />}
      </Card>
      {ctx.isSelf || canManage ? (
        <Card title="تقييم 360" actions={canManage ? <RequestFeedbackButton subjectUserId={uid} people={(people ?? []).map((p) => ({ value: p.user_id as string, label: p.full_name }))} cycles={cycleOpts} /> : null}>
          {feedback.length ? feedback.map((f) => (
            <div key={f.id} style={{ borderBottom: "1px solid var(--bos-border)", padding: "8px 0", fontSize: 13 }}>
              <strong><Tx>{f.from_user_id ? names.get(f.from_user_id) ?? "—" : "مجهول"}</Tx></strong> · {statusLabel("feedback_relationship", f.relationship)}{f.rating ? ` · ${f.rating}/5` : ""}
              {f.strengths ? <div><span className="bos-faint"><Tx>نقاط القوة:</Tx> </span><Tx>{f.strengths}</Tx></div> : null}
              {f.improvements ? <div><span className="bos-faint"><Tx>فرص التحسين:</Tx> </span><Tx>{f.improvements}</Tx></div> : null}
              {f.comments ? <div className="bos-faint"><Tx>{f.comments}</Tx></div> : null}
            </div>
          )) : <EmptyState title="لا يوجد تقييم 360 بعد" />}
        </Card>
      ) : null}
    </>
  );
}
