"use client";

import { ActionForm, CheckboxField, SubmitButton, TextField } from "@/components/bos/Form";
import { saveAlertsAction } from "./alert-actions";

export interface AlertValues {
  enabled: boolean;
  gemini_daily_usd: number;
  ai_failures_per_hour: number;
  payment_failure_pct: number;
  payment_min_attempts: number;
  email_daily_quota: number;
  email_warn_pct: number;
  db_limit_mb: number;
  db_warn_pct: number;
}

export function AlertsForm({ v }: { v: AlertValues }) {
  return (
    <ActionForm action={saveAlertsAction} successMessage="تم حفظ حدود التنبيهات">
      <CheckboxField name="enabled" label="تشغيل التنبيهات" defaultChecked={v.enabled} />
      <div className="bos-form-grid">
        <TextField name="gemini_daily_usd" label="حد تكلفة Gemini اليومية (USD)" inputMode="decimal" defaultValue={String(v.gemini_daily_usd)} hint="حرج عند ضعف الحد." />
        <TextField name="ai_failures_per_hour" label="حد الطلبات الفاشلة في الساعة" inputMode="numeric" defaultValue={String(v.ai_failures_per_hour)} hint="الذكاء الاصطناعي ومزودو البيانات معًا." />
        <TextField name="payment_failure_pct" label="نسبة فشل المدفوعات (%) خلال 24 ساعة" inputMode="decimal" defaultValue={String(v.payment_failure_pct)} />
        <TextField name="payment_min_attempts" label="أقل عدد محاولات دفع قبل التنبيه" inputMode="numeric" defaultValue={String(v.payment_min_attempts)} />
        <TextField name="email_daily_quota" label="حصة البريد اليومية" inputMode="numeric" defaultValue={String(v.email_daily_quota)} hint="Resend Free = 100 في اليوم." />
        <TextField name="email_warn_pct" label="التنبيه عند (%) من حصة البريد" inputMode="decimal" defaultValue={String(v.email_warn_pct)} />
        <TextField name="db_limit_mb" label="سعة قاعدة البيانات (MB)" inputMode="decimal" defaultValue={String(v.db_limit_mb)} hint="Supabase Free = 500 MB." />
        <TextField name="db_warn_pct" label="التنبيه عند (%) من السعة" inputMode="decimal" defaultValue={String(v.db_warn_pct)} />
      </div>
      <div className="bos-form-actions"><SubmitButton label="حفظ" className="admin-btn small" /></div>
    </ActionForm>
  );
}
