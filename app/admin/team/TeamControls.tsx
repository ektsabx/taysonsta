"use client";
import { BosTable } from "@/components/bos/BosTable";
import { DateRangeFormField } from "@/components/bos/DateRangeField";

import { Tx, Opt, useT } from "@/components/bos/I18n";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionButton, ConfirmButton, ModalButton } from "@/components/bos/Dialog";
import { ActionForm, CheckboxField, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import {
  addGrantAction,
  assignDeviceAction,
  cancelLeaveAction,
  changeLifecycleAction,
  confirmReceiptAction,
  createLoginAction,
  hrEditSessionAction,
  regenerateChecklistAction,
  refreshOnboardingAction,
  requestAccessAction,
  requestCorrectionAction,
  requestLeaveAction,
  requestOvertimeAction,
  returnDeviceAction,
  saveCompanyAccountAction,
  saveManualKpiValueAction,
  saveReviewAction,
  acknowledgeReviewAction,
  securityCheckAction,
  setAccessStatusAction,
  setKpiAssignmentAction,
  setLoginDisabledAction,
  setMfaStatusAction,
  setOvertimeCompensationAction,
  syncMfaAction,
  toggleEmployeeChecklistItemAction,
} from "./actions";

type Opt = { value: string; label: string };

const lifecycleLabels: Record<string, string> = {
  hired: "تم التعيين",
  pending_onboarding: "بدء التهيئة",
  onboarding: "قيد التهيئة",
  active: "تفعيل",
  on_leave: "في إجازة",
  suspended: "إيقاف",
  offboarding: "بدء إنهاء الخدمة",
  terminated: "إنهاء الخدمة نهائياً",
  archived: "أرشفة",
};
const needsReason = new Set(["suspended", "terminated", "archived"]);

// Resignation / termination starts offboarding with its separation details (docs/bos/28 §24).
function OffboardingButton({ employeeId }: { employeeId: string }) {
  const [type, setType] = useState("resignation");
  const [notice, setNotice] = useState("");
  const [lastDay, setLastDay] = useState("");
  const [reason, setReason] = useState("");
  return (
    <ModalButton label="بدء إنهاء الخدمة" title="استقالة / إنهاء خدمة" className="admin-btn small danger">
      {(close) => (
        <div className="bos-stack">
          <p className="bos-faint" style={{ fontSize: 12.5 }}><Tx>سيتم إنشاء قائمة إنهاء الخدمة (سحب الحسابات والصلاحيات، استرجاع الأجهزة والأصول، التسوية المالية، مقابلة الخروج، الموافقة النهائية).</Tx></p>
          <div className="bos-form-grid">
            <div className="bos-field"><label htmlFor="sep-type"><Tx>النوع *</Tx></label><select id="sep-type" value={type} onChange={(e) => setType(e.target.value)}><Opt value="resignation">استقالة</Opt><Opt value="termination">إنهاء خدمة</Opt><Opt value="end_of_contract">انتهاء العقد</Opt><Opt value="retirement">تقاعد</Opt><Opt value="mutual">اتفاق متبادل</Opt><Opt value="other">أخرى</Opt></select></div>
            <div className="bos-field"><label htmlFor="sep-notice"><Tx>تاريخ الإخطار</Tx></label><input id="sep-notice" type="date" value={notice} onChange={(e) => setNotice(e.target.value)} /></div>
            <div className="bos-field"><label htmlFor="sep-last"><Tx>آخر يوم عمل</Tx></label><input id="sep-last" type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} /></div>
          </div>
          <div className="bos-field"><label htmlFor="sep-reason"><Tx>السبب *</Tx></label><textarea id="sep-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <ActionButton label="تأكيد بدء إنهاء الخدمة" className="admin-btn small danger" action={async () => { const r = await changeLifecycleAction(employeeId, "offboarding", reason, { separation_type: type, notice_date: notice || null, last_working_day: lastDay || null }); if (r.ok) close(); return r; }} />
        </div>
      )}
    </ModalButton>
  );
}

export function LifecycleControls({ employeeId, transitions, canRestore }: { employeeId: string; transitions: string[]; canRestore: boolean }) {
  return (
    <>
      {transitions.map((to) =>
        to === "offboarding" ? (
          <OffboardingButton key={to} employeeId={employeeId} />
        ) : needsReason.has(to) ? (
          <ConfirmButton
            key={to}
            label={lifecycleLabels[to] ?? to}
            className={`admin-btn small ${to === "active" ? "success" : "danger"}`}
            message={
              to === "suspended"
                ? "إيقاف الموظف يمنع دخوله للنظام فوراً ويضع صلاحياته الخارجية للمراجعة."
                : to === "terminated"
                  ? "يتطلب اكتمال قائمة إنهاء الخدمة (بما فيها الموافقة النهائية) واسترجاع الأجهزة وسحب الصلاحيات. يُحظر الدخول وتُنهى العقود السارية مع الاحتفاظ بكل السجلات."
                  : "الأرشفة تخفي الموظف من القوائم مع الاحتفاظ بكل بياناته وسجله."
            }
            requireReason
            confirmLabel="تأكيد"
            action={(reason) => changeLifecycleAction(employeeId, to, reason)}
          />
        ) : (
          <ActionButton key={to} label={lifecycleLabels[to] ?? to} className={`admin-btn small ${to === "active" ? "success" : "secondary"}`} action={() => changeLifecycleAction(employeeId, to)} />
        ),
      )}
      {canRestore ? <ConfirmButton label="استعادة (مدير عام)" className="admin-btn small secondary" message="استعادة موظف مؤرشف تعيده نشطاً وتفك حظر الدخول." requireReason action={(reason) => changeLifecycleAction(employeeId, "active", reason)} /> : null}
    </>
  );
}

export function LoginControls({ employeeId, hasLogin, disabled }: { employeeId: string; hasLogin: boolean; disabled: boolean }) {
  if (!hasLogin) return <ActionButton label="إنشاء حساب دخول" className="admin-btn small" action={() => createLoginAction(employeeId)} />;
  return disabled ? (
    <ActionButton label="تفعيل الدخول" className="admin-btn small secondary" action={() => setLoginDisabledAction(employeeId, false)} />
  ) : (
    <ConfirmButton label="تعطيل الدخول" className="admin-btn small danger" message="سيتم إنهاء جلسات الموظف ومنع دخوله للنظام." action={() => setLoginDisabledAction(employeeId, true)} />
  );
}

// ---------------------------------------------------------------------------
// Checklists
// ---------------------------------------------------------------------------

export function ChecklistToggle({ employeeId, itemId, done, disabled, title }: { employeeId: string; itemId: string; done: boolean; disabled?: boolean; title?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <span>
      <input
        type="checkbox"
        checked={done}
        disabled={disabled || pending}
        title={title}
        onChange={(e) => {
          const next = e.target.checked;
          setError(null);
          start(async () => {
            const r = await toggleEmployeeChecklistItemAction(employeeId, itemId, next);
            if (!r.ok) setError(r.error);
            router.refresh();
          });
        }}
      />
      {error ? <span className="bos-field-error" style={{ display: "block", fontSize: 11.5 }}><Tx>{error}</Tx></span> : null}
    </span>
  );
}

export function RefreshOnboardingButton({ employeeId }: { employeeId: string }) {
  return <ActionButton label="تحديث البنود التلقائية" className="admin-btn small ghost" action={() => refreshOnboardingAction(employeeId)} />;
}

// ---------------------------------------------------------------------------
// Access profile
// ---------------------------------------------------------------------------

const accessNext: Record<string, string[]> = {
  not_started: ["requested", "pending", "provisioned", "active", "rejected", "revoked"],
  requested: ["pending", "provisioned", "active", "rejected", "revoked"],
  pending: ["provisioned", "active", "rejected", "revoked"],
  provisioned: ["active", "rejected", "revoked"],
  active: ["expired", "revoked"],
  rejected: ["requested", "not_started"],
  revoked: ["requested", "not_started"],
  expired: ["requested", "active", "revoked"],
};
const accessLabels: Record<string, string> = { not_started: "لم يبدأ", requested: "مطلوب", pending: "قيد التنفيذ", provisioned: "تم التجهيز", active: "نشط", rejected: "مرفوض", revoked: "مسحوب", expired: "منتهي" };

export function AccessStatusSelect({ employeeId, grantId, status, level, levels }: { employeeId: string; grantId: string; status: string; level: string | null; levels: string[] }) {
  const t = useT();
  const [pending, start] = useTransition();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError((r as { error: string }).error);
      router.refresh();
    });
  return (
    <span className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}>
      <select aria-label={t("الحالة")} value={status} disabled={pending} onChange={(e) => run(() => setAccessStatusAction(employeeId, grantId, e.target.value))}>
        <Opt value={status}>{accessLabels[status] ?? status}</Opt>
        {(accessNext[status] ?? []).map((s) => <Opt key={s} value={s}>{accessLabels[s] ?? s}</Opt>)}
      </select>
      {levels.length ? (
        <select aria-label={t("مستوى الوصول")} value={level ?? ""} disabled={pending} onChange={(e) => run(() => setAccessStatusAction(employeeId, grantId, status, e.target.value))}>
          <Opt value="">— المستوى —</Opt>
          {levels.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      ) : null}
      {error ? <span className="bos-field-error" style={{ fontSize: 11.5 }}><Tx>{error}</Tx></span> : null}
    </span>
  );
}

export function AddGrantButton({ employeeId, apps }: { employeeId: string; apps: { id: string; name: string; access_levels: string[] }[] }) {
  const [app, setApp] = useState("");
  const levels = apps.find((a) => a.id === app)?.access_levels ?? [];
  return (
    <ModalButton label="+ تطبيق" title="إضافة تطبيق لملف الصلاحيات" className="admin-btn small secondary">
      {(close) => (
        <ActionForm action={addGrantAction} onSuccess={close}>
          <input type="hidden" name="employee_id" value={employeeId} />
          <SelectField name="app_id" label="التطبيق" required placeholder="اختر..." options={apps.map((a) => ({ value: a.id, label: a.name }))} value={app} onChange={(e) => setApp(e.target.value)} />
          {levels.length ? <SelectField name="access_level" label="مستوى الوصول" placeholder="—" options={levels.map((l) => ({ value: l, label: l }))} /> : null}
          <CheckboxField name="is_required" label="مطلوب لهذا الموظف" />
          <div className="bos-form-actions"><SubmitButton label="إضافة" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function RequestAccessButton({ employeeId, apps, label = "طلب وصول" }: { employeeId: string; apps: { id: string; name: string; access_levels: string[]; is_sensitive: boolean }[]; label?: string }) {
  const [app, setApp] = useState("");
  const selected = apps.find((a) => a.id === app);
  return (
    <ModalButton label={label} title="طلب وصول إضافي" className="admin-btn small secondary">
      {(close) => (
        <ActionForm action={requestAccessAction} onSuccess={close}>
          <input type="hidden" name="employee_id" value={employeeId} />
          <SelectField name="app_id" label="التطبيق" required placeholder="اختر..." options={apps.map((a) => ({ value: a.id, label: `${a.name}${a.is_sensitive ? " (حساس)" : ""}` }))} value={app} onChange={(e) => setApp(e.target.value)} />
          {selected?.access_levels.length ? <SelectField name="access_level" label="مستوى الصلاحية المطلوب" placeholder="—" options={selected.access_levels.map((l) => ({ value: l, label: l }))} /> : null}
          <TextAreaField name="reason" label="السبب" required rows={3} />
          <p className="bos-faint" style={{ fontSize: 12 }}><Tx>{selected?.is_sensitive ? "تطبيق حساس: موافقة المدير ثم موافقة الأمان/الإدارة." : "موافقة المدير ثم موافقة الإدارة/IT."}</Tx></p>
          <div className="bos-form-actions"><SubmitButton label="إرسال الطلب" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function RegenerateAccessButton({ employeeId }: { employeeId: string }) {
  return <ActionButton label="إعادة توليد القائمة من الأدوار" className="admin-btn small ghost" action={() => regenerateChecklistAction(employeeId)} />;
}

const mfaOptions: Opt[] = [
  { value: "required", label: "مطلوب" },
  { value: "not_configured", label: "غير مفعّل" },
  { value: "pending", label: "قيد الإعداد" },
  { value: "enabled", label: "مفعّل" },
  { value: "disabled", label: "معطّل" },
  { value: "recovery_required", label: "يتطلب استرداد" },
];

export function MfaControls({ employeeId, status, canManage }: { employeeId: string; status: string; canManage: boolean }) {
  const t = useT();
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <span className="bos-row" style={{ gap: 6 }}>
      {canManage ? (
        <select aria-label={t("حالة 2FA")} value={status} disabled={pending} onChange={(e) => start(async () => { await setMfaStatusAction(employeeId, e.target.value); router.refresh(); })}>
          {mfaOptions.map((o) => <Opt key={o.value} value={o.value}>{o.label}</Opt>)}
        </select>
      ) : null}
      <ActionButton label="مزامنة من حساب الدخول" className="admin-btn small ghost" action={() => syncMfaAction(employeeId)} />
    </span>
  );
}

export interface CompanyAccountValues {
  id?: string;
  employee_id?: string;
  app_id?: string | null;
  account_type?: string;
  provider?: string;
  identifier?: string;
  status?: string;
  owner_user_id?: string | null;
  recovery_owner_user_id?: string | null;
  mfa_status?: string;
  mfa_method?: string | null;
  last_reviewed_at?: string | null;
  notes?: string | null;
}

export function CompanyAccountButton({ initial = {}, employees, apps, staff, label = "+ حساب" }: { initial?: CompanyAccountValues; employees: Opt[]; apps: Opt[]; staff: Opt[]; label?: string }) {
  return (
    <ModalButton label={label} title={initial.id ? "تعديل حساب الشركة" : "حساب شركة جديد"} className={initial.id ? "admin-btn small ghost" : "admin-btn small secondary"} wide>
      {(close) => (
        <ActionForm action={saveCompanyAccountAction.bind(null, initial.id ?? null)} onSuccess={close}>
          <div className="bos-alert warning"><Tx>لا تُدخل كلمات مرور أو رموز استرداد أو أسرار هنا أبداً — مدير كلمات المرور هو المكان الوحيد لها.</Tx></div>
          <div className="bos-form-grid">
            {initial.employee_id && employees.length <= 1 ? <input type="hidden" name="employee_id" value={initial.employee_id} /> : <SelectField name="employee_id" label="الموظف" required placeholder="اختر..." options={employees} defaultValue={initial.employee_id ?? ""} />}
            <SelectField name="account_type" label="نوع الحساب" options={[{ value: "email", label: "بريد" }, { value: "sso", label: "SSO" }, { value: "app", label: "تطبيق" }, { value: "other", label: "أخرى" }]} defaultValue={initial.account_type ?? "app"} />
            <SelectField name="app_id" label="التطبيق" placeholder="—" options={apps} defaultValue={initial.app_id ?? ""} />
            <TextField name="provider" label="المزوّد" required defaultValue={initial.provider ?? ""} />
            <TextField name="identifier" label="معرّف الحساب (بريد/اسم مستخدم)" required dir="ltr" defaultValue={initial.identifier ?? ""} />
            <SelectField name="status" label="الحالة" options={Object.entries(accessLabels).map(([value, l]) => ({ value, label: l }))} defaultValue={initial.status ?? "not_started"} />
            <SelectField name="owner_user_id" label="المالك" placeholder="—" options={staff} defaultValue={initial.owner_user_id ?? ""} />
            <SelectField name="recovery_owner_user_id" label="مسؤول الاسترداد" placeholder="—" options={staff} defaultValue={initial.recovery_owner_user_id ?? ""} />
            <SelectField name="mfa_status" label="حالة 2FA" options={mfaOptions} defaultValue={initial.mfa_status ?? "required"} />
            <TextField name="mfa_method" label="طريقة 2FA" placeholder="Authenticator App" defaultValue={initial.mfa_method ?? ""} />
            <TextField name="last_reviewed_at" label="آخر مراجعة" type="date" defaultValue={initial.last_reviewed_at?.slice(0, 10) ?? ""} />
            <TextAreaField name="notes" label="ملاحظات" defaultValue={initial.notes ?? ""} rows={2} />
          </div>
          <div className="bos-form-actions"><SubmitButton label="حفظ" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

// ---------------------------------------------------------------------------
// Leave, corrections, overtime, HR edits
// ---------------------------------------------------------------------------

export function LeaveRequestButton({ types, forUsers, label = "+ طلب إجازة" }: { types: Opt[]; forUsers?: Opt[]; label?: string }) {
  const [half, setHalf] = useState(false);
  return (
    <ModalButton label={label} title="طلب إجازة" className="admin-btn small">
      {(close) => (
        <ActionForm action={requestLeaveAction} onSuccess={close}>
          <div className="bos-form-grid">
            {forUsers?.length ? <SelectField name="user_id" label="الموظف" placeholder="أنا" options={forUsers} /> : null}
            <SelectField name="leave_type_id" label="نوع الإجازة" required placeholder="اختر..." options={types} />
            <DateRangeFormField label={half ? "اليوم" : "الفترة"} fromName="start_date" toName="end_date" required singleDay={half} />
          </div>
          <label className="bos-check"><input type="checkbox" name="half_day" checked={half} onChange={(e) => setHalf(e.target.checked)} /> <Tx>نصف يوم</Tx></label>
          <TextAreaField name="reason" label="السبب" rows={3} hint="مطلوب للإجازات المرضية والشخصية وغير المدفوعة" />
          <p className="bos-faint" style={{ fontSize: 12 }}><Tx>المدة تُحسب بأيام العمل فقط وتستثني العطلات الرسمية.</Tx></p>
          <div className="bos-form-actions"><SubmitButton label="إرسال الطلب" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function CancelLeaveButton({ id }: { id: string }) {
  return <ConfirmButton label="إلغاء" className="admin-btn small ghost" message="إلغاء طلب الإجازة؟ إذا كانت معتمدة سيتم التراجع عن أثرها على الحضور." requireReason={false} action={(reason) => cancelLeaveAction(id, reason)} />;
}

export function CorrectionButton({ workDate, sessions, label = "طلب تصحيح" }: { workDate?: string; sessions?: Opt[]; label?: string }) {
  return (
    <ModalButton label={label} title="طلب تصحيح الحضور" className="admin-btn small secondary">
      {(close) => (
        <ActionForm action={requestCorrectionAction} onSuccess={close}>
          <div className="bos-form-grid">
            <TextField name="work_date" label="يوم العمل" type="date" required defaultValue={workDate ?? ""} />
            {sessions?.length ? <SelectField name="session_id" label="الجلسة المراد تصحيحها" placeholder="جلسة جديدة" options={sessions} /> : null}
            <TextField name="clock_in_time" label="وقت الدخول الصحيح" type="time" />
            <TextField name="clock_out_time" label="وقت الخروج الصحيح" type="time" />
          </div>
          <CheckboxField name="clock_out_next_day" label="الخروج في اليوم التالي (بعد منتصف الليل)" />
          <TextAreaField name="reason" label="السبب" required rows={3} placeholder="مثال: نسيت تسجيل الخروج" />
          <p className="bos-faint" style={{ fontSize: 12 }}><Tx>الأوقات بتوقيت جدول عملك. يُرسل الطلب لمديرك، ويُسجل الأصل والتعديل في سجل التدقيق.</Tx></p>
          <div className="bos-form-actions"><SubmitButton label="إرسال" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function HrEditButton({ userId, workDate, sessions, label = "تعديل (HR)" }: { userId: string; workDate?: string; sessions?: Opt[]; label?: string }) {
  return (
    <ModalButton label={label} title="تعديل مباشر للحضور (الموارد البشرية)" className="admin-btn small ghost">
      {(close) => (
        <ActionForm action={hrEditSessionAction} onSuccess={close}>
          <input type="hidden" name="user_id" value={userId} />
          <div className="bos-form-grid">
            <TextField name="work_date" label="يوم العمل" type="date" required defaultValue={workDate ?? ""} />
            {sessions?.length ? <SelectField name="session_id" label="الجلسة" placeholder="جلسة جديدة" options={sessions} /> : null}
            <TextField name="clock_in_time" label="الدخول" type="time" required />
            <TextField name="clock_out_time" label="الخروج" type="time" />
          </div>
          <CheckboxField name="clock_out_next_day" label="الخروج في اليوم التالي" />
          <TextAreaField name="reason" label="السبب (إلزامي — يُسجل في التدقيق)" required rows={2} />
          <div className="bos-form-actions"><SubmitButton label="حفظ التعديل" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function OvertimeButton({ label = "+ طلب عمل إضافي" }: { label?: string }) {
  return (
    <ModalButton label={label} title="طلب عمل إضافي" className="admin-btn small secondary">
      {(close) => (
        <ActionForm action={requestOvertimeAction} onSuccess={close}>
          <div className="bos-form-grid">
            <TextField name="work_date" label="التاريخ" type="date" required />
            <TextField name="hours" label="الساعات" type="number" step="0.25" min="0.25" max="16" required />
          </div>
          <TextAreaField name="reason" label="السبب" required rows={3} />
          <div className="bos-form-actions"><SubmitButton label="إرسال" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function CompensationSelect({ id, status }: { id: string; status: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <select aria-label={t("التعويض")} value={status} disabled={pending} onChange={(e) => start(async () => { await setOvertimeCompensationAction(id, e.target.value); router.refresh(); })}>
      <Opt value="pending">بانتظار التعويض</Opt>
      <Opt value="paid">مدفوع</Opt>
      <Opt value="time_off">إجازة تعويضية</Opt>
      <Opt value="not_applicable">لا ينطبق</Opt>
    </select>
  );
}

// ---------------------------------------------------------------------------
// KPIs & reviews
// ---------------------------------------------------------------------------

export function KpiAssignToggle({ kpiId, userId, assigned }: { kpiId: string; userId: string; assigned: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return <input type="checkbox" checked={assigned} disabled={pending} onChange={(e) => start(async () => { await setKpiAssignmentAction(kpiId, userId, e.target.checked); router.refresh(); })} />;
}

export function ManualKpiButton({ kpiId, userId, date }: { kpiId: string; userId: string; date: string }) {
  return (
    <ModalButton label="إدخال قيمة" title="قيمة يدوية للمؤشر" className="admin-btn small ghost">
      {(close) => (
        <ActionForm action={saveManualKpiValueAction} onSuccess={close}>
          <input type="hidden" name="kpi_id" value={kpiId} />
          <input type="hidden" name="user_id" value={userId} />
          <input type="hidden" name="date" value={date} />
          <TextField name="actual" label="القيمة الفعلية" required inputMode="decimal" />
          <TextAreaField name="note" label="ملاحظة" rows={2} />
          <div className="bos-form-actions"><SubmitButton label="حفظ" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

const competencyNames = ["جودة العمل", "الإنتاجية", "التواصل", "العمل الجماعي", "المبادرة والمسؤولية"];

type ReviewValues = { id: string; period_start: string; period_end: string; summary: string | null; strengths: string | null; improvements: string | null; goals: string | null; cycle_id?: string | null; review_type?: string; overall_rating?: number | null; manager_rating?: number | null; recommendation?: string; competencies?: unknown; self_assessment?: string | null; self_rating?: number | null };

export function ReviewButton({ userId, review, label = "+ مراجعة أداء", defaults, cycles = [] }: { userId: string; review?: ReviewValues; label?: string; defaults: { start: string; end: string }; cycles?: Opt[] }) {
  const t = useT();
  const initialComp = Array.isArray(review?.competencies) ? (review?.competencies as { name: string; rating: number | null; comment: string | null }[]) : [];
  const [comp, setComp] = useState(competencyNames.map((name) => initialComp.find((c) => c.name === name) ?? { name, rating: null as number | null, comment: null as string | null }));
  const ratingOpts = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} / 5` }));
  return (
    <ModalButton label={label} title="مراجعة أداء" className="admin-btn small secondary" wide>
      {(close) => (
        <ActionForm action={saveReviewAction.bind(null, userId, review?.id ?? null)} onSuccess={close}>
          <input type="hidden" name="competencies" value={JSON.stringify(comp)} />
          <div className="bos-form-grid">
            <TextField name="period_start" label="من" type="date" required defaultValue={review?.period_start ?? defaults.start} />
            <TextField name="period_end" label="إلى" type="date" required defaultValue={review?.period_end ?? defaults.end} />
            <SelectField name="review_type" label="نوع المراجعة" defaultValue={review?.review_type ?? "periodic"} options={[{ value: "periodic", label: "دورية" }, { value: "annual", label: "سنوية" }, { value: "probation", label: "نهاية فترة الاختبار" }, { value: "ad_hoc", label: "خاصة" }]} />
            {cycles.length ? <SelectField name="cycle_id" label="دورة التقييم" placeholder="—" options={cycles} defaultValue={review?.cycle_id ?? ""} /> : null}
          </div>
          {review?.self_assessment ? (
            <div className="bos-alert" style={{ background: "rgba(var(--bos-fg-rgb), 0.03)" }}><strong>التقييم الذاتي{review.self_rating ? ` (${review.self_rating}/5)` : ""}:</strong><div className="bos-prose" style={{ fontSize: 13 }}><Tx>{review.self_assessment}</Tx></div></div>
          ) : null}
          <div className="bos-table-scroll">
            <BosTable className="bos-table">
              <thead><tr><th><Tx>الكفاءة</Tx></th><th><Tx>التقييم</Tx></th><th><Tx>تعليق</Tx></th></tr></thead>
              <tbody>
                {comp.map((c, i) => (
                  <tr key={c.name}>
                    <td>{c.name}</td>
                    <td><select aria-label={c.name} value={c.rating ?? ""} onChange={(e) => setComp(comp.map((x, j) => (j === i ? { ...x, rating: e.target.value ? Number(e.target.value) : null } : x)))}><option value="">—</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></td>
                    <td><input aria-label={t("تعليق")} value={c.comment ?? ""} onChange={(e) => setComp(comp.map((x, j) => (j === i ? { ...x, comment: e.target.value || null } : x)))} /></td>
                  </tr>
                ))}
              </tbody>
            </BosTable>
          </div>
          <TextAreaField name="summary" label="الملخص وملاحظات المدير" rows={3} defaultValue={review?.summary ?? ""} />
          <TextAreaField name="strengths" label="نقاط القوة" rows={2} defaultValue={review?.strengths ?? ""} />
          <TextAreaField name="improvements" label="مجالات التحسين" rows={2} defaultValue={review?.improvements ?? ""} />
          <TextAreaField name="goals" label="الأهداف القادمة" rows={2} defaultValue={review?.goals ?? ""} />
          <div className="bos-form-grid">
            <SelectField name="manager_rating" label="تقييم المدير" placeholder="—" options={ratingOpts} defaultValue={review?.manager_rating ? String(review.manager_rating) : ""} />
            <SelectField name="overall_rating" label="التقييم النهائي" placeholder="—" options={ratingOpts} defaultValue={review?.overall_rating ? String(review.overall_rating) : ""} />
            <SelectField name="recommendation" label="التوصية" defaultValue={review?.recommendation ?? "none"} options={[{ value: "none", label: "لا يوجد" }, { value: "promotion", label: "ترقية" }, { value: "salary_increase", label: "زيادة راتب" }, { value: "bonus", label: "مكافأة" }, { value: "pip", label: "خطة تحسين أداء" }, { value: "confirm_probation", label: "تثبيت بعد الاختبار" }, { value: "extend_probation", label: "تمديد الاختبار" }, { value: "termination", label: "إنهاء الخدمة" }]} />
          </div>
          <CheckboxField name="submit" label="إرسال للموظف (لا يمكن التعديل بعد الإرسال)" />
          <p className="bos-faint" style={{ fontSize: 12 }}><Tx>المراجعة تستند لنتائج المؤشرات والأهداف وتقييم 360 — الترقية أو تعديل الراتب يتمان من تبويب «التوظيف والسجل» / «الرواتب».</Tx></p>
          <div className="bos-form-actions"><SubmitButton label="حفظ" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function AcknowledgeReviewButton({ id }: { id: string }) {
  return <ActionButton label="تأكيد الاطلاع" className="admin-btn small" action={() => acknowledgeReviewAction(id)} />;
}

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

export function AssignDeviceButton({ deviceId, employees }: { deviceId: string; employees: Opt[] }) {
  return (
    <ModalButton label="تسليم لموظف" title="تسليم الجهاز" className="admin-btn small">
      {(close) => (
        <ActionForm action={assignDeviceAction.bind(null, deviceId)} onSuccess={close}>
          <SelectField name="employee_id" label="الموظف" required placeholder="اختر..." options={employees} />
          <SelectField name="condition" label="حالة الجهاز عند التسليم" options={[{ value: "new", label: "جديد" }, { value: "good", label: "جيد" }, { value: "fair", label: "مقبول" }, { value: "poor", label: "ضعيف" }]} defaultValue="good" />
          <div className="bos-form-actions"><SubmitButton label="تسليم" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function ReturnDeviceButton({ deviceId }: { deviceId: string }) {
  return (
    <ModalButton label="تسجيل الاسترجاع" title="استرجاع الجهاز" className="admin-btn small secondary">
      {(close) => (
        <ActionForm action={returnDeviceAction.bind(null, deviceId)} onSuccess={close}>
          <SelectField name="condition" label="الحالة عند الاسترجاع" options={[{ value: "new", label: "جديد" }, { value: "good", label: "جيد" }, { value: "fair", label: "مقبول" }, { value: "poor", label: "ضعيف" }, { value: "damaged", label: "تالف" }]} defaultValue="good" />
          <SelectField name="next_status" label="الوجهة" options={[{ value: "in_stock", label: "المخزون" }, { value: "in_repair", label: "الصيانة" }, { value: "retired", label: "استبعاد" }, { value: "lost", label: "مفقود" }]} defaultValue="in_stock" />
          <div className="bos-form-actions"><SubmitButton label="حفظ" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function ConfirmReceiptButton({ deviceId }: { deviceId: string }) {
  return <ActionButton label="تأكيد استلام الجهاز" className="admin-btn small" action={() => confirmReceiptAction(deviceId)} />;
}

const triOptions: Opt[] = [
  { value: "", label: "غير معروف" },
  { value: "yes", label: "نعم" },
  { value: "no", label: "لا" },
];
const triValue = (v: boolean | null) => (v === true ? "yes" : v === false ? "no" : "");

export function SecurityCheckForm({ deviceId, values }: { deviceId: string; values: { os_updated: boolean | null; encryption_enabled: boolean | null; screen_lock_enabled: boolean | null; antivirus_enabled: boolean | null; company_account_configured: boolean | null } }) {
  return (
    <ActionForm action={securityCheckAction.bind(null, deviceId)} successMessage="تم الحفظ">
      <div className="bos-form-grid">
        <SelectField name="os_updated" label="نظام التشغيل محدّث" options={triOptions} defaultValue={triValue(values.os_updated)} />
        <SelectField name="encryption_enabled" label="تشفير القرص" options={triOptions} defaultValue={triValue(values.encryption_enabled)} />
        <SelectField name="screen_lock_enabled" label="قفل الشاشة" options={triOptions} defaultValue={triValue(values.screen_lock_enabled)} />
        <SelectField name="antivirus_enabled" label="برنامج الحماية" options={triOptions} defaultValue={triValue(values.antivirus_enabled)} />
        <SelectField name="company_account_configured" label="حساب الشركة مُعد" options={triOptions} defaultValue={triValue(values.company_account_configured)} />
      </div>
      <p className="bos-faint" style={{ fontSize: 12 }}><Tx>فحص حماية أصول الشركة وبياناتها — لا مراقبة للموظفين.</Tx></p>
      <div className="bos-form-actions"><SubmitButton label="حفظ الفحص" className="admin-btn small" /></div>
    </ActionForm>
  );
}
