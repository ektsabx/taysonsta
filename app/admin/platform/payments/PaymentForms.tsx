"use client";

import { ActionForm, CheckboxField, FormSection, SubmitButton, TextField } from "@/components/bos/Form";
import { savePackAction } from "./actions";

export function PackForm({ p }: { p?: { id: string; prospects: number; price_usd: number; active: boolean; sort: number } }) {
  return (
    <ActionForm action={savePackAction} successMessage="تم الحفظ" resetOnSuccess={!p}>
      {p && <input type="hidden" name="id" value={p.id} />}
      <FormSection>
        <TextField name="prospects" label="عدد العملاء المحتملين" type="number" min={1} step={1} required defaultValue={p ? String(p.prospects) : ""} />
        <TextField name="price_usd" label="السعر (USD)" type="number" min={0.01} step={0.01} required defaultValue={p ? String(p.price_usd) : ""} />
        <TextField name="sort" label="الترتيب" type="number" step={1} defaultValue={p ? String(p.sort) : "0"} />
        <CheckboxField name="active" label="معروضة للعملاء" defaultChecked={p ? p.active : true} />
      </FormSection>
      <SubmitButton label={p ? "حفظ" : "إضافة باقة"} />
    </ActionForm>
  );
}
