"use client";

import { Tx } from "@/components/bos/I18n";
import { ActionButton, ModalButton } from "@/components/bos/Dialog";
import { ActionForm, SelectField, SubmitButton, TextField } from "@/components/bos/Form";
import { adAccountAction, createImportAccountAction, deleteAlertAction, importCsvAction, saveAlertAction } from "./actions";

type O = { value: string; label: string };

export function ConnectButtons() {
  return (
    <span className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}>
      <ActionButton label="استيراد حسابات Meta الإعلانية" className="admin-btn small secondary" action={() => adAccountAction("import_meta")} />
      <ActionButton label="ربط Google Ads" className="admin-btn small secondary" action={() => adAccountAction("connect_google")} />
      <ModalButton label="+ حساب باستيراد CSV" title="حساب إعلاني يُستورد يدوياً" className="admin-btn small">
        {(close) => (
          <ActionForm action={createImportAccountAction} onSuccess={close} successMessage="تم">
            <div className="bos-form-grid">
              <SelectField name="platform" label="المنصة" options={[{ value: "linkedin", label: "LinkedIn Ads" }, { value: "tiktok", label: "TikTok Ads" }, { value: "snapchat", label: "Snapchat Ads" }, { value: "x", label: "X Ads" }, { value: "meta", label: "Meta Ads" }, { value: "google", label: "Google Ads" }, { value: "other", label: "أخرى" }]} required />
              <TextField name="name" label="اسم الحساب" required />
              <TextField name="currency" label="عملة الحساب" dir="ltr" placeholder="USD" required hint="كل أرقام هذا الحساب بهذه العملة" />
            </div>
            <div className="bos-form-actions"><SubmitButton label="إضافة" /></div>
          </ActionForm>
        )}
      </ModalButton>
    </span>
  );
}

export function AccountRow({ id, active, mode }: { id: string; active: boolean; mode: string }) {
  return (
    <span className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}>
      {mode === "api" && active ? <ActionButton label="مزامنة الآن" className="admin-btn small ghost" action={() => adAccountAction("sync", id)} /> : null}
      {mode === "import" ? (
        <ModalButton label="استيراد CSV" title="استيراد أداء من ملف CSV" className="admin-btn small ghost">
          {(close) => (
            <ActionForm action={importCsvAction} onSuccess={close} successMessage="تم">
              <input type="hidden" name="account_id" value={id} />
              <p className="bos-hint"><Tx>الأعمدة: date, campaign, spend, impressions, clicks — واختياري: campaign_id, ad, ad_id, reach, conversions, conversion_value, currency. التاريخ YYYY-MM-DD، والعملة يجب أن تطابق عملة الحساب.</Tx></p>
              <div className="bos-field"><label><Tx>الملف</Tx></label><input type="file" name="file" accept=".csv,text/csv" required /></div>
              <div className="bos-form-actions"><SubmitButton label="استيراد" /></div>
            </ActionForm>
          )}
        </ModalButton>
      ) : null}
      <ActionButton label={active ? "إيقاف" : "تفعيل"} className="admin-btn small ghost" action={() => adAccountAction(active ? "disable" : "enable", id)} />
    </span>
  );
}

export function AlertForm({ accounts, staff }: { accounts: O[]; staff: O[] }) {
  return (
    <ActionForm action={saveAlertAction} successMessage="تم" resetOnSuccess>
      <div className="bos-form-grid">
        <TextField name="name" label="اسم التنبيه" required />
        <SelectField name="account_id" label="الحساب" placeholder="كل الحسابات" options={accounts} />
        <SelectField name="metric" label="المقياس (لآخر يوم مكتمل)" options={[{ value: "daily_spend", label: "الإنفاق اليومي" }, { value: "cpa", label: "تكلفة التحويل (CPA)" }, { value: "cpc", label: "تكلفة النقرة (CPC)" }, { value: "ctr", label: "نسبة النقر (CTR %)" }, { value: "roas", label: "العائد على الإنفاق (ROAS)" }]} />
        <SelectField name="comparator" label="الشرط" options={[{ value: "gt", label: "أكبر من" }, { value: "lt", label: "أقل من" }]} />
        <TextField name="threshold" label="القيمة" type="number" step="0.01" min={0} required hint="بعملة الحساب للمبالغ" />
      </div>
      <div className="bos-field" style={{ marginTop: 8 }}>
        <label><Tx>إرسال إلى</Tx></label>
        <div className="bos-row" style={{ gap: 10, flexWrap: "wrap" }}>{staff.map((s) => <label key={s.value} className="bos-check"><input type="checkbox" name="notify[]" value={s.value} /> {s.label}</label>)}</div>
        <span className="bos-hint"><Tx>بدون اختيار = أنت فقط. التنبيه لا يُطلق إن كان المقياس غير متاح (مثلاً CPA بدون تحويلات).</Tx></span>
      </div>
      <div className="bos-form-actions"><SubmitButton label="حفظ" /></div>
    </ActionForm>
  );
}

export function DeleteAlert({ id }: { id: string }) {
  return <ActionButton label="حذف" className="admin-btn small ghost" action={() => deleteAlertAction(id)} />;
}
