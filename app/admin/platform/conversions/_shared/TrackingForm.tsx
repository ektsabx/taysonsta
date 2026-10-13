"use client";

import { ActionForm, FormSection, SubmitButton, TextField } from "@/components/bos/Form";
import { saveTrackingAction } from "../actions";

// When a quiet checkout counts as abandoned (D-212).
export function TrackingForm({ abandon, result }: { abandon: number; result: number }) {
  return (
    <ActionForm action={saveTrackingAction} successMessage="تم الحفظ" guardUnsaved={false}>
      <FormSection>
        <TextField name="abandon_minutes" label="مدة عدم النشاط قبل اعتبار Checkout متروكًا (دقائق)" type="number" min={5} max={10080} defaultValue={String(abandon)} required />
        <TextField name="result_minutes" label="مهلة انتظار نتيجة الدفع بعد الانتقال للبوابة (دقائق)" type="number" min={15} max={10080} defaultValue={String(result)} required hint="لا تُعتبر العملية متروكة قبل انتهاء هذه المهلة إذا كان الدفع قد يكون قيد المعالجة." />
      </FormSection>
      <SubmitButton label="حفظ" />
    </ActionForm>
  );
}
