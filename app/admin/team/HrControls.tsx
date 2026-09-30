"use client";
import { BosTable } from "@/components/bos/BosTable";
import { DateRangeFormField } from "@/components/bos/DateRangeField";

import { Tx, Opt, useT } from "@/components/bos/I18n";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ActionState } from "@/lib/bos/action";
import { ActionButton, ConfirmButton, ModalButton } from "@/components/bos/Dialog";
import { ActionForm, CheckboxField, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { FileUploader } from "@/components/bos/FileUploader";
import {
  addBalanceAdjustmentAction, addCompensationAction, addDaysOffAction, addManualLineAction, archiveDocumentAction, assignScheduleAction, cancelBonusAction,
  contractStepAction, createContractAction, createDocumentAction, createPhotoUploadAction, createRunAction, deleteHolidayAction, deleteScheduleAction,
  endComponentAction, finalizePhotoAction, goalProgressAction, loanStepAction, markRunPaidAction, payrollRunAction, progressHrRequestAction, promoteAction,
  reimburseAction, removeAssignmentAction, removeDayOffAction, removeManualLineAction, removePhotoAction, renewContractAction, requestBonusAction,
  requestFeedbackAction, requestLoanAction, saveCycleAction, saveExitInterviewAction, saveGoalAction, saveHolidayAction, savePrivateAction, saveScheduleAction,
  selfAssessmentAction, setComponentAction, setCycleStatusAction, setDefaultScheduleAction, setOvertimeMinutesAction, setShiftsAction, settleInstallmentAction,
  submitExpenseClaimAction, submitHrRequestAction, submitPerformanceFeedbackAction, updateChecklistItemAction, updateContractAction, updateDocumentAction,
  verifyDocumentAction,
} from "./hr-actions";

type Opt = { value: string; label: string };
const actions = (children: React.ReactNode) => <div className="bos-form-actions">{children}</div>;
const grid = (children: React.ReactNode) => <div className="bos-form-grid">{children}</div>;
const weekdays = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const weekOrder = [6, 0, 1, 2, 3, 4, 5];

// ---------------------------------------------------------------------------
// Profile photo
// ---------------------------------------------------------------------------

export function PhotoUploader({ employeeId, hasPhoto }: { employeeId: string; hasPhoto: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const upload = (file: File) =>
    start(async () => {
      setError(null);
      const r = await createPhotoUploadAction(employeeId, file.type, file.size);
      if (!r.ok || !r.data) return setError(r.ok ? "تعذر الرفع" : r.error);
      const { error: e } = await createClient().storage.from("bos-files").uploadToSignedUrl(r.data.path, r.data.token, file, { contentType: file.type });
      if (e) return setError("تعذر رفع الصورة");
      const f = await finalizePhotoAction(employeeId, r.data.path);
      if (!f.ok) setError(f.error);
      router.refresh();
    });
  return (
    <span className="bos-row" style={{ gap: 6 }}>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <button type="button" className="admin-btn small ghost" disabled={busy} onClick={() => input.current?.click()}><Tx>{busy ? "جارٍ الرفع..." : hasPhoto ? "تغيير الصورة" : "إضافة صورة"}</Tx></button>
      {hasPhoto ? <ActionButton label="إزالة" className="admin-btn small ghost" action={() => removePhotoAction(employeeId)} /> : null}
      {error ? <span className="bos-field-error"><Tx>{error}</Tx></span> : null}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Personal / legal / bank data
// ---------------------------------------------------------------------------

export function PrivateDataButton({ employeeId, initial, selfOnly }: { employeeId: string; initial: Record<string, string | null>; selfOnly: boolean }) {
  const v = (k: string) => initial[k] ?? "";
  return (
    <ModalButton label={selfOnly ? "تحديث بياناتي" : "تعديل البيانات"} title="البيانات الشخصية والإدارية" className="admin-btn small secondary" wide>
      {(close) => (
        <ActionForm action={savePrivateAction.bind(null, employeeId)} onSuccess={close}>
          {!selfOnly ? (
            <>
              <h4 className="bos-form-section-title"><Tx>البيانات الشخصية</Tx></h4>
              {grid(<>
                <TextField name="date_of_birth" label="تاريخ الميلاد" type="date" defaultValue={v("date_of_birth")} />
                <SelectField name="gender" label="النوع" placeholder="—" options={[{ value: "male", label: "ذكر" }, { value: "female", label: "أنثى" }]} defaultValue={v("gender")} />
                <TextField name="nationality" label="الجنسية" defaultValue={v("nationality")} />
              </>)}
            </>
          ) : null}
          {grid(<>
            <SelectField name="marital_status" label="الحالة الاجتماعية" placeholder="—" options={[{ value: "single", label: "أعزب" }, { value: "married", label: "متزوج" }, { value: "divorced", label: "مطلق" }, { value: "widowed", label: "أرمل" }]} defaultValue={v("marital_status")} />
            <TextField name="address" label="العنوان" defaultValue={v("address")} span={2} />
          </>)}
          {!selfOnly ? (
            <>
              <h4 className="bos-form-section-title"><Tx>الهوية والضرائب والتأمينات</Tx></h4>
              {grid(<>
                <TextField name="national_id" label="الرقم القومي" dir="ltr" defaultValue={v("national_id")} />
                <TextField name="national_id_expiry" label="انتهاء البطاقة" type="date" defaultValue={v("national_id_expiry")} />
                <TextField name="passport_number" label="رقم جواز السفر" dir="ltr" defaultValue={v("passport_number")} />
                <TextField name="passport_expiry" label="انتهاء الجواز" type="date" defaultValue={v("passport_expiry")} />
                <TextField name="tax_id" label="الرقم الضريبي" dir="ltr" defaultValue={v("tax_id")} />
                <TextField name="insurance_number" label="الرقم التأميني" dir="ltr" defaultValue={v("insurance_number")} />
                <TextField name="insurance_start_date" label="بداية التأمين" type="date" defaultValue={v("insurance_start_date")} />
              </>)}
            </>
          ) : null}
          <h4 className="bos-form-section-title"><Tx>البيانات البنكية</Tx></h4>
          {grid(<>
            <TextField name="bank_name" label="البنك" defaultValue={v("bank_name")} />
            <TextField name="bank_account_name" label="اسم صاحب الحساب" defaultValue={v("bank_account_name")} />
            <TextField name="bank_account_number" label="رقم الحساب" dir="ltr" defaultValue={v("bank_account_number")} />
            <TextField name="bank_iban" label="IBAN" dir="ltr" defaultValue={v("bank_iban")} />
          </>)}
          <h4 className="bos-form-section-title"><Tx>جهة الاتصال للطوارئ</Tx></h4>
          {grid(<>
            <TextField name="emergency_contact_name" label="الاسم" defaultValue={v("emergency_contact_name")} />
            <TextField name="emergency_contact_relation" label="صلة القرابة" defaultValue={v("emergency_contact_relation")} />
            <TextField name="emergency_contact_phone" label="الهاتف" dir="ltr" defaultValue={v("emergency_contact_phone")} />
          </>)}
          {!selfOnly ? <TextAreaField name="hr_notes" label="ملاحظات الموارد البشرية (سرية)" rows={3} defaultValue={v("hr_notes")} /> : null}
          {actions(<SubmitButton />)}
        </ActionForm>
      )}
    </ModalButton>
  );
}

// ---------------------------------------------------------------------------
// Compensation, components, promotion, exit interview
// ---------------------------------------------------------------------------

export function CompensationButton({ employeeId, currencies, hasSalary, label }: { employeeId: string; currencies: string[]; hasSalary: boolean; label?: string }) {
  return (
    <ModalButton label={label ?? (hasSalary ? "تعديل الراتب" : "تحديد الراتب")} title={hasSalary ? "تعديل الراتب الأساسي" : "الراتب الأساسي"} className="admin-btn small">
      {(close) => (
        <ActionForm action={addCompensationAction} onSuccess={close}>
          <input type="hidden" name="employee_id" value={employeeId} />
          {grid(<>
            <TextField name="basic_salary" label="الراتب الأساسي الشهري" required inputMode="decimal" />
            <SelectField name="currency" label="العملة" options={currencies.map((c) => ({ value: c, label: c }))} defaultValue="EGP" />
            <TextField name="effective_from" label="ساري من" type="date" required />
            <SelectField name="change_type" label="نوع التغيير" options={hasSalary ? [{ value: "adjustment", label: "تعديل راتب" }, { value: "promotion", label: "ترقية" }, { value: "correction", label: "تصحيح إدخال" }] : [{ value: "initial", label: "راتب مبدئي" }]} />
          </>)}
          <TextAreaField name="reason" label="السبب" rows={2} />
          {hasSalary ? <p className="bos-faint" style={{ fontSize: 12 }}><Tx>التعديل والترقية يحتاجان اعتماد المالية حسب قواعد الموافقة؛ التصحيح يُسجل مباشرة ويظهر في سجل التدقيق.</Tx></p> : null}
          {actions(<SubmitButton />)}
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function ComponentButton({ employeeId, components }: { employeeId: string; components: (Opt & { calc: string })[] }) {
  const [comp, setComp] = useState("");
  const percent = components.find((c) => c.value === comp)?.calc === "percent_of_basic";
  return (
    <ModalButton label="+ بدل / استقطاع" title="بند راتب ثابت" className="admin-btn small secondary">
      {(close) => (
        <ActionForm action={setComponentAction} onSuccess={close}>
          <input type="hidden" name="employee_id" value={employeeId} />
          {grid(<>
            <SelectField name="component_id" label="البند" required placeholder="اختر..." options={components} value={comp} onChange={(e) => setComp(e.target.value)} />
            <TextField name="amount" label={percent ? "النسبة من الأساسي %" : "المبلغ الشهري"} required inputMode="decimal" />
            <TextField name="effective_from" label="ساري من" type="date" required />
            <TextField name="effective_to" label="حتى (اختياري)" type="date" />
          </>)}
          <TextField name="notes" label="ملاحظات" />
          {actions(<SubmitButton />)}
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function EndComponentButton({ id }: { id: string }) {
  const [to, setTo] = useState("");
  return (
    <ModalButton label="إيقاف" title="إيقاف البند" className="admin-btn small ghost">
      {(close) => (
        <div className="bos-stack">
          <div className="bos-field"><label htmlFor="end-to"><Tx>آخر يوم للبند</Tx></label><input id="end-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <ActionButton label="تأكيد" className="admin-btn small" action={async () => { const r = await endComponentAction(id, to); if (r.ok) close(); return r; }} />
        </div>
      )}
    </ModalButton>
  );
}

export function PromoteButton({ employeeId, position, departments, managers, currencies, canSalary }: { employeeId: string; position: string | null; departments: Opt[]; managers: Opt[]; currencies: string[]; canSalary: boolean }) {
  return (
    <ModalButton label="ترقية / نقل" title="ترقية أو نقل الموظف" className="admin-btn small secondary">
      {(close) => (
        <ActionForm action={promoteAction} onSuccess={close}>
          <input type="hidden" name="employee_id" value={employeeId} />
          {grid(<>
            <TextField name="to_position" label="المسمى الجديد" required defaultValue={position ?? ""} />
            <TextField name="effective_date" label="ساري من" type="date" required />
            <SelectField name="department_id" label="القسم (اختياري)" placeholder="بدون تغيير" options={departments} />
            <SelectField name="manager_id" label="المدير (اختياري)" placeholder="بدون تغيير" options={managers} />
            {canSalary ? <><TextField name="new_basic_salary" label="الراتب الجديد (اختياري)" inputMode="decimal" /><SelectField name="currency" label="العملة" placeholder="—" options={currencies.map((c) => ({ value: c, label: c }))} /></> : null}
          </>)}
          <TextAreaField name="reason" label="السبب" required rows={2} />
          {actions(<SubmitButton label="تسجيل" />)}
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function ExitInterviewButton({ employeeId, initial }: { employeeId: string; initial: { exit_interview_at: string | null; exit_interview_notes: string | null; rehire_eligible: boolean | null; last_working_day: string | null } }) {
  return (
    <ModalButton label="مقابلة الخروج" title="مقابلة الخروج وآخر يوم عمل" className="admin-btn small secondary">
      {(close) => (
        <ActionForm action={saveExitInterviewAction} onSuccess={close}>
          <input type="hidden" name="employee_id" value={employeeId} />
          {grid(<>
            <TextField name="exit_interview_at" label="موعد المقابلة" type="datetime-local" defaultValue={initial.exit_interview_at?.slice(0, 16) ?? ""} />
            <TextField name="last_working_day" label="آخر يوم عمل" type="date" defaultValue={initial.last_working_day ?? ""} />
            <SelectField name="rehire_eligible" label="مؤهل لإعادة التعيين" placeholder="—" options={[{ value: "yes", label: "نعم" }, { value: "no", label: "لا" }]} defaultValue={initial.rehire_eligible == null ? "" : initial.rehire_eligible ? "yes" : "no"} />
          </>)}
          <TextAreaField name="exit_interview_notes" label="ملاحظات المقابلة" rows={4} defaultValue={initial.exit_interview_notes ?? ""} />
          {actions(<SubmitButton />)}
        </ActionForm>
      )}
    </ModalButton>
  );
}

// ---------------------------------------------------------------------------
// Checklist task details
// ---------------------------------------------------------------------------

export function ChecklistTaskEditor({ employeeId, item, staff, canManage }: { employeeId: string; item: { id: string; status: string; assignee_user_id: string | null; due_date: string | null; notes: string | null; required: boolean; auto_key: string | null }; staff: Opt[]; canManage: boolean }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const run = (patch: Parameters<typeof updateChecklistItemAction>[2]) =>
    start(async () => {
      setError(null);
      const r = await updateChecklistItemAction(employeeId, item.id, patch);
      if (!r.ok) setError(r.error);
      router.refresh();
    });
  const manual = !item.auto_key;
  return (
    <span className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}>
      {manual ? (
        <select aria-label={t("الحالة")} value={item.status} disabled={pending} onChange={(e) => run({ status: e.target.value })}>
          <Opt value="pending">لم يبدأ</Opt>
          <Opt value="in_progress">قيد التنفيذ</Opt>
          <Opt value="blocked">متوقف</Opt>
          <Opt value="done">تم</Opt>
          {!item.required ? <Opt value="skipped">لا ينطبق</Opt> : null}
        </select>
      ) : null}
      {canManage ? (
        <>
          <select aria-label={t("المسؤول")} value={item.assignee_user_id ?? ""} disabled={pending} onChange={(e) => run({ assignee_user_id: e.target.value || null })}>
            <Opt value="">— المسؤول —</Opt>
            {staff.map((s) => <Opt key={s.value} value={s.value}>{s.label}</Opt>)}
          </select>
          <input type="date" aria-label={t("تاريخ الاستحقاق")} value={item.due_date ?? ""} disabled={pending} onChange={(e) => run({ due_date: e.target.value || null })} />
        </>
      ) : null}
      <ModalButton label={item.notes ? "ملاحظة ✎" : "ملاحظة"} title="ملاحظات البند" className="admin-btn small ghost">
        {(close) => <NotesEditor initial={item.notes ?? ""} onSave={async (notes) => { const r = await updateChecklistItemAction(employeeId, item.id, { notes: notes || null }); if (r.ok) { close(); router.refresh(); } return r; }} />}
      </ModalButton>
      {error ? <span className="bos-field-error" style={{ fontSize: 11.5 }}><Tx>{error}</Tx></span> : null}
    </span>
  );
}

function NotesEditor({ initial, onSave }: { initial: string; onSave: (v: string) => Promise<ActionState> }) {
  const t = useT();
  const [v, setV] = useState(initial);
  return (
    <div className="bos-stack">
      <textarea aria-label={t("ملاحظات")} value={v} onChange={(e) => setV(e.target.value)} rows={4} />
      <ActionButton label="حفظ" className="admin-btn small" action={() => onSave(v)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export function NewDocumentButton({ employees, types, fixedEmployeeId, label = "+ مستند", canConfidential }: { employees: Opt[]; types: (Opt & { requires_expiry: boolean })[]; fixedEmployeeId?: string; label?: string; canConfidential: boolean }) {
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [type, setType] = useState("");
  const needsExpiry = types.find((t) => t.value === type)?.requires_expiry;
  return (
    <ModalButton label={label} title="إضافة مستند لملف الموظف" className="admin-btn small">
      {(close) =>
        createdId ? (
          <div className="bos-stack">
            <p style={{ fontSize: 13 }}><Tx>تم إنشاء السجل. ارفع ملف المستند (PDF أو صورة):</Tx></p>
            <FileUploader entityType="employee_document" entityId={createdId} label="رفع الملف" />
            {actions(<button type="button" className="admin-btn small secondary" onClick={() => { setCreatedId(null); close(); }}><Tx>تم</Tx></button>)}
          </div>
        ) : (
          <ActionForm action={createDocumentAction as (s: ActionState, f: FormData) => Promise<ActionState>} onSuccess={(s) => setCreatedId(((s as { data?: { id: string } }).data?.id) ?? null)}>
            {fixedEmployeeId ? <input type="hidden" name="employee_id" value={fixedEmployeeId} /> : null}
            {grid(<>
              {!fixedEmployeeId ? <SelectField name="employee_id" label="الموظف" required placeholder="اختر..." options={employees} /> : null}
              <SelectField name="document_type_id" label="نوع المستند" required placeholder="اختر..." options={types} value={type} onChange={(e) => setType(e.target.value)} />
              <TextField name="title" label="العنوان" required />
              <TextField name="document_number" label="رقم المستند" dir="ltr" />
              <TextField name="issue_date" label="تاريخ الإصدار" type="date" />
              <TextField name="expiry_date" label={`تاريخ الانتهاء${needsExpiry ? " *" : ""}`} type="date" required={!!needsExpiry} />
            </>)}
            <TextField name="notes" label="ملاحظات" />
            {canConfidential ? <CheckboxField name="confidential" label="سري (للموارد البشرية فقط — لا يراه الموظف)" /> : null}
            {actions(<SubmitButton label="التالي: رفع الملف" />)}
          </ActionForm>
        )
      }
    </ModalButton>
  );
}

export function DocumentRowActions({ doc, canManage, canVerify, canUpload }: { doc: { id: string; title: string; document_number: string | null; issue_date: string | null; expiry_date: string | null; notes: string | null; confidential: boolean; status: string; hasFile: boolean }; canManage: boolean; canVerify: boolean; canUpload: boolean }) {
  return (
    <span className="bos-row" style={{ gap: 4, flexWrap: "wrap" }}>
      {canUpload ? (
        <ModalButton label={doc.hasFile ? "نسخة جديدة" : "رفع الملف"} title="رفع ملف المستند" className="admin-btn small ghost">
          {() => <FileUploader entityType="employee_document" entityId={doc.id} label="رفع الملف" />}
        </ModalButton>
      ) : null}
      {canVerify && doc.status === "pending_verification" ? (
        <>
          <ActionButton label="اعتماد" className="admin-btn small success" action={() => verifyDocumentAction(doc.id, "valid")} />
          <ConfirmButton label="رفض" className="admin-btn small danger" message="سيتم إبلاغ الموظف بسبب الرفض ليعيد الرفع." requireReason action={(r) => verifyDocumentAction(doc.id, "rejected", r)} />
        </>
      ) : null}
      {canManage ? (
        <ModalButton label="تعديل" title="تعديل بيانات المستند" className="admin-btn small ghost">
          {(close) => (
            <ActionForm action={updateDocumentAction.bind(null, doc.id)} onSuccess={close}>
              {grid(<>
                <TextField name="title" label="العنوان" required defaultValue={doc.title} />
                <TextField name="document_number" label="رقم المستند" dir="ltr" defaultValue={doc.document_number ?? ""} />
                <TextField name="issue_date" label="تاريخ الإصدار" type="date" defaultValue={doc.issue_date ?? ""} />
                <TextField name="expiry_date" label="تاريخ الانتهاء" type="date" defaultValue={doc.expiry_date ?? ""} />
              </>)}
              <TextField name="notes" label="ملاحظات" defaultValue={doc.notes ?? ""} />
              <CheckboxField name="confidential" label="سري" defaultChecked={doc.confidential} />
              {actions(<SubmitButton />)}
            </ActionForm>
          )}
        </ModalButton>
      ) : null}
      {canManage && doc.status !== "archived" ? <ConfirmButton label="أرشفة" className="admin-btn small ghost" message="يبقى المستند في السجل كمؤرشف." requireReason action={(r) => archiveDocumentAction(doc.id, r)} /> : null}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

const contractTypes: Opt[] = [
  { value: "employment", label: "عقد عمل" }, { value: "probation", label: "فترة اختبار" }, { value: "freelance", label: "عمل حر" },
  { value: "internship", label: "تدريب" }, { value: "nda", label: "اتفاقية سرية" }, { value: "other", label: "أخرى" },
];

export function ContractForm({ employees, currencies, fixedEmployeeId, initial, contractId }: { employees: Opt[]; currencies: string[]; fixedEmployeeId?: string; initial?: Record<string, string | number | null>; contractId?: string }) {
  const v = (k: string) => (initial?.[k] == null ? "" : String(initial[k]));
  return (
    <ActionForm action={contractId ? updateContractAction.bind(null, contractId) : createContractAction}>
      {grid(<>
        {!contractId ? (fixedEmployeeId ? <input type="hidden" name="employee_id" value={fixedEmployeeId} /> : <SelectField name="employee_id" label="الموظف" required placeholder="اختر..." options={employees} />) : null}
        {!contractId ? <SelectField name="contract_type" label="نوع العقد" options={contractTypes} defaultValue="employment" /> : null}
        <TextField name="title" label="عنوان العقد" required defaultValue={v("title")} />
        <TextField name="position_title" label="المسمى في العقد" defaultValue={v("position_title")} />
        <TextField name="start_date" label="تاريخ البداية" type="date" required defaultValue={v("start_date")} />
        <TextField name="end_date" label="تاريخ النهاية (فارغ = غير محدد المدة)" type="date" defaultValue={v("end_date")} />
        <TextField name="basic_salary" label="الراتب في العقد" inputMode="decimal" defaultValue={v("basic_salary")} />
        <SelectField name="currency" label="العملة" placeholder="—" options={currencies.map((c) => ({ value: c, label: c }))} defaultValue={v("currency")} />
        <TextField name="notice_period_days" label="فترة الإخطار (أيام)" inputMode="numeric" defaultValue={v("notice_period_days")} />
      </>)}
      <TextAreaField name="terms" label="البنود الأساسية (السرية، الملكية الفكرية، …)" rows={4} defaultValue={v("terms")} />
      <TextField name="notes" label="ملاحظات" defaultValue={v("notes")} />
      {actions(<SubmitButton label={contractId ? "حفظ" : "إنشاء العقد"} />)}
    </ActionForm>
  );
}

export function NewContractButton(props: { employees: Opt[]; currencies: string[]; fixedEmployeeId?: string }) {
  return (
    <ModalButton label="+ عقد" title="عقد موظف جديد" className="admin-btn small" wide>
      {() => <ContractForm {...props} />}
    </ModalButton>
  );
}

export function ContractSteps({ id, status, signature, canManage, isEmployee }: { id: string; status: string; signature: string; canManage: boolean; isEmployee: boolean }) {
  const open = ["draft", "pending_signature"].includes(status);
  return (
    <span className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}>
      {canManage && status === "draft" ? <ActionButton label="إرسال للتوقيع" className="admin-btn small" action={() => contractStepAction(id, "send")} /> : null}
      {(isEmployee || canManage) && open && !["employee_signed", "signed"].includes(signature) ? <ActionButton label={isEmployee ? "توقيعي على العقد" : "تسجيل توقيع الموظف"} className="admin-btn small secondary" action={() => contractStepAction(id, "sign_employee")} /> : null}
      {canManage && open && !["company_signed", "signed"].includes(signature) ? <ActionButton label="تسجيل توقيع الشركة" className="admin-btn small secondary" action={() => contractStepAction(id, "sign_company")} /> : null}
      {canManage && open && signature === "signed" ? <ActionButton label="تفعيل العقد" className="admin-btn small success" action={() => contractStepAction(id, "activate")} /> : null}
      {canManage && status === "active" ? <ConfirmButton label="إنهاء العقد" className="admin-btn small danger" message="يُنهى العقد ويُحفظ في السجل." requireReason action={(r) => contractStepAction(id, "terminate", r)} /> : null}
      {canManage && open ? <ConfirmButton label="إلغاء" className="admin-btn small ghost" message="إلغاء العقد قبل تفعيله." action={() => contractStepAction(id, "cancel")} /> : null}
    </span>
  );
}

export function RenewContractButton({ parentId, kind, currencies }: { parentId: string; kind: "renewal" | "amendment"; currencies: string[] }) {
  return (
    <ModalButton label={kind === "renewal" ? "تجديد" : "ملحق تعديل"} title={kind === "renewal" ? "تجديد العقد (نسخة جديدة)" : "ملحق تعديل على العقد"} className="admin-btn small secondary">
      {() => (
        <ActionForm action={renewContractAction}>
          <input type="hidden" name="parent_id" value={parentId} />
          <input type="hidden" name="kind" value={kind} />
          {grid(<>
            <TextField name="title" label="العنوان (اختياري)" />
            <TextField name="start_date" label="ساري من" type="date" required />
            <TextField name="end_date" label="حتى" type="date" />
            <TextField name="basic_salary" label="الراتب (فارغ = كما هو)" inputMode="decimal" />
            <SelectField name="currency" label="العملة" placeholder="كما هي" options={currencies.map((c) => ({ value: c, label: c }))} />
          </>)}
          <TextAreaField name="terms" label="البنود (فارغ = كما هي)" rows={3} />
          <TextField name="notes" label="ملاحظات" />
          {actions(<SubmitButton label="إنشاء النسخة" />)}
        </ActionForm>
      )}
    </ModalButton>
  );
}

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

type DayRow = { weekday: number; is_working: boolean; start_time: string; end_time: string; break_minutes: number };

export function ScheduleEditorButton({ schedule, label }: { schedule?: { id: string; name: string; schedule_type: string; timezone: string; grace_minutes: number; half_day_minutes: number; overtime_after_minutes: number; required_minutes: number | null; description: string | null; color: string | null; is_active: boolean; days: DayRow[] }; label?: string }) {
  const t = useT();
  const initialDays: DayRow[] = [0, 1, 2, 3, 4, 5, 6].map((d) => schedule?.days.find((x) => x.weekday === d) ?? { weekday: d, is_working: d !== 5 && d !== 6, start_time: "09:00", end_time: "17:00", break_minutes: 60 });
  const [days, setDays] = useState<DayRow[]>(initialDays.map((d) => ({ ...d, start_time: d.start_time.slice(0, 5), end_time: d.end_time.slice(0, 5) })));
  const [type, setType] = useState(schedule?.schedule_type ?? "fixed");
  const set = (weekday: number, patch: Partial<DayRow>) => setDays((prev) => prev.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));
  const copyToWorking = (weekday: number) => {
    const src = days.find((d) => d.weekday === weekday)!;
    setDays((prev) => prev.map((d) => (d.is_working ? { ...d, start_time: src.start_time, end_time: src.end_time, break_minutes: src.break_minutes } : d)));
  };
  return (
    <ModalButton label={label ?? (schedule ? "تعديل" : "+ جدول / وردية")} title={schedule ? `جدول: ${schedule.name}` : "جدول عمل جديد"} className={schedule ? "admin-btn small ghost" : "admin-btn small"} wide>
      {(close) => (
        <ActionForm action={saveScheduleAction} onSuccess={close}>
          {schedule ? <input type="hidden" name="id" value={schedule.id} /> : null}
          <input type="hidden" name="days" value={JSON.stringify(days)} />
          {grid(<>
            <TextField name="name" label="الاسم" required defaultValue={schedule?.name ?? ""} placeholder="مثال: الوردية الصباحية A" />
            <SelectField name="schedule_type" label="النوع" value={type} onChange={(e) => setType(e.target.value)} options={[{ value: "fixed", label: "ثابت" }, { value: "shift", label: "ورديات" }, { value: "night", label: "وردية ليلية (تعبر منتصف الليل)" }, { value: "flexible", label: "مرن (عدد ساعات)" }, { value: "remote", label: "عن بُعد" }]} />
            <TextField name="timezone" label="المنطقة الزمنية" required dir="ltr" defaultValue={schedule?.timezone ?? "Africa/Cairo"} />
            <TextField name="grace_minutes" label="السماح بالتأخير (دقيقة)" inputMode="numeric" defaultValue={String(schedule?.grace_minutes ?? 15)} />
            <TextField name="overtime_after_minutes" label="يُحسب الإضافي بعد (دقيقة)" inputMode="numeric" defaultValue={String(schedule?.overtime_after_minutes ?? 0)} />
            <TextField name="half_day_minutes" label="حد نصف اليوم (دقيقة)" inputMode="numeric" defaultValue={String(schedule?.half_day_minutes ?? 240)} />
            {type === "flexible" ? <TextField name="required_minutes" label="الدقائق المطلوبة يومياً" required inputMode="numeric" defaultValue={String(schedule?.required_minutes ?? 480)} /> : null}
            <TextField name="color" label="اللون (اختياري)" dir="ltr" placeholder="#60a5fa" defaultValue={schedule?.color ?? ""} />
          </>)}
          <div className="bos-table-scroll">
            <BosTable className="bos-table">
              <thead><tr><th><Tx>اليوم</Tx></th><th><Tx>يوم عمل</Tx></th><th><Tx>البداية</Tx></th><th><Tx>النهاية</Tx></th><th><Tx>الاستراحة (د)</Tx></th><th /></tr></thead>
              <tbody>
                {weekOrder.map((wd) => {
                  const d = days.find((x) => x.weekday === wd)!;
                  return (
                    <tr key={wd}>
                      <td><Tx>{weekdays[wd]}</Tx></td>
                      <td><input type="checkbox" aria-label={`${weekdays[wd]} يوم عمل`} checked={d.is_working} onChange={(e) => set(wd, { is_working: e.target.checked })} /></td>
                      <td><input type="time" aria-label={t("البداية")} value={d.start_time} disabled={!d.is_working} onChange={(e) => set(wd, { start_time: e.target.value })} /></td>
                      <td><input type="time" aria-label={t("النهاية")} value={d.end_time} disabled={!d.is_working} onChange={(e) => set(wd, { end_time: e.target.value })} /></td>
                      <td><input type="number" min={0} max={600} aria-label={t("الاستراحة")} style={{ width: 80 }} value={d.break_minutes} disabled={!d.is_working} onChange={(e) => set(wd, { break_minutes: Number(e.target.value) })} /></td>
                      <td>{d.is_working ? <button type="button" className="admin-btn small ghost" onClick={() => copyToWorking(wd)}><Tx>نسخ لكل أيام العمل</Tx></button> : <span className="bos-faint"><Tx>راحة</Tx></span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </BosTable>
          </div>
          <TextField name="description" label="الوصف" defaultValue={schedule?.description ?? ""} />
          <CheckboxField name="is_active" label="نشط" defaultChecked={schedule?.is_active ?? true} />
          {actions(<SubmitButton />)}
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function ScheduleRowActions({ id, isDefault }: { id: string; isDefault: boolean }) {
  return (
    <span className="bos-row" style={{ gap: 4 }}>
      {!isDefault ? <ActionButton label="تعيين كافتراضي" className="admin-btn small ghost" action={() => setDefaultScheduleAction(id)} /> : null}
      {!isDefault ? <ConfirmButton label="حذف" className="admin-btn small ghost" message="إن كان الجدول مستخدماً سيتم تعطيله بدلاً من حذفه للحفاظ على سجل الحضور." action={() => deleteScheduleAction(id)} /> : null}
    </span>
  );
}

export function AssignScheduleButton({ schedules, departments, teams, employees }: { schedules: Opt[]; departments: Opt[]; teams: Opt[]; employees: Opt[] }) {
  const [scope, setScope] = useState("department");
  const targets = scope === "department" ? departments : scope === "team" ? teams : scope === "employee" ? employees : [];
  return (
    <ModalButton label="+ تعيين جدول" title="تعيين جدول عمل" className="admin-btn small">
      {(close) => (
        <ActionForm action={assignScheduleAction} onSuccess={close}>
          {grid(<>
            <SelectField name="schedule_id" label="الجدول" required placeholder="اختر..." options={schedules} />
            <SelectField name="scope" label="المستوى" value={scope} onChange={(e) => setScope(e.target.value)} options={[{ value: "company", label: "الشركة" }, { value: "department", label: "قسم" }, { value: "team", label: "فريق" }, { value: "employee", label: "موظف" }]} />
            {scope !== "company" ? <SelectField key={scope} name="target_id" label="الهدف" required placeholder="اختر..." options={targets} /> : null}
            <TextField name="effective_from" label="ساري من" type="date" required />
            <TextField name="effective_to" label="حتى (اختياري — مثال: رمضان)" type="date" />
          </>)}
          <TextField name="notes" label="ملاحظات" />
          <p className="bos-faint" style={{ fontSize: 12 }}><Tx>الأولوية: وردية يوم محدد ← الموظف ← الفريق ← القسم ← الشركة ← الجدول الافتراضي.</Tx></p>
          {actions(<SubmitButton label="تعيين" />)}
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function RemoveAssignmentButton({ id }: { id: string }) {
  return <ConfirmButton label="إزالة" className="admin-btn small ghost" message="إزالة هذا التعيين." action={() => removeAssignmentAction(id)} />;
}

export function ShiftsButton({ schedules, employees }: { schedules: Opt[]; employees: Opt[] }) {
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <ModalButton label="تعيين ورديات" title="تعيين ورديات لأيام محددة" className="admin-btn small secondary" wide>
      {(close) => (
        <ActionForm action={setShiftsAction} onSuccess={close}>
          {grid(<>
            <SelectField name="schedule_id" label="الوردية" placeholder="— إزالة الورديات (الرجوع للجدول الأساسي) —" options={schedules} />
            <DateRangeFormField label="الفترة" required />
          </>)}
          <div className="bos-field span-all">
            <label><Tx>الأيام (فارغ = كل الأيام)</Tx></label>
            <div className="bos-row" style={{ gap: 10, flexWrap: "wrap" }}>{weekOrder.map((d) => <label key={d} className="bos-check"><input type="checkbox" name="weekdays[]" value={d} /><Tx>{weekdays[d]}</Tx></label>)}</div>
          </div>
          <div className="bos-field span-all">
            <label><Tx>الموظفون *</Tx></label>
            <div className="bos-row" style={{ gap: 10, flexWrap: "wrap", maxHeight: 180, overflowY: "auto" }}>
              {employees.map((e) => <label key={e.value} className="bos-check"><input type="checkbox" name="employee_ids[]" value={e.value} checked={picked.includes(e.value)} onChange={(ev) => setPicked(ev.target.checked ? [...picked, e.value] : picked.filter((x) => x !== e.value))} /><Tx>{e.label}</Tx></label>)}
            </div>
          </div>
          <TextField name="notes" label="ملاحظات" />
          {actions(<SubmitButton label="حفظ" />)}
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function HolidayButton({ initial }: { initial?: { id: string; date: string; name: string; kind: string; country: string | null; is_paid: boolean; notes: string | null } }) {
  return (
    <ModalButton label={initial ? "تعديل" : "+ عطلة"} title={initial ? "تعديل العطلة" : "عطلة رسمية / عطلة شركة"} className={initial ? "admin-btn small ghost" : "admin-btn small"}>
      {(close) => (
        <ActionForm action={saveHolidayAction} onSuccess={close}>
          {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
          {grid(<>
            <TextField name="name" label="الاسم" required defaultValue={initial?.name ?? ""} />
            <SelectField name="kind" label="النوع" options={[{ value: "public", label: "عطلة رسمية" }, { value: "company", label: "عطلة شركة" }]} defaultValue={initial?.kind ?? "public"} />
            <TextField name="date" label={initial ? "التاريخ" : "من"} type="date" required defaultValue={initial?.date ?? ""} />
            {!initial ? <TextField name="end_date" label="إلى (لعدة أيام)" type="date" /> : null}
            <TextField name="country" label="الدولة (فارغ = الكل)" defaultValue={initial?.country ?? ""} />
          </>)}
          <CheckboxField name="is_paid" label="مدفوعة" defaultChecked={initial?.is_paid ?? true} />
          <TextField name="notes" label="ملاحظات" defaultValue={initial?.notes ?? ""} />
          {actions(<SubmitButton />)}
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function DeleteHolidayButton({ id }: { id: string }) {
  return <ConfirmButton label="حذف" className="admin-btn small ghost" message="حذف العطلة وإعادة احتساب الحضور لذلك اليوم." action={() => deleteHolidayAction(id)} />;
}

export function DayOffButton({ departments, teams, employees }: { departments: Opt[]; teams: Opt[]; employees: Opt[] }) {
  const [scope, setScope] = useState("employee");
  const targets = scope === "department" ? departments : scope === "team" ? teams : employees;
  return (
    <ModalButton label="+ يوم راحة مخصص" title="يوم راحة مخصص" className="admin-btn small secondary">
      {(close) => (
        <ActionForm action={addDaysOffAction} onSuccess={close}>
          {grid(<>
            <SelectField name="scope" label="لمن" value={scope} onChange={(e) => setScope(e.target.value)} options={[{ value: "employee", label: "موظف" }, { value: "team", label: "فريق" }, { value: "department", label: "قسم" }]} />
            <SelectField key={scope} name="target_id" label="الهدف" required placeholder="اختر..." options={targets} />
            <DateRangeFormField label="الفترة" required />
          </>)}
          <TextField name="reason" label="السبب" required />
          {actions(<SubmitButton />)}
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function RemoveDayOffButton({ id }: { id: string }) {
  return <ConfirmButton label="حذف" className="admin-btn small ghost" message="حذف يوم الراحة وإعادة احتساب الحضور." action={() => removeDayOffAction(id)} />;
}

// ---------------------------------------------------------------------------
// Leave balance adjustment, overtime approved minutes
// ---------------------------------------------------------------------------

export function BalanceAdjustButton({ userId, types, year }: { userId: string; types: Opt[]; year: number }) {
  return (
    <ModalButton label="تعديل الرصيد" title="تعديل رصيد الإجازات" className="admin-btn small ghost">
      {(close) => (
        <ActionForm action={addBalanceAdjustmentAction} onSuccess={close}>
          <input type="hidden" name="user_id" value={userId} />
          {grid(<>
            <SelectField name="leave_type_id" label="النوع" required placeholder="اختر..." options={types} />
            <TextField name="year" label="السنة" inputMode="numeric" defaultValue={String(year)} required />
            <SelectField name="kind" label="نوع التعديل" options={[{ value: "adjustment", label: "إضافة / خصم أيام" }, { value: "carry_forward", label: "ترحيل من السنة السابقة" }, { value: "allowance_override", label: "رصيد مخصص لهذا الموظف" }]} />
            <TextField name="days" label="الأيام (سالب للخصم)" inputMode="decimal" required />
          </>)}
          <TextField name="reason" label="السبب" required />
          {actions(<SubmitButton />)}
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function OvertimeMinutesButton({ id, minutes }: { id: string; minutes: number }) {
  const [m, setM] = useState(String(minutes));
  const [reason, setReason] = useState("");
  return (
    <ModalButton label="تعديل المعتمد" title="الدقائق المعتمدة للصرف" className="admin-btn small ghost">
      {(close) => (
        <div className="bos-stack">
          <div className="bos-field"><label htmlFor="ot-m"><Tx>الدقائق المعتمدة</Tx></label><input id="ot-m" type="number" min={0} max={960} value={m} onChange={(e) => setM(e.target.value)} /></div>
          <div className="bos-field"><label htmlFor="ot-r"><Tx>السبب *</Tx></label><input id="ot-r" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <ActionButton label="حفظ" className="admin-btn small" action={async () => { const r = await setOvertimeMinutesAction(id, Number(m), reason); if (r.ok) close(); return r; }} />
        </div>
      )}
    </ModalButton>
  );
}

// ---------------------------------------------------------------------------
// Payroll
// ---------------------------------------------------------------------------

export function NewRunButton({ departments, employees, defaultPeriod }: { departments: Opt[]; employees: Opt[]; defaultPeriod: string }) {
  const [type, setType] = useState("regular");
  return (
    <ModalButton label="+ دورة رواتب" title="دورة رواتب جديدة" className="admin-btn small">
      {() => (
        <ActionForm action={createRunAction}>
          {grid(<>
            <SelectField name="run_type" label="النوع" value={type} onChange={(e) => setType(e.target.value)} options={[{ value: "regular", label: "دورة شهرية" }, { value: "off_cycle", label: "خارج الدورة" }, { value: "final_settlement", label: "تسوية نهائية (إنهاء خدمة)" }]} />
            <TextField name="period" label="الشهر" type="month" required defaultValue={defaultPeriod} />
            <TextField name="pay_date" label="تاريخ الصرف" type="date" />
            {type !== "final_settlement" ? <SelectField name="department_id" label="القسم (فارغ = الكل)" placeholder="كل الأقسام" options={departments} /> : null}
            {type !== "regular" ? <SelectField name="employee_id" label="الموظف" required={type === "final_settlement"} placeholder="اختر..." options={employees} /> : null}
          </>)}
          <TextField name="notes" label="ملاحظات" />
          <p className="bos-faint" style={{ fontSize: 12 }}><Tx>يتم الحساب تلقائياً: الأساسي والبدلات، الغياب والإجازات بدون أجر والتأخير، العمل الإضافي المعتمد، المكافآت والعمولات المعتمدة، أقساط القروض والسلف، المصروفات المستردة، التأمينات والضرائب.</Tx></p>
          {actions(<SubmitButton label="إنشاء وحساب" />)}
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function RunSteps({ runId, status, canPay, today }: { runId: string; status: string; canPay: boolean; today: string }) {
  return (
    <span className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}>
      {["draft", "calculated"].includes(status) ? <ActionButton label="إعادة الحساب" className="admin-btn small secondary" action={() => payrollRunAction(runId, "calculate")} /> : null}
      {status === "calculated" ? <ActionButton label="إرسال للاعتماد" className="admin-btn small" action={() => payrollRunAction(runId, "submit")} /> : null}
      {["approved", "paid"].includes(status) ? <ActionButton label="نشر القسائم للموظفين" className="admin-btn small secondary" action={() => payrollRunAction(runId, "publish")} /> : null}
      {status === "approved" && canPay ? (
        <ModalButton label="تسجيل الصرف" title="تسجيل صرف الرواتب" className="admin-btn small success">
          {(close) => (
            <ActionForm action={markRunPaidAction} onSuccess={close}>
              <input type="hidden" name="run_id" value={runId} />
              {grid(<>
                <TextField name="paid_on" label="تاريخ الصرف" type="date" required defaultValue={today} />
                <TextField name="reference" label="مرجع التحويل البنكي" />
              </>)}
              <p className="bos-faint" style={{ fontSize: 12 }}><Tx>سيتم ترحيل تكلفة كل راتب إلى المصروفات في المالية، وتسوية العمل الإضافي والمكافآت والعمولات وأقساط القروض والمصروفات المستردة.</Tx></p>
              {actions(<SubmitButton label="تأكيد الصرف" />)}
            </ActionForm>
          )}
        </ModalButton>
      ) : null}
      {["draft", "calculated", "pending_approval"].includes(status) ? <ConfirmButton label="إلغاء الدورة" className="admin-btn small ghost" message="تُلغى الدورة وقسائمها." requireReason action={(r) => payrollRunAction(runId, "cancel", r)} /> : null}
    </span>
  );
}

export function ManualLineButton({ payslipId }: { payslipId: string }) {
  return (
    <ModalButton label="+ بند يدوي" title="بند يدوي على القسيمة" className="admin-btn small ghost">
      {(close) => (
        <ActionForm action={addManualLineAction} onSuccess={close}>
          <input type="hidden" name="payslip_id" value={payslipId} />
          {grid(<>
            <SelectField name="kind" label="النوع" options={[{ value: "earning", label: "استحقاق" }, { value: "deduction", label: "استقطاع" }]} />
            <TextField name="label" label="البيان" required placeholder="مثال: بدل رصيد إجازات" />
            <TextField name="amount" label="المبلغ" required inputMode="decimal" />
          </>)}
          <CheckboxField name="taxable" label="خاضع للضريبة" defaultChecked />
          {actions(<SubmitButton label="إضافة وإعادة الحساب" />)}
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function RemoveManualLineButton({ id }: { id: string }) {
  return <ConfirmButton label="حذف" className="admin-btn small ghost" message="حذف البند اليدوي وإعادة الحساب." action={() => removeManualLineAction(id)} />;
}

export function BonusButton({ employees, fixedEmployeeId, currencies, defaultPeriod }: { employees: Opt[]; fixedEmployeeId?: string; currencies: string[]; defaultPeriod: string }) {
  return (
    <ModalButton label="+ مكافأة" title="طلب مكافأة" className="admin-btn small">
      {(close) => (
        <ActionForm action={requestBonusAction} onSuccess={close}>
          {fixedEmployeeId ? <input type="hidden" name="employee_id" value={fixedEmployeeId} /> : null}
          {grid(<>
            {!fixedEmployeeId ? <SelectField name="employee_id" label="الموظف" required placeholder="اختر..." options={employees} /> : null}
            <SelectField name="bonus_type" label="النوع" options={[{ value: "one_time", label: "لمرة واحدة" }, { value: "performance", label: "أداء" }, { value: "sales", label: "مبيعات" }, { value: "annual", label: "سنوية" }, { value: "custom", label: "مخصصة" }]} />
            <TextField name="title" label="البيان" required />
            <TextField name="amount" label="المبلغ" required inputMode="decimal" />
            <SelectField name="currency" label="العملة" options={currencies.map((c) => ({ value: c, label: c }))} defaultValue="EGP" />
            <TextField name="pay_period" label="شهر الصرف" type="month" required defaultValue={defaultPeriod} />
          </>)}
          <TextAreaField name="reason" label="السبب" required rows={2} />
          {actions(<SubmitButton label="إرسال للاعتماد" />)}
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function CancelBonusButton({ id }: { id: string }) {
  return <ConfirmButton label="إلغاء" className="admin-btn small ghost" message="إلغاء المكافأة." requireReason action={(r) => cancelBonusAction(id, r)} />;
}

export function LoanButton({ employees, fixedEmployeeId, currencies, defaultPeriod, label = "طلب سلفة / قرض" }: { employees: Opt[]; fixedEmployeeId?: string; currencies: string[]; defaultPeriod: string; label?: string }) {
  const [type, setType] = useState("advance");
  const [amount, setAmount] = useState("");
  const [n, setN] = useState("1");
  const per = Number(amount) > 0 && Number(n) > 0 ? (Number(amount) / Number(n)).toFixed(2) : null;
  return (
    <ModalButton label={label} title="سلفة راتب / قرض موظف" className="admin-btn small">
      {(close) => (
        <ActionForm action={requestLoanAction} onSuccess={close}>
          {fixedEmployeeId ? <input type="hidden" name="employee_id" value={fixedEmployeeId} /> : null}
          {grid(<>
            {!fixedEmployeeId ? <SelectField name="employee_id" label="الموظف" required placeholder="اختر..." options={employees} /> : null}
            <SelectField name="loan_type" label="النوع" value={type} onChange={(e) => setType(e.target.value)} options={[{ value: "advance", label: "سلفة راتب (حتى 3 أشهر)" }, { value: "loan", label: "قرض" }]} />
            <TextField name="amount" label="المبلغ" required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <SelectField name="currency" label="العملة" options={currencies.map((c) => ({ value: c, label: c }))} defaultValue="EGP" />
            <TextField name="installments" label="عدد الأقساط" required inputMode="numeric" value={n} onChange={(e) => setN(e.target.value)} />
            <TextField name="start_period" label="أول شهر خصم" type="month" required defaultValue={defaultPeriod} />
          </>)}
          {per ? <p className="bos-faint" style={{ fontSize: 12.5 }}><Tx vars={{ per }}>{"القسط الشهري ≈ {per} — يُخصم تلقائياً من الراتب."}</Tx></p> : null}
          <TextAreaField name="reason" label="السبب" required rows={2} />
          {actions(<SubmitButton label="إرسال للاعتماد" />)}
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function LoanSteps({ id, status, canFinance, canCancel }: { id: string; status: string; canFinance: boolean; canCancel: boolean }) {
  return (
    <span className="bos-row" style={{ gap: 4 }}>
      {status === "approved" && canFinance ? <ConfirmButton label="تسجيل الصرف" className="admin-btn small success" confirmLabel="تم الصرف" message="بعد الصرف تبدأ الأقساط في الخصم من الرواتب حسب الجدول." requireReason reasonLabel="مرجع الصرف" action={(r) => loanStepAction(id, "disburse", r)} /> : null}
      {["pending", "approved"].includes(status) && canCancel ? <ConfirmButton label="إلغاء" className="admin-btn small ghost" message="إلغاء الطلب." requireReason action={(r) => loanStepAction(id, "cancel", r)} /> : null}
    </span>
  );
}

export function InstallmentActions({ id }: { id: string }) {
  return (
    <span className="bos-row" style={{ gap: 4 }}>
      <ConfirmButton label="سداد يدوي" className="admin-btn small ghost" confirmLabel="تأكيد" message="تسجيل سداد القسط خارج الراتب." requireReason reasonLabel="ملاحظة" action={(r) => settleInstallmentAction(id, "paid_manually", r)} />
      <ConfirmButton label="تأجيل" className="admin-btn small ghost" confirmLabel="تأجيل" message="تأجيل القسط وكل ما بعده شهراً." requireReason reasonLabel="ملاحظة" action={(r) => settleInstallmentAction(id, "skipped", r)} />
      <ConfirmButton label="إعفاء" className="admin-btn small ghost" confirmLabel="إعفاء" message="إعفاء الموظف من هذا القسط." requireReason reasonLabel="ملاحظة" action={(r) => settleInstallmentAction(id, "waived", r)} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Expense claims, other requests
// ---------------------------------------------------------------------------

export function ExpenseClaimButton({ employees, fixedEmployeeId, categories, currencies, projects, label = "+ مصروف" }: { employees: Opt[]; fixedEmployeeId?: string; categories: Opt[]; currencies: string[]; projects: Opt[]; label?: string }) {
  const [createdId, setCreatedId] = useState<string | null>(null);
  return (
    <ModalButton label={label} title="تقديم مصروف للاسترداد" className="admin-btn small">
      {(close) =>
        createdId ? (
          <div className="bos-stack">
            <p style={{ fontSize: 13 }}><Tx>تم إرسال المصروف للمدير ثم المالية. أرفق الإيصال:</Tx></p>
            <FileUploader entityType="expense" entityId={createdId} label="رفع الإيصال" />
            {actions(<button type="button" className="admin-btn small secondary" onClick={() => { setCreatedId(null); close(); }}><Tx>تم</Tx></button>)}
          </div>
        ) : (
          <ActionForm action={submitExpenseClaimAction as (s: ActionState, f: FormData) => Promise<ActionState>} onSuccess={(s) => setCreatedId((s as { data?: { id: string } }).data?.id ?? null)}>
            {fixedEmployeeId ? <input type="hidden" name="employee_id" value={fixedEmployeeId} /> : null}
            {grid(<>
              {!fixedEmployeeId ? <SelectField name="employee_id" label="الموظف" required placeholder="اختر..." options={employees} /> : null}
              <SelectField name="category_id" label="الفئة" required placeholder="اختر..." options={categories} />
              <SelectField name="expense_kind" label="النوع" placeholder="—" options={[{ value: "transportation", label: "مواصلات" }, { value: "business_trip", label: "مهمة عمل / سفر" }, { value: "client_meeting", label: "اجتماع عميل" }, { value: "meals", label: "وجبات" }, { value: "purchases", label: "مشتريات" }, { value: "other", label: "أخرى" }]} />
              <TextField name="description" label="الوصف" required />
              <TextField name="amount" label="المبلغ" required inputMode="decimal" />
              <SelectField name="currency" label="العملة" options={currencies.map((c) => ({ value: c, label: c }))} defaultValue="EGP" />
              <TextField name="expense_date" label="التاريخ" type="date" required />
              <SelectField name="project_id" label="مشروع (اختياري)" placeholder="—" options={projects} />
            </>)}
            {actions(<SubmitButton label="إرسال" />)}
          </ActionForm>
        )
      }
    </ModalButton>
  );
}

export function ReimburseButton({ id }: { id: string }) {
  return <ConfirmButton label="استرداد مباشر" className="admin-btn small secondary" confirmLabel="تم الاسترداد" message="تسجيل استرداد المبلغ للموظف خارج الراتب." requireReason reasonLabel="مرجع التحويل" action={(r) => reimburseAction(id, r)} />;
}

export function HrRequestButton({ employees, fixedEmployeeId, types, label = "+ طلب" }: { employees: Opt[]; fixedEmployeeId?: string; types: Opt[]; label?: string }) {
  return (
    <ModalButton label={label} title="طلب موارد بشرية" className="admin-btn small">
      {(close) => (
        <ActionForm action={submitHrRequestAction} onSuccess={close}>
          {fixedEmployeeId ? <input type="hidden" name="employee_id" value={fixedEmployeeId} /> : null}
          {grid(<>
            {!fixedEmployeeId ? <SelectField name="employee_id" label="الموظف" required placeholder="اختر..." options={employees} /> : null}
            <SelectField name="type_id" label="نوع الطلب" required placeholder="اختر..." options={types} />
            <TextField name="subject" label="الموضوع" required />
            <TextField name="due_date" label="مطلوب قبل" type="date" />
          </>)}
          <TextAreaField name="details" label="التفاصيل" rows={3} />
          {actions(<SubmitButton label="إرسال" />)}
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function HrRequestSteps({ id, status, canManage, isOwner }: { id: string; status: string; canManage: boolean; isOwner: boolean }) {
  return (
    <span className="bos-row" style={{ gap: 4 }}>
      {canManage && status === "approved" ? <ActionButton label="بدء التنفيذ" className="admin-btn small ghost" action={() => progressHrRequestAction(id, "in_progress")} /> : null}
      {canManage && ["approved", "in_progress"].includes(status) ? <ConfirmButton label="إكمال" className="admin-btn small success" confirmLabel="إكمال" message="إبلاغ الموظف باكتمال الطلب." requireReason reasonLabel="الرد" action={(r) => progressHrRequestAction(id, "completed", r)} /> : null}
      {(canManage || (isOwner && status === "pending")) && ["pending", "approved", "in_progress"].includes(status) ? <ConfirmButton label="إلغاء" className="admin-btn small ghost" message="إلغاء الطلب." action={() => progressHrRequestAction(id, "cancelled")} /> : null}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------

export function GoalButton({ users, fixedUserId, kpis, cycles, initial, label }: { users: Opt[]; fixedUserId?: string; kpis: Opt[]; cycles: Opt[]; initial?: Record<string, string | number | null>; label?: string }) {
  const v = (k: string) => (initial?.[k] == null ? "" : String(initial[k]));
  return (
    <ModalButton label={label ?? (initial ? "تعديل" : "+ هدف")} title={initial ? "تعديل الهدف" : "هدف جديد"} className={initial ? "admin-btn small ghost" : "admin-btn small"}>
      {(close) => (
        <ActionForm action={saveGoalAction} onSuccess={close}>
          {initial ? <input type="hidden" name="id" value={v("id")} /> : null}
          {fixedUserId || initial ? <input type="hidden" name="user_id" value={fixedUserId ?? v("user_id")} /> : null}
          {grid(<>
            {!fixedUserId && !initial ? <SelectField name="user_id" label="الموظف" required placeholder="اختر..." options={users} /> : null}
            <TextField name="title" label="الهدف" required defaultValue={v("title")} span={2} />
            <TextField name="metric" label="المقياس" defaultValue={v("metric")} />
            <TextField name="target_value" label="المستهدف" inputMode="decimal" defaultValue={v("target_value")} />
            <TextField name="unit" label="الوحدة" defaultValue={v("unit")} />
            <TextField name="weight" label="الوزن %" inputMode="decimal" defaultValue={v("weight")} />
            <TextField name="start_date" label="البداية" type="date" defaultValue={v("start_date")} />
            <TextField name="due_date" label="الاستحقاق" type="date" defaultValue={v("due_date")} />
            <SelectField name="kpi_id" label="مرتبط بمؤشر" placeholder="—" options={kpis} defaultValue={v("kpi_id")} />
            <SelectField name="cycle_id" label="دورة التقييم" placeholder="—" options={cycles} defaultValue={v("cycle_id")} />
          </>)}
          <TextAreaField name="description" label="الوصف" rows={2} defaultValue={v("description")} />
          {actions(<SubmitButton />)}
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function GoalProgressButton({ goal }: { goal: { id: string; current_value: number | null; progress: number; status: string; target_value: number | null } }) {
  return (
    <ModalButton label="تحديث التقدم" title="تقدم الهدف" className="admin-btn small ghost">
      {(close) => (
        <ActionForm action={goalProgressAction} onSuccess={close}>
          <input type="hidden" name="id" value={goal.id} />
          {grid(<>
            {goal.target_value != null ? <TextField name="current_value" label={`القيمة الحالية (من ${goal.target_value})`} inputMode="decimal" defaultValue={goal.current_value != null ? String(goal.current_value) : ""} /> : null}
            <TextField name="progress" label="نسبة التقدم %" inputMode="numeric" defaultValue={String(goal.progress)} />
            <SelectField name="status" label="الحالة" defaultValue={goal.status} options={[{ value: "not_started", label: "لم يبدأ" }, { value: "on_track", label: "على المسار" }, { value: "at_risk", label: "معرض للخطر" }, { value: "off_track", label: "خارج المسار" }, { value: "completed", label: "مكتمل" }, { value: "cancelled", label: "ملغي" }]} />
          </>)}
          {actions(<SubmitButton />)}
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function CycleButton({ initial }: { initial?: { id: string; name: string; cycle_type: string; period_start: string; period_end: string; self_assessment: boolean; peer_feedback: boolean } }) {
  return (
    <ModalButton label={initial ? "تعديل" : "+ دورة تقييم"} title="دورة تقييم الأداء" className={initial ? "admin-btn small ghost" : "admin-btn small"}>
      {(close) => (
        <ActionForm action={saveCycleAction} onSuccess={close}>
          {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
          {grid(<>
            <TextField name="name" label="الاسم" required defaultValue={initial?.name ?? ""} />
            <SelectField name="cycle_type" label="النوع" defaultValue={initial?.cycle_type ?? "annual"} options={[{ value: "annual", label: "سنوية" }, { value: "semi_annual", label: "نصف سنوية" }, { value: "quarterly", label: "ربع سنوية" }, { value: "probation", label: "نهاية فترة الاختبار" }, { value: "ad_hoc", label: "خاصة" }]} />
            <TextField name="period_start" label="من" type="date" required defaultValue={initial?.period_start ?? ""} />
            <TextField name="period_end" label="إلى" type="date" required defaultValue={initial?.period_end ?? ""} />
          </>)}
          <CheckboxField name="self_assessment" label="تقييم ذاتي" defaultChecked={initial?.self_assessment ?? true} />
          <CheckboxField name="peer_feedback" label="تقييم 360 (زملاء)" defaultChecked={initial?.peer_feedback ?? false} />
          {actions(<SubmitButton />)}
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function CycleStatusButtons({ id, status }: { id: string; status: string }) {
  return (
    <span className="bos-row" style={{ gap: 4 }}>
      {status === "draft" ? <ConfirmButton label="تفعيل" className="admin-btn small success" confirmLabel="تفعيل" message="سيتم إنشاء مراجعة (مسودة) لكل موظف نشط، والمراجِع هو المدير المباشر." action={() => setCycleStatusAction(id, "active")} /> : null}
      {status === "active" ? <ConfirmButton label="إغلاق" className="admin-btn small ghost" message="إغلاق الدورة." action={() => setCycleStatusAction(id, "closed")} /> : null}
    </span>
  );
}

export function SelfAssessmentButton({ reviewId, initial }: { reviewId: string; initial: { self_assessment: string | null; self_rating: number | null } }) {
  return (
    <ModalButton label={initial.self_assessment ? "تعديل تقييمي الذاتي" : "التقييم الذاتي"} title="التقييم الذاتي" className="admin-btn small">
      {(close) => (
        <ActionForm action={selfAssessmentAction} onSuccess={close}>
          <input type="hidden" name="review_id" value={reviewId} />
          <SelectField name="self_rating" label="تقييمي العام" placeholder="—" options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} / 5` }))} defaultValue={initial.self_rating ? String(initial.self_rating) : ""} />
          <TextAreaField name="self_assessment" label="الإنجازات، التحديات، الأهداف القادمة" required rows={6} defaultValue={initial.self_assessment ?? ""} />
          {actions(<SubmitButton label="إرسال" />)}
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function RequestFeedbackButton({ subjectUserId, people, cycles }: { subjectUserId: string; people: Opt[]; cycles: Opt[] }) {
  return (
    <ModalButton label="طلب تقييم 360" title="طلب تقييم من الزملاء" className="admin-btn small secondary">
      {(close) => (
        <ActionForm action={requestFeedbackAction} onSuccess={close}>
          <input type="hidden" name="subject_user_id" value={subjectUserId} />
          {grid(<>
            <SelectField name="relationship" label="العلاقة" options={[{ value: "peer", label: "زميل" }, { value: "manager", label: "مدير" }, { value: "direct_report", label: "مرؤوس" }, { value: "other", label: "آخر" }]} />
            <SelectField name="cycle_id" label="الدورة" placeholder="—" options={cycles} />
          </>)}
          <div className="bos-field span-all">
            <label><Tx>من *</Tx></label>
            <div className="bos-row" style={{ gap: 10, flexWrap: "wrap", maxHeight: 180, overflowY: "auto" }}>{people.filter((p) => p.value !== subjectUserId).map((p) => <label key={p.value} className="bos-check"><input type="checkbox" name="from_user_ids[]" value={p.value} /><Tx>{p.label}</Tx></label>)}</div>
          </div>
          {actions(<SubmitButton label="إرسال الطلبات" />)}
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function AnswerFeedbackButton({ id, subjectName }: { id: string; subjectName: string }) {
  return (
    <ModalButton label="تقديم التقييم" title={<Tx vars={{ subjectName }}>{"تقييم: {subjectName}"}</Tx>} className="admin-btn small">
      {(close) => (
        <ActionForm action={submitPerformanceFeedbackAction} onSuccess={close}>
          <input type="hidden" name="id" value={id} />
          <SelectField name="rating" label="التقييم العام" placeholder="—" options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} / 5` }))} />
          <TextAreaField name="strengths" label="نقاط القوة" rows={3} />
          <TextAreaField name="improvements" label="فرص التحسين" rows={3} />
          <TextAreaField name="comments" label="ملاحظات أخرى" rows={2} />
          <CheckboxField name="is_anonymous" label="إخفاء اسمي عن الموظف" />
          <CheckboxField name="decline" label="أعتذر عن التقييم" />
          {actions(<SubmitButton label="إرسال" />)}
        </ActionForm>
      )}
    </ModalButton>
  );
}
