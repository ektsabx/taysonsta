"use client";

import { ActionForm, CheckboxField, FormSection, SubmitButton, TextField } from "@/components/bos/Form";
import { saveCreditRateAction, savePackAction } from "./actions";

/** A Pay As You Go top-up amount (D-247): the prospects are calculated from the rate. */
export function PackForm({ p }: { p?: { id: string; price_usd: number; active: boolean; sort: number } }) {
  return (
    <ActionForm action={savePackAction} successMessage="تم الحفظ" resetOnSuccess={!p}>
      {p && <input type="hidden" name="id" value={p.id} />}
      <FormSection>
        <TextField name="price_usd" label="مبلغ الشحن (USD)" type="number" min={0.01} step={0.01} required defaultValue={p ? String(p.price_usd) : ""} hint="عدد العملاء المحتملين يُحسب تلقائيًا: المبلغ ÷ سعر العميل المحتمل الواحد." />
        <TextField name="sort" label="الترتيب" type="number" step={1} defaultValue={p ? String(p.sort) : "0"} />
        <CheckboxField name="active" label="معروض للعملاء في صفحة الدفع" defaultChecked={p ? p.active : true} />
      </FormSection>
      <SubmitButton label={p ? "حفظ" : "إضافة مبلغ شحن"} />
    </ActionForm>
  );
}

/** The price of one prospect: every top-up option is recalculated from it. */
export function CreditRateForm({ rate }: { rate: number }) {
  return (
    <ActionForm action={saveCreditRateAction} successMessage="تم الحفظ">
      <FormSection>
        <TextField name="usd_per_prospect" label="سعر العميل المحتمل الواحد (USD)" type="number" min={0.0001} step={0.0001} required defaultValue={String(rate)} hint="عند التغيير يُعاد حساب عدد العملاء المحتملين لكل مبالغ الشحن. الشحنات السابقة تبقى كما هي." />
      </FormSection>
      <SubmitButton label="حفظ السعر" />
    </ActionForm>
  );
}
