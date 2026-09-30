"use client";

import { useT, Tx } from "@/components/bos/I18n";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ActionButton, ConfirmButton, ModalButton } from "@/components/bos/Dialog";
import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { branchAccessAction, branchStepAction, createBrandUploadAction, finalizeBrandAction, saveBranchAction } from "./company-actions";

type Opt = { value: string; label: string };

export function BrandUploader({ kind, current }: { kind: "logo" | "icon"; current: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState(0);
  const router = useRouter();
  const upload = (file: File) =>
    start(async () => {
      setError(null);
      const r = await createBrandUploadAction(kind, file.type, file.size);
      if (!r.ok || !r.data) return setError(r.ok ? "تعذر الرفع" : r.error);
      const { error: e } = await createClient().storage.from("bos-files").uploadToSignedUrl(r.data.path, r.data.token, file, { contentType: file.type });
      if (e) return setError("تعذر رفع الملف");
      const f = await finalizeBrandAction(kind, r.data.path);
      if (!f.ok) setError(f.error);
      setV(Date.now());
      router.refresh();
    });
  return (
    <div className="bos-row" style={{ gap: 10, alignItems: "center" }}>
      <span className="bos-brand-preview">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/bos/company-asset?k=${kind}&v=${v}`} alt="" />
        ) : <span className="bos-faint">—</span>}
      </span>
      <input ref={input} type="file" hidden accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <button type="button" className="admin-btn small secondary" disabled={busy} onClick={() => input.current?.click()}><Tx>{busy ? "جارٍ الرفع..." : current ? "تغيير" : "رفع"}</Tx></button>
      {current ? <ActionButton label="إزالة" className="admin-btn small ghost" action={() => finalizeBrandAction(kind, null)} /> : null}
      {error ? <span className="bos-field-error"><Tx>{error}</Tx></span> : null}
    </div>
  );
}

export interface BranchRow { id: string; code: string; name: string; name_en: string | null; status: string; is_head_office: boolean; address: string | null; country: string | null; region: string | null; city: string | null; postal_code: string | null; timezone: string; currency: string | null; phone: string | null; email: string | null; manager_employee_id: string | null; work_schedule_id: string | null; notes: string | null }

export function BranchButton({ branch, currencies, managers, schedules }: { branch?: BranchRow; currencies: string[]; managers: Opt[]; schedules: Opt[] }) {
  const v = (k: keyof BranchRow) => (branch?.[k] == null ? "" : String(branch[k]));
  return (
    <ModalButton label={branch ? "تعديل" : "+ فرع"} title={branch ? `فرع: ${branch.name}` : "فرع جديد"} className={branch ? "admin-btn small ghost" : "admin-btn small"} wide>
      {(close) => (
        <ActionForm action={saveBranchAction} onSuccess={close}>
          {branch ? <input type="hidden" name="id" value={branch.id} /> : null}
          <div className="bos-form-grid">
            <TextField name="name" label="الاسم" required defaultValue={v("name")} />
            <TextField name="name_en" label="الاسم (إنجليزي)" defaultValue={v("name_en")} />
            <TextField name="code" label="الكود" required dir="ltr" defaultValue={v("code")} hint="مثال: CAI, RUH" />
            <SelectField name="status" label="الحالة" defaultValue={v("status") || "active"} options={[{ value: "active", label: "نشط" }, { value: "inactive", label: "معطّل" }]} />
            <TextField name="country" label="الدولة" defaultValue={v("country")} />
            <TextField name="region" label="المحافظة / المنطقة" defaultValue={v("region")} />
            <TextField name="city" label="المدينة" defaultValue={v("city")} />
            <TextField name="postal_code" label="الرمز البريدي" defaultValue={v("postal_code")} />
            <TextField name="timezone" label="المنطقة الزمنية" required dir="ltr" defaultValue={v("timezone") || "Africa/Cairo"} />
            <SelectField name="currency" label="العملة الافتراضية" placeholder="عملة الشركة" options={currencies.map((c) => ({ value: c, label: c }))} defaultValue={v("currency")} />
            <TextField name="phone" label="الهاتف" dir="ltr" defaultValue={v("phone")} />
            <TextField name="email" label="البريد" type="email" dir="ltr" defaultValue={v("email")} />
            <SelectField name="manager_employee_id" label="مدير الفرع" placeholder="—" options={managers} defaultValue={v("manager_employee_id")} />
            <SelectField name="work_schedule_id" label="جدول عمل الفرع" placeholder="جدول الشركة" options={schedules} defaultValue={v("work_schedule_id")} />
          </div>
          <TextField name="address" label="العنوان" defaultValue={v("address")} />
          <TextAreaField name="notes" label="ملاحظات" rows={2} defaultValue={v("notes")} />
          <div className="bos-form-actions"><SubmitButton /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function BranchRowActions({ id, isHeadOffice }: { id: string; isHeadOffice: boolean }) {
  if (isHeadOffice) return null;
  return (
    <span className="bos-row" style={{ gap: 4 }}>
      <ActionButton label="تعيين كمقر رئيسي" className="admin-btn small ghost" action={() => branchStepAction(id, "head_office")} />
      <ConfirmButton label="حذف" className="admin-btn small ghost" message="إن كان الفرع مستخدماً سيتم تعطيله بدلاً من حذفه." action={() => branchStepAction(id, "remove")} />
    </span>
  );
}

export function BranchAccessToggle({ userId, branchId, granted }: { userId: string; branchId: string; granted: boolean }) {
  const t = useT();
  const [pending, start] = useTransition();
  const router = useRouter();
  return <input type="checkbox" aria-label={t("وصول")} checked={granted} disabled={pending} onChange={(e) => start(async () => { await branchAccessAction(userId, branchId, e.target.checked); router.refresh(); })} />;
}
