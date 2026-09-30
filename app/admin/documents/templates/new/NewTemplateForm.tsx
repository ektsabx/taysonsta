"use client";

import { useRouter } from "next/navigation";
import { Tx } from "@/components/bos/I18n";
import { ActionForm, SelectField, SubmitButton, TextField } from "@/components/bos/Form";
import { createTemplateAction } from "../../actions";

export function NewTemplateForm({ types }: { types: { value: string; label: string }[] }) {
  const router = useRouter();
  return (
    <ActionForm action={createTemplateAction} onSuccess={(s) => s.ok && s.data && router.push(`/admin/documents/templates/${(s.data as { id: string }).id}`)} successMessage="تم الإنشاء">
      <div className="bos-form-grid">
        <TextField name="key" label="المفتاح" required dir="ltr" placeholder="client_contract_custom_ar" hint="حروف إنجليزية صغيرة وأرقام و _ — لا يتغير بعد الإنشاء" />
        <TextField name="name" label="الاسم" required />
        <SelectField name="doc_type" label="النوع" options={types} required />
        <SelectField name="language" label="اللغة" options={[{ value: "ar", label: "العربية" }, { value: "en", label: "English" }]} required />
        <TextField name="subject" label="موضوع البريد (لقوالب البريد فقط)" />
      </div>
      <div className="bos-field span-all">
        <label htmlFor="f-body"><Tx>المحتوى</Tx></label>
        <textarea id="f-body" name="body" rows={16} className="bos-code" dir="auto" required defaultValue={"# {{doc.title}}\n\n**{{company.legal_name}}**\n\n"} />
      </div>
      <input type="hidden" name="primary" value="#e51f26" />
      <input type="hidden" name="accent" value="#111827" />
      <input type="hidden" name="font_size" value="11" />
      <input type="hidden" name="show_logo" value="on" />
      <div className="bos-form-actions"><SubmitButton label="إنشاء القالب" /></div>
    </ActionForm>
  );
}
