"use client";

import { ActionForm, CheckboxField, FormSection, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { Tx } from "@/components/bos/I18n";
import { clearCredentialAction, setCredentialAction, updateProviderAction, updateSettingAction } from "./actions";

export interface ProviderFormValues {
  id: string;
  enabled: boolean;
  priority: number;
  concurrency: number;
  rate_limit_per_min: number | null;
  burst: number | null;
  daily_budget_usd: number | null;
  monthly_budget_usd: number | null;
  fallback_to: string[];
  pricing: string;
  license_scope: string | null;
  storage_allowed: boolean;
  retention_days: number | null;
  display_allowed: boolean;
  customer_facing_allowed: boolean;
  redistribution_allowed: boolean;
  derived_data_allowed: boolean;
  attribution_required: boolean;
  notes: string | null;
}

const s = (v: number | null) => (v == null ? "" : String(v));

export function ProviderForm({ p }: { p: ProviderFormValues }) {
  return (
    <ActionForm action={updateProviderAction} successMessage="تم الحفظ">
      <input type="hidden" name="id" value={p.id} />
      <FormSection title="التشغيل">
        <CheckboxField name="enabled" label="مفعّل" defaultChecked={p.enabled} hint="لا يُستخدم المزود في التوجيه إلا وهو مفعّل ومعه بيانات اعتماد وترخيص يسمح بالتخزين." />
        <TextField name="priority" label="الأولوية" type="number" min={0} defaultValue={String(p.priority)} hint="الأقل يُجرَّب أولاً." />
        <TextField name="concurrency" label="الطلبات المتزامنة" type="number" min={1} defaultValue={String(p.concurrency)} />
        <TextField name="rate_limit_per_min" label="حد الطلبات في الدقيقة" type="number" min={1} defaultValue={s(p.rate_limit_per_min)} />
        <TextField name="burst" label="الدفعة القصوى" type="number" min={1} defaultValue={s(p.burst)} />
        <TextField name="daily_budget_usd" label="الميزانية اليومية (دولار)" inputMode="decimal" defaultValue={s(p.daily_budget_usd)} />
        <TextField name="monthly_budget_usd" label="الميزانية الشهرية (دولار)" inputMode="decimal" defaultValue={s(p.monthly_budget_usd)} />
        <TextField name="fallback_to" label="المزودون البدلاء" defaultValue={p.fallback_to.join(", ")} hint="معرّفات مفصولة بفواصل. فارغ = أي مزود يدعم القدرة." span={2} />
      </FormSection>
      <FormSection title="الأسعار">
        <TextAreaField name="pricing" label="السعر لكل قدرة (JSON)" rows={6} dir="ltr" defaultValue={p.pricing} hint='مثال: {"company.search": {"unit": "record", "unit_cost_usd": 0.02}} — من صفحة أسعار المزود الرسمية.' />
      </FormSection>
      <FormSection title="الترخيص">
        <TextField name="license_scope" label="نطاق الترخيص" defaultValue={p.license_scope ?? ""} hint="اسم الاتفاقية أو الخطة التي حصلنا بها على البيانات." span={2} />
        <TextField name="retention_days" label="مدة الاحتفاظ القصوى (أيام)" type="number" min={1} defaultValue={s(p.retention_days)} />
        <CheckboxField name="storage_allowed" label="التخزين مسموح" defaultChecked={p.storage_allowed} />
        <CheckboxField name="display_allowed" label="العرض في الواجهة مسموح" defaultChecked={p.display_allowed} />
        <CheckboxField name="customer_facing_allowed" label="مسموح للعميل رؤيتها وتصديرها" defaultChecked={p.customer_facing_allowed} />
        <CheckboxField name="redistribution_allowed" label="إعادة الاستخدام بين مساحات العمل مسموحة" defaultChecked={p.redistribution_allowed} />
        <CheckboxField name="derived_data_allowed" label="البيانات المشتقة مسموحة" defaultChecked={p.derived_data_allowed} />
        <CheckboxField name="attribution_required" label="يلزم ذكر المصدر" defaultChecked={p.attribution_required} />
      </FormSection>
      <FormSection title="ملاحظات">
        <TextAreaField name="notes" label="ملاحظات" rows={3} defaultValue={p.notes ?? ""} />
      </FormSection>
      <SubmitButton />
    </ActionForm>
  );
}

export function CredentialForm({ id, hint }: { id: string; hint: string | null }) {
  return (
    <div className="bos-stack" style={{ display: "grid", gap: 12 }}>
      <p className="bos-faint" style={{ margin: 0 }}>
        {hint ? <><Tx>المفتاح الحالي</Tx>: <span dir="ltr">{hint}</span></> : <Tx>لا يوجد مفتاح محفوظ.</Tx>}
      </p>
      <ActionForm action={setCredentialAction} successMessage="تم الحفظ" resetOnSuccess guardUnsaved={false}>
        <input type="hidden" name="id" value={id} />
        <FormSection>
          <TextField name="secret" label={hint ? "استبدال المفتاح" : "مفتاح API"} type="password" autoComplete="off" required span={2} hint="يُحفظ مشفراً في Supabase Vault ولا يُعرض مرة أخرى." />
        </FormSection>
        <SubmitButton label="حفظ المفتاح" />
      </ActionForm>
      {hint ? (
        <ActionForm action={clearCredentialAction} successMessage="تم الحذف" guardUnsaved={false}>
          <input type="hidden" name="id" value={id} />
          <SubmitButton label="حذف المفتاح" className="admin-btn secondary" />
        </ActionForm>
      ) : null}
    </div>
  );
}

export function SettingForm({ settingKey, title, hint, value }: { settingKey: string; title: string; hint: string; value: string }) {
  return (
    <ActionForm action={updateSettingAction} successMessage="تم الحفظ">
      <input type="hidden" name="key" value={settingKey} />
      <TextAreaField name="value" label={title} hint={hint} rows={Math.min(14, value.split("\n").length + 1)} dir="ltr" defaultValue={value} />
      <SubmitButton />
    </ActionForm>
  );
}
