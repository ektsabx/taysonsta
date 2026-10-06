"use client";

import { ActionForm, CheckboxField, FormSection, SelectField, SubmitButton, TextField } from "@/components/bos/Form";
import { clearPaymentSecretAction, savePackAction, setPaymentSecretAction, updatePaymobAction } from "./actions";

export function PaymobForm({ s }: { s: { enabled: boolean; mode: "test" | "live"; baseUrl: string; publicKey: string; egp: string; usd: string } }) {
  return (
    <ActionForm action={updatePaymobAction} successMessage="تم الحفظ">
      <FormSection>
        <CheckboxField name="enabled" label="مفعّل" defaultChecked={s.enabled} hint="عند التفعيل يدفع العملاء أونلاين بالعملة التي لها رقم تكامل. بدونه لا تُقبل مدفوعات." />
        <SelectField name="mode" label="الوضع" defaultValue={s.mode} options={[{ value: "test", label: "تجريبي (مفاتيح Paymob التجريبية)" }, { value: "live", label: "حقيقي" }]} />
        <TextField name="base_url" label="رابط Paymob" dir="ltr" required defaultValue={s.baseUrl} hint="حسب منطقة الحساب: مصر https://accept.paymob.com" span={2} />
        <TextField name="public_key" label="المفتاح العام (Public key)" dir="ltr" defaultValue={s.publicKey} span={2} />
        <TextField name="integrations_egp" label="أرقام التكامل للجنيه (EGP)" dir="ltr" defaultValue={s.egp} hint="Integration IDs لطرق الدفع (بطاقة، محفظة…)، مفصولة بفواصل." />
        <TextField name="integrations_usd" label="أرقام التكامل للدولار (USD)" dir="ltr" defaultValue={s.usd} hint="فارغ = لا يُقبل الدفع بالدولار عبر Paymob." />
      </FormSection>
      <SubmitButton />
    </ActionForm>
  );
}

export function PaymentSecretForm({ name, label, isSet }: { name: string; label: string; isSet: boolean }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <ActionForm action={setPaymentSecretAction} successMessage="تم الحفظ في الخزنة" resetOnSuccess>
        <input type="hidden" name="name" value={name} />
        <FormSection>
          <TextField name="secret" label={label} type="password" dir="ltr" autoComplete="off" required span={2} hint="يُحفظ مشفّراً في Supabase Vault ولا يُعرض مرة أخرى." />
        </FormSection>
        <SubmitButton label={isSet ? "استبدال" : "حفظ"} />
      </ActionForm>
      {isSet && (
        <ActionForm action={clearPaymentSecretAction} successMessage="تم الحذف">
          <input type="hidden" name="name" value={name} />
          <SubmitButton label="حذف" className="admin-btn secondary" />
        </ActionForm>
      )}
    </div>
  );
}

export function PackForm({ p }: { p?: { id: string; prospects: number; price_usd: number; price_egp: number | null; active: boolean; sort: number } }) {
  return (
    <ActionForm action={savePackAction} successMessage="تم الحفظ" resetOnSuccess={!p}>
      {p && <input type="hidden" name="id" value={p.id} />}
      <FormSection>
        <TextField name="prospects" label="عدد العملاء المحتملين" type="number" min={1} step={1} required defaultValue={p ? String(p.prospects) : ""} />
        <TextField name="price_usd" label="السعر (USD)" type="number" min={0.01} step={0.01} required defaultValue={p ? String(p.price_usd) : ""} />
        <TextField name="price_egp" label="السعر (EGP)" type="number" min={0.01} step={0.01} defaultValue={p?.price_egp == null ? "" : String(p.price_egp)} hint="فارغ = غير متاحة لعملاء مصر." />
        <TextField name="sort" label="الترتيب" type="number" step={1} defaultValue={p ? String(p.sort) : "0"} />
        <CheckboxField name="active" label="معروضة للعملاء" defaultChecked={p ? p.active : true} />
      </FormSection>
      <SubmitButton label={p ? "حفظ" : "إضافة باقة"} />
    </ActionForm>
  );
}
