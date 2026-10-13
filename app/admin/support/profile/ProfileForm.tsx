"use client";

import { ActionForm, CheckboxField, SubmitButton, TextField } from "@/components/bos/Form";
import { agentProfileAction } from "./actions";

export function ProfileForm({ displayName, showPhoto, defaultName }: { displayName: string; showPhoto: boolean; defaultName: string }) {
  return (
    <ActionForm action={agentProfileAction} successMessage="تم الحفظ">
      <div className="bos-form-grid">
        <TextField name="displayName" label="الاسم الظاهر للعملاء" defaultValue={displayName} placeholder={defaultName} maxLength={60} hint={`إذا تركته فارغًا يظهر: ${defaultName}`} />
      </div>
      <CheckboxField name="showPhoto" label="أظهر صورتي للعملاء في محادثات الدعم" defaultChecked={showPhoto} hint="صورتك من ملفك الوظيفي. بدونها يظهر الحرفان الأولان من اسمك." />
      <SubmitButton />
    </ActionForm>
  );
}
