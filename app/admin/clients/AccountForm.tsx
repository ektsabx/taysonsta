"use client";

import type { ActionState } from "@/lib/bos/action";
import { ActionForm, CheckboxField, FormSection, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";

export interface AccountFormValues {
  name?: string;
  company_name?: string | null;
  email?: string;
  phone?: string | null;
  website?: string | null;
  country?: string | null;
  city?: string | null;
  address?: string | null;
  industry?: string | null;
  tax_id?: string | null;
  account_manager_id?: string | null;
  account_status?: string;
  default_currency?: string | null;
  notes?: string | null;
}

export const accountStatusOptions = [
  { value: "prospect", label: "محتمل" },
  { value: "active", label: "نشط" },
  { value: "inactive", label: "غير نشط" },
  { value: "churned", label: "فُقد" },
];

export function AccountForm({
  action,
  initial = {},
  staff,
  currencies,
  canAssign,
  isNew,
  submitLabel = "حفظ",
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: AccountFormValues;
  staff: { value: string; label: string }[];
  currencies: string[];
  canAssign: boolean;
  isNew?: boolean;
  submitLabel?: string;
}) {
  return (
    <ActionForm action={action}>
      <FormSection title="الحساب">
        <div className="bos-form-grid">
          <TextField name="company_name" label="اسم الشركة" defaultValue={initial.company_name ?? ""} maxLength={200} />
          <TextField name="name" label="اسم العميل / الحساب" required defaultValue={initial.name ?? ""} maxLength={200} />
          <TextField name="email" label="البريد الإلكتروني" type="email" required defaultValue={initial.email ?? ""} hint="يُستخدم لمنع تكرار الحسابات" />
          <TextField name="phone" label="الهاتف" defaultValue={initial.phone ?? ""} dir="ltr" />
          <TextField name="website" label="الموقع الإلكتروني" defaultValue={initial.website ?? ""} dir="ltr" />
          <TextField name="industry" label="المجال" defaultValue={initial.industry ?? ""} />
          <TextField name="country" label="الدولة" defaultValue={initial.country ?? ""} />
          <TextField name="city" label="المدينة" defaultValue={initial.city ?? ""} />
          <TextField name="address" label="العنوان" defaultValue={initial.address ?? ""} span={2} />
          <TextField name="tax_id" label="الرقم الضريبي" defaultValue={initial.tax_id ?? ""} />
          <SelectField name="default_currency" label="العملة الافتراضية" placeholder="—" options={currencies.map((c) => ({ value: c, label: c }))} defaultValue={initial.default_currency ?? ""} />
          <SelectField name="account_status" label="حالة الحساب" options={accountStatusOptions} defaultValue={initial.account_status ?? "prospect"} />
          <SelectField name="account_manager_id" label="مدير الحساب" placeholder="— بدون —" options={staff} defaultValue={initial.account_manager_id ?? ""} disabled={!canAssign} hint={canAssign ? undefined : "يحدد مدير الحساب المسؤولون المخوّلون بالتعيين فقط"} />
        </div>
      </FormSection>
      {isNew ? (
        <FormSection title="جهة الاتصال الرئيسية">
          <div className="bos-form-grid">
            <TextField name="contact_name" label="اسم جهة الاتصال" hint="إذا تُرك فارغاً يُستخدم اسم العميل" />
            <TextField name="contact_position" label="المنصب" />
          </div>
          <CheckboxField name="allow_duplicate" label="إنشاء رغم تشابه اسم الشركة مع حساب موجود" hint="لا يمكن تجاوز تكرار البريد الإلكتروني." />
        </FormSection>
      ) : null}
      <FormSection title="ملاحظات">
        <TextAreaField name="notes" label="ملاحظات داخلية" defaultValue={initial.notes ?? ""} rows={4} />
      </FormSection>
      <div className="bos-form-actions">
        <SubmitButton label={submitLabel} />
      </div>
    </ActionForm>
  );
}
