"use client";

import { Tx } from "@/components/bos/I18n";

import { useState } from "react";
import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { ModalButton } from "@/components/bos/Dialog";
import { createActivityAction } from "@/app/admin/sales/activities/actions";

export interface RelatedIds {
  lead_id?: string | null;
  deal_id?: string | null;
  client_id?: string | null;
  contact_id?: string | null;
}

const types = [
  { value: "call", label: "مكالمة" },
  { value: "email", label: "بريد إلكتروني" },
  { value: "whatsapp", label: "واتساب" },
  { value: "linkedin", label: "لينكدإن" },
  { value: "meeting", label: "اجتماع (تم)" },
  { value: "follow_up", label: "متابعة" },
  { value: "task", label: "مهمة" },
  { value: "note", label: "ملاحظة" },
  { value: "internal", label: "نشاط داخلي" },
  { value: "client_communication", label: "تواصل مع العميل" },
];

function ActivityFields({ related, staff, defaultType, onDone }: { related: RelatedIds; staff: { value: string; label: string }[]; defaultType: string; onDone: () => void }) {
  const [type, setType] = useState(defaultType);
  const [mode, setMode] = useState<"log" | "schedule">(["follow_up", "task"].includes(defaultType) ? "schedule" : "log");
  const isComm = ["call", "email", "whatsapp", "linkedin", "client_communication", "meeting"].includes(type);

  return (
    <ActionForm action={createActivityAction} onSuccess={onDone} guardUnsaved={false}>
      {Object.entries(related).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <div className="bos-form-grid">
        <SelectField name="type" label="النوع" options={types} value={type} onChange={(e) => {
          setType(e.target.value);
          if (["follow_up", "task"].includes(e.target.value)) setMode("schedule");
        }} />
        <div className="bos-field">
          <label><Tx>الحالة</Tx></label>
          <div className="bos-row" style={{ minHeight: 36 }}>
            <label className="bos-check">
              <input type="radio" checked={mode === "log"} onChange={() => setMode("log")} /> <Tx>تم (تسجيل)</Tx>
            </label>
            <label className="bos-check">
              <input type="radio" checked={mode === "schedule"} onChange={() => setMode("schedule")} /> <Tx>مجدول</Tx>
            </label>
          </div>
          <input type="hidden" name="status" value={mode === "log" ? "completed" : "pending"} />
        </div>
        <TextField name="title" label="العنوان" required span="all" placeholder={isComm ? "مثال: مكالمة تعريفية" : "مثال: إرسال عرض السعر"} />
        {isComm ? (
          <SelectField
            name="direction"
            label="الاتجاه"
            options={[
              { value: "outbound", label: "صادر (نحن تواصلنا)" },
              { value: "inbound", label: "وارد (العميل تواصل/رد)" },
            ]}
            defaultValue="outbound"
          />
        ) : (
          <input type="hidden" name="direction" value={type === "internal" ? "internal" : ""} />
        )}
        {mode === "schedule" ? (
          <>
            <TextField name="due_at" label="موعد الاستحقاق" type="datetime-local" required />
            <TextField name="reminder_at" label="تذكير" type="datetime-local" />
            <SelectField name="assigned_to" label="المسؤول" options={staff} placeholder="أنا" />
            <SelectField
              name="priority"
              label="الأولوية"
              options={[
                { value: "low", label: "منخفضة" },
                { value: "medium", label: "متوسطة" },
                { value: "high", label: "عالية" },
                { value: "urgent", label: "عاجلة" },
              ]}
              defaultValue="medium"
            />
          </>
        ) : (
          <TextField name="outcome" label="النتيجة" span={2} />
        )}
        <TextAreaField name="description" label="التفاصيل" />
      </div>
      <div className="bos-form-actions">
        <SubmitButton label={mode === "log" ? "تسجيل النشاط" : "جدولة"} />
      </div>
    </ActionForm>
  );
}

export function ActivityComposer({
  related,
  staff,
  label = "+ نشاط",
  defaultType = "call",
  className = "admin-btn small secondary",
}: {
  related: RelatedIds;
  staff: { value: string; label: string }[];
  label?: string;
  defaultType?: string;
  className?: string;
}) {
  return (
    <ModalButton label={label} title="إضافة نشاط" className={className} wide>
      {(close) => <ActivityFields related={related} staff={staff} defaultType={defaultType} onDone={close} />}
    </ModalButton>
  );
}
