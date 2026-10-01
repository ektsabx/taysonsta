"use client";

import { ActionForm, FormSection, SelectField, SubmitButton, TextField } from "@/components/bos/Form";
import { addSuppressionAction, markDistinctAction, removeSuppressionAction } from "./actions";

export function AddSuppressionForm() {
  return (
    <ActionForm action={addSuppressionAction} successMessage="تمت الإضافة" resetOnSuccess guardUnsaved={false}>
      <FormSection>
        <SelectField name="kind" label="النوع" required options={[{ value: "email", label: "بريد إلكتروني" }, { value: "domain", label: "نطاق" }, { value: "linkedin", label: "LinkedIn" }]} />
        <TextField name="value" label="القيمة" required span={2} dir="ltr" />
        <TextField name="reason" label="السبب" span={2} hint="مثال: طلب عدم التواصل أو الحذف." />
      </FormSection>
      <SubmitButton label="إضافة إلى القائمة" />
    </ActionForm>
  );
}

export function RemoveButton({ id }: { id: string }) {
  return (
    <ActionForm action={removeSuppressionAction} successMessage="تم الحذف" guardUnsaved={false} className="">
      <input type="hidden" name="id" value={id} />
      <SubmitButton label="حذف" pendingLabel="..." className="admin-btn small secondary" />
    </ActionForm>
  );
}

export function DistinctButton({ id }: { id: string }) {
  return (
    <ActionForm action={markDistinctAction} successMessage="تم الحفظ" guardUnsaved={false} className="">
      <input type="hidden" name="id" value={id} />
      <SubmitButton label="شخصان مختلفان" pendingLabel="..." className="admin-btn small secondary" />
    </ActionForm>
  );
}
