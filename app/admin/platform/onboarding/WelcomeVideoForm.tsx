"use client";

import { ActionForm, CheckboxField, FormSection, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { setWelcomeVideoAction } from "./actions";

export function WelcomeVideoForm({ value }: { value: { enabled: boolean; url: string; title: string; description: string } }) {
  return (
    <ActionForm action={setWelcomeVideoAction} successMessage="تم الحفظ">
      <FormSection>
        <CheckboxField name="enabled" label="عرض الفيديو للمستخدمين بعد تسجيل الدخول" defaultChecked={value.enabled} />
        <TextField name="url" label="رابط الفيديو" defaultValue={value.url} dir="ltr" placeholder="https://www.youtube.com/watch?v=…" span={2} hint="YouTube أو Vimeo أو Loom، أو رابط مباشر لملف ‎.mp4 / .webm (https)." />
        <TextField name="title" label="العنوان (اختياري)" defaultValue={value.title} maxLength={200} hint="فارغ = «What's This Video?»" />
        <TextAreaField name="description" label="النص التعريفي (اختياري)" defaultValue={value.description} maxLength={600} rows={3} hint="فارغ = «Learn how to use Yolias.»" />
      </FormSection>
      <SubmitButton />
    </ActionForm>
  );
}
