"use client";

import { ActionForm, CheckboxField, FormSection, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { deleteAction, enrichAction, licenseAction } from "../actions";

export function LicenseForm({ d }: { d: { id: string; name: string; vendor: string | null; source_url: string | null; license_name: string | null; customer_facing: boolean; redistributable: boolean; attribution: string | null; retention_days: number | null; notes: string | null } }) {
  return (
    <ActionForm action={licenseAction} successMessage="تم الحفظ">
      <input type="hidden" name="id" value={d.id} />
      <FormSection>
        <TextField name="name" label="اسم البيانات" required defaultValue={d.name} maxLength={200} span={2} />
        <TextField name="vendor" label="المورد / الجهة" defaultValue={d.vendor ?? ""} maxLength={200} />
        <TextField name="source_url" label="رابط المصدر" type="url" dir="ltr" defaultValue={d.source_url ?? ""} />
        <TextField name="license_name" label="اسم الترخيص أو العقد" defaultValue={d.license_name ?? ""} maxLength={200} span={2} />
        <CheckboxField name="customer_facing" label="مسموح عرضها وتسليمها للعملاء" defaultChecked={d.customer_facing} />
        <CheckboxField name="redistributable" label="مسموح استخدامها لكل العملاء (وليس لعميل واحد)" defaultChecked={d.redistributable} />
        <TextField name="attribution" label="نص الإسناد المطلوب" defaultValue={d.attribution ?? ""} maxLength={500} span={2} />
        <TextField name="retention_days" label="مدة الاحتفاظ (أيام)" type="number" min={1} step={1} defaultValue={d.retention_days == null ? "" : String(d.retention_days)} />
        <TextAreaField name="notes" label="ملاحظات" rows={2} defaultValue={d.notes ?? ""} maxLength={4000} />
      </FormSection>
      <SubmitButton label="حفظ الترخيص" />
    </ActionForm>
  );
}

export function EnrichForm({ id, running }: { id: string; running: boolean }) {
  return (
    <ActionForm action={enrichAction} successMessage="بدأ الإثراء">
      <input type="hidden" name="id" value={id} />
      <SubmitButton label={running ? "متابعة الإثراء" : "ابدأ الإثراء من المواقع"} className="admin-btn secondary" />
    </ActionForm>
  );
}

export function DeleteForm({ id, name }: { id: string; name: string }) {
  return (
    <ActionForm action={deleteAction} successMessage="تم الحذف">
      <input type="hidden" name="id" value={id} />
      <FormSection>
        <TextField name="confirm" label="اكتب اسم البيانات للتأكيد" required placeholder={name} span={2} hint="يحذف كل القيم التي أضافتها هذه البيانات، والشركات والأشخاص الذين أنشأتهم ولا يعرفهم أي مصدر آخر. نسخ العملاء المسلَّمة لهم لا تتأثر. لا يمكن التراجع." />
      </FormSection>
      <SubmitButton label="حذف كل بيانات هذا المصدر" className="admin-btn danger" />
    </ActionForm>
  );
}
