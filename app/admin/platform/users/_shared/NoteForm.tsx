"use client";

import { ActionForm, SubmitButton, TextAreaField } from "@/components/bos/Form";
import { addNoteAction } from "../actions";

// Internal note on an account (or one of its checkouts). Never shown to the member.
export function NoteForm({ id, checkoutId }: { id: string; checkoutId?: string }) {
  return (
    <ActionForm action={addNoteAction} successMessage="تمت إضافة الملاحظة" resetOnSuccess guardUnsaved={false}>
      <input type="hidden" name="id" value={id} />
      {checkoutId ? <input type="hidden" name="checkout_id" value={checkoutId} /> : null}
      <TextAreaField name="body" label="ملاحظة داخلية (لا تظهر للمستخدم)" required maxLength={4000} />
      <SubmitButton label="إضافة ملاحظة" />
    </ActionForm>
  );
}
