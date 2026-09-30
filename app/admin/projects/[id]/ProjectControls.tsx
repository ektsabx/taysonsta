"use client";

import { Tx, Opt, useT } from "@/components/bos/I18n";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, ModalButton, ActionButton, ConfirmButton } from "@/components/bos/Dialog";
import { ActionForm, CheckboxField, MoneyField, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import {
  addMemberFormAction,
  changeProjectStatusAction,
  createChangeRequestAction,
  createTaskAction,
  logTimeAction,
  recordSatisfactionAction,
  requestFinalApprovalAction,
  requestMilestoneApprovalAction,
  saveIssueAction,
  saveMilestoneAction,
  setIssueStatusAction,
  setMemberAction,
  setMilestoneStatusAction,
  setTaskStatusAction,
} from "../actions";

type Opt = { value: string; label: string };

const statusLabels: Record<string, string> = {
  planning: "تخطيط", design: "تصميم", development: "تطوير", qa: "اختبار الجودة", client_review: "مراجعة العميل",
  launch: "إطلاق", completed: "مكتمل", on_hold: "معلّق", cancelled: "ملغي",
};

export function ProjectStatusControl({ projectId, status, allowed, blockers, canForce }: { projectId: string; status: string; allowed: string[]; blockers: string[]; canForce: boolean }) {
  const t = useT();
  const [target, setTarget] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function apply(to: string, force = false) {
    startTransition(async () => {
      const r = await changeProjectStatusAction(projectId, to as never, reason || undefined, force);
      if (!r.ok) setError(r.error);
      else {
        setError(null);
        setTarget(null);
        setReason("");
        router.refresh();
      }
    });
  }

  return (
    <div className="bos-stack" style={{ gap: 4 }}>
      <select
        aria-label={t("حالة المشروع")}
        value={status}
        disabled={pending || !allowed.length}
        onChange={(e) => {
          const to = e.target.value;
          if (to === "cancelled" || to === "completed" || to === "on_hold") setTarget(to);
          else apply(to);
        }}
        style={{ height: 34, background: "var(--bos-input)", color: "var(--bos-strong)", border: "1px solid rgba(var(--bos-fg-rgb), 0.14)", borderRadius: 7, padding: "0 8px" }}
      >
        <Opt value={status}>{statusLabels[status]}</Opt>
        {allowed.map((s) => (
          <option key={s} value={s}>
            {statusLabels[s]}
          </option>
        ))}
      </select>
      {error ? <span className="bos-field-error"><Tx>{error}</Tx></span> : null}
      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        title={target === "completed" ? "إكمال المشروع" : target === "cancelled" ? "إلغاء المشروع" : "تعليق المشروع"}
        footer={
          target === "completed" && blockers.length ? (
            canForce ? (
              <button type="button" className="admin-btn danger" disabled={pending || !reason.trim()} onClick={() => apply("completed", true)}>
                <Tx>تجاوز وإكمال (مع سبب)</Tx>
              </button>
            ) : null
          ) : (
            <button type="button" className={target === "cancelled" ? "admin-btn danger" : "admin-btn"} disabled={pending || (target === "cancelled" && !reason.trim())} onClick={() => target && apply(target)}>
              <Tx>تأكيد</Tx>
            </button>
          )
        }
      >
        {target === "completed" ? (
          blockers.length ? (
            <div className="bos-stack">
              <div className="bos-form-error">
                <Tx>لا يمكن إكمال المشروع قبل استيفاء الشروط التالية (§84):</Tx>
                <ul style={{ paddingInlineStart: 18, marginTop: 6 }}>
                  {blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
              {canForce ? (
                <div className="bos-field">
                  <label><Tx>سبب التجاوز (يُسجل في سجل التدقيق)</Tx></label>
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
              ) : null}
            </div>
          ) : (
            <p style={{ fontSize: 13.5 }}><Tx>كل الشروط مستوفاة. سيبدأ النظام فترة الدعم، ويرسل طلب تقييم الرضا للعميل، وينشئ مهمة مراجعة فرص البيع الإضافي لمدير الحساب.</Tx></p>
          )
        ) : (
          <div className="bos-field">
            <label>السبب{target === "cancelled" ? " (مطلوب)" : ""}</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        )}
        {error ? <div className="bos-form-error"><Tx>{error}</Tx></div> : null}
      </Modal>
    </div>
  );
}

export function FinalApprovalButton({ projectId }: { projectId: string }) {
  return <ActionButton label="طلب موافقة التسليم النهائي" className="admin-btn small secondary" action={() => requestFinalApprovalAction(projectId)} />;
}

export function SatisfactionForm({ projectId }: { projectId: string }) {
  return (
    <ActionForm action={recordSatisfactionAction.bind(null, projectId)} guardUnsaved={false}>
      <div className="bos-form-grid">
        <SelectField name="score" label="تقييم رضا العميل" options={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}/10` }))} defaultValue="9" />
        <TextAreaField name="comment" label="تعليق العميل" span={2} />
      </div>
      <SubmitButton label="تسجيل التقييم" className="admin-btn small" />
    </ActionForm>
  );
}

export function AddMemberButton({ projectId, staff }: { projectId: string; staff: Opt[] }) {
  return (
    <ModalButton label="+ عضو" title="إضافة عضو للفريق" className="admin-btn small secondary">
      {(close) => (
        <ActionForm action={addMemberFormAction.bind(null, projectId)} onSuccess={close} guardUnsaved={false}>
          <div className="bos-form-grid">
            <SelectField name="user_id" label="الموظف" required options={staff} placeholder="اختر" />
            <TextField name="role_label" label="الدور في المشروع" placeholder="Designer, Developer..." />
            <TextField name="allocation" label="نسبة التخصيص %" type="number" min={0} max={100} />
          </div>
          <SubmitButton label="إضافة" />
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function RemoveMemberButton({ projectId, userId }: { projectId: string; userId: string }) {
  return <ConfirmButton label="إزالة" className="admin-btn small ghost" message="إزالة العضو من المشروع وقناته؟ المهام المسندة إليه ستحتاج إعادة إسناد." action={() => setMemberAction(projectId, userId, null, null, true)} />;
}

export function MilestoneFormButton({ projectId, staff, milestone, label = "+ مرحلة" }: { projectId: string; staff: Opt[]; milestone?: { id: string; name: string; description: string | null; due_date: string | null; owner_id: string | null; deliverables: string | null; requires_client_approval: boolean }; label?: string }) {
  return (
    <ModalButton label={label} title={milestone ? "تعديل المرحلة" : "مرحلة جديدة"} className={milestone ? "admin-btn small ghost" : "admin-btn small secondary"} wide>
      {(close) => (
        <ActionForm action={saveMilestoneAction.bind(null, projectId, milestone?.id ?? null)} onSuccess={close} guardUnsaved={false}>
          <div className="bos-form-grid">
            <TextField name="name" label="اسم المرحلة" required defaultValue={milestone?.name ?? ""} />
            <TextField name="due_date" label="تاريخ الاستحقاق" type="date" defaultValue={milestone?.due_date ?? ""} />
            <SelectField name="owner_id" label="المسؤول" options={staff} placeholder="—" defaultValue={milestone?.owner_id ?? ""} />
            <CheckboxField name="requires_client_approval" label="تتطلب موافقة العميل" defaultChecked={milestone?.requires_client_approval} />
            <TextAreaField name="description" label="الوصف" defaultValue={milestone?.description ?? ""} />
            <TextAreaField name="deliverables" label="المخرجات" defaultValue={milestone?.deliverables ?? ""} />
          </div>
          <SubmitButton />
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function MilestoneStatusSelect({ id, status, requiresApproval, approvalStatus }: { id: string; status: string; requiresApproval: boolean; approvalStatus: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <span className="bos-stack" style={{ gap: 3 }}>
      <span className="bos-row" style={{ gap: 4 }}>
        <select
          value={status}
          disabled={pending}
          onChange={(e) =>
            startTransition(async () => {
              const r = await setMilestoneStatusAction(id, e.target.value as never);
              if (!r.ok) setError(r.error);
              else {
                setError(null);
                router.refresh();
              }
            })
          }
          style={{ height: 28, background: "var(--bos-input)", color: "var(--bos-strong)", border: "1px solid rgba(var(--bos-fg-rgb), 0.14)", borderRadius: 6, fontSize: 12 }}
        >
          <Opt value="not_started">لم تبدأ</Opt>
          <Opt value="in_progress">قيد التنفيذ</Opt>
          <Opt value="blocked">متوقفة</Opt>
          <Opt value="completed">مكتملة</Opt>
        </select>
        {requiresApproval && ["not_required", "rejected", "pending"].includes(approvalStatus) ? (
          <button
            type="button"
            className="admin-btn small ghost"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await requestMilestoneApprovalAction(id, "milestone");
                if (!r.ok) setError(r.error);
                else router.refresh();
              })
            }
          >
            <Tx>طلب موافقة العميل</Tx>
          </button>
        ) : null}
      </span>
      {error ? <span className="bos-field-error"><Tx>{error}</Tx></span> : null}
    </span>
  );
}

export function QuickTaskForm({ projectId, milestones, staff }: { projectId: string; milestones: Opt[]; staff: Opt[] }) {
  const t = useT();
  return (
    <ActionForm action={createTaskAction} resetOnSuccess guardUnsaved={false}>
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="stay" value="1" />
      <input type="hidden" name="is_required" value="on" />
      <div className="bos-repeater-row" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr auto" }}>
        <input name="title" placeholder={t("مهمة جديدة...")} required aria-label={t("عنوان المهمة")} />
        <select name="milestone_id" aria-label={t("المرحلة")} defaultValue="">
          <Opt value="">بدون مرحلة</Opt>
          {milestones.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <select name="assigned_to" aria-label={t("المسؤول")} defaultValue="">
          <Opt value="">غير معيّن</Opt>
          {staff.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <input name="due_date" type="date" aria-label={t("الاستحقاق")} />
        <SubmitButton label="إضافة" className="admin-btn small" />
      </div>
    </ActionForm>
  );
}

export function TaskStatusSelect({ id, status }: { id: string; status: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <span className="bos-stack" style={{ gap: 2 }}>
      <select
        value={status === "overdue" ? "overdue" : status}
        disabled={pending}
        onChange={(e) =>
          startTransition(async () => {
            const r = await setTaskStatusAction(id, e.target.value as never);
            if (!r.ok) setError(r.error);
            else {
              setError(null);
              router.refresh();
            }
          })
        }
        style={{ height: 28, background: "var(--bos-input)", color: "var(--bos-strong)", border: "1px solid rgba(var(--bos-fg-rgb), 0.14)", borderRadius: 6, fontSize: 12 }}
      >
        {status === "overdue" ? <Opt value="overdue" disabled>متأخرة</Opt> : null}
        <Opt value="pending">قيد الانتظار</Opt>
        <Opt value="in_progress">قيد التنفيذ</Opt>
        <Opt value="blocked">متوقفة</Opt>
        <Opt value="completed">مكتملة</Opt>
        <Opt value="cancelled">ملغاة</Opt>
      </select>
      {error ? <span className="bos-field-error" style={{ fontSize: 11 }}><Tx>{error}</Tx></span> : null}
    </span>
  );
}

export function IssueFormButton({ projectId, staff }: { projectId: string; staff: Opt[] }) {
  return (
    <ModalButton label="+ مشكلة" title="الإبلاغ عن مشكلة" className="admin-btn small secondary">
      {(close) => (
        <ActionForm action={saveIssueAction.bind(null, projectId, null)} onSuccess={close} guardUnsaved={false}>
          <div className="bos-form-grid">
            <TextField name="title" label="العنوان" required span="all" />
            <SelectField name="severity" label="الخطورة" options={[{ value: "low", label: "منخفضة" }, { value: "medium", label: "متوسطة" }, { value: "high", label: "عالية" }, { value: "critical", label: "حرجة" }]} defaultValue="medium" />
            <SelectField name="assigned_to" label="المسؤول" options={staff} placeholder="—" />
            <TextAreaField name="description" label="الوصف" />
          </div>
          <SubmitButton label="حفظ" />
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function IssueStatusSelect({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) => startTransition(async () => { await setIssueStatusAction(id, e.target.value as never); router.refresh(); })}
      style={{ height: 28, background: "var(--bos-input)", color: "var(--bos-strong)", border: "1px solid rgba(var(--bos-fg-rgb), 0.14)", borderRadius: 6, fontSize: 12 }}
    >
      <Opt value="open">مفتوحة</Opt>
      <Opt value="in_progress">قيد المعالجة</Opt>
      <Opt value="resolved">محلولة</Opt>
      <Opt value="closed">مغلقة</Opt>
    </select>
  );
}

export function LogTimeForm({ projectId, tasks, today }: { projectId: string; tasks: Opt[]; today: string }) {
  return (
    <ActionForm action={logTimeAction} resetOnSuccess guardUnsaved={false}>
      <input type="hidden" name="project_id" value={projectId} />
      <div className="bos-form-grid">
        <SelectField name="task_id" label="المهمة" options={tasks} placeholder="على المشروع عامة" />
        <TextField name="date" label="التاريخ" type="date" required defaultValue={today} />
        <TextField name="start_time" label="من" type="time" required />
        <TextField name="end_time" label="إلى" type="time" required />
        <TextField name="description" label="الوصف" span={2} />
        <CheckboxField name="billable" label="قابل للفوترة" defaultChecked />
      </div>
      <SubmitButton label="تسجيل الوقت" className="admin-btn small" />
    </ActionForm>
  );
}

export function ChangeRequestButton({ projectId, currencies, defaultCurrency, contacts }: { projectId: string; currencies: string[]; defaultCurrency: string; contacts: Opt[] }) {
  return (
    <ModalButton label="+ طلب تغيير" title="طلب تغيير جديد" className="admin-btn small secondary" wide>
      {() => (
        <ActionForm action={createChangeRequestAction.bind(null, projectId)}>
          <div className="bos-form-grid">
            <TextField name="title" label="الطلب" required span="all" />
            <SelectField name="requested_by_contact_id" label="طلبه (من العميل)" options={contacts} placeholder="—" />
            <MoneyField name="additional_cost" currencyName="currency" label="التكلفة الإضافية (تقديرية)" currencies={currencies} defaultCurrency={defaultCurrency} defaultValue="0" />
            <TextField name="additional_days" label="أيام إضافية" type="number" min={0} defaultValue="0" />
            <TextAreaField name="description" label="الوصف" />
            <TextAreaField name="reason" label="السبب" span={2} />
            <TextAreaField name="impact" label="الأثر على المشروع" span={2} />
          </div>
          <SubmitButton label="إنشاء الطلب" />
        </ActionForm>
      )}
    </ModalButton>
  );
}
