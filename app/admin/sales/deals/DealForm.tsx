"use client";

import { Tx, useT } from "@/components/bos/I18n";

import { useState } from "react";
import type { ActionState } from "@/lib/bos/action";
import { ActionForm, Field, FormSection, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { EntitySelector, type EntityOption } from "@/components/bos/EntitySelector";
import { searchEntitiesAction } from "@/app/admin/_actions/common";
import { addMoney, allocateByPercent, toDecimalString, HUNDRED_PERCENT } from "@/lib/bos/money";

export interface TermRow {
  label: string;
  percent: string;
  trigger: "on_signing" | "on_date";
  due_offset_days: number;
}

interface Option {
  value: string;
  label: string;
}

const triggers: Option[] = [
  { value: "on_signing", label: "عند التوقيع" },
  { value: "on_date", label: "بتاريخ" },
];

export function PaymentTermsEditor({ terms, setTerms, total, currency }: { terms: TermRow[]; setTerms: (t: TermRow[]) => void; total: string; currency: string }) {
  const tt = useT();
  const sum = addMoney(...terms.map((t) => t.percent || "0"));
  const amounts = allocateByPercent(total || "0", terms.map((t) => t.percent || "0"), currency);
  const ok = !terms.length || sum === HUNDRED_PERCENT;
  return (
    <div className="bos-field span-all">
      <label><Tx>جدول الدفعات</Tx></label>
      {terms.map((t, i) => (
        <div key={i} className="bos-repeater-row" style={{ gridTemplateColumns: "2fr 90px 1.2fr 90px 1fr 34px" }}>
          <input aria-label={tt("اسم الدفعة")} value={t.label} placeholder={tt("مثال: الدفعة المقدمة")} onChange={(e) => setTerms(terms.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <input aria-label={tt("النسبة")} inputMode="decimal" value={t.percent} placeholder="%" onChange={(e) => setTerms(terms.map((x, j) => (j === i ? { ...x, percent: e.target.value.replace(/[^\d.]/g, "") } : x)))} />
          <select aria-label={tt("الاستحقاق")} value={t.trigger} onChange={(e) => setTerms(terms.map((x, j) => (j === i ? { ...x, trigger: e.target.value as TermRow["trigger"] } : x)))}>
            {triggers.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input aria-label={tt("بعد (أيام)")} type="number" min={0} value={t.due_offset_days} onChange={(e) => setTerms(terms.map((x, j) => (j === i ? { ...x, due_offset_days: Number(e.target.value) || 0 } : x)))} title="أيام بعد بداية المشروع" />
          <span className="bos-num bos-muted" style={{ alignSelf: "center", fontSize: 12.5 }}>
            {toDecimalString(amounts[i] ?? BigInt(0), 2)} {currency}
          </span>
          <button type="button" className="bos-icon-btn" aria-label={tt("حذف")} onClick={() => setTerms(terms.filter((_, j) => j !== i))}>
            ×
          </button>
        </div>
      ))}
      <div className="bos-row" style={{ justifyContent: "space-between" }}>
        <div className="bos-row">
          <button type="button" className="admin-btn small ghost" onClick={() => setTerms([...terms, { label: "", percent: "", trigger: terms.length ? "on_date" : "on_signing", due_offset_days: 0 }])}>
            <Tx>+ دفعة</Tx>
          </button>
          <button
            type="button"
            className="admin-btn small ghost"
            onClick={() =>
              setTerms([
                { label: "Deposit", percent: "40", trigger: "on_signing", due_offset_days: 0 },
                { label: "Second", percent: "30", trigger: "on_date", due_offset_days: 15 },
                { label: "Final", percent: "30", trigger: "on_date", due_offset_days: 45 },
              ])
            }
          >
            40 / 30 / 30
          </button>
        </div>
        <span className={ok ? "bos-muted" : "bos-field-error"} style={{ fontSize: 12.5 }}>
          المجموع {toDecimalString(sum, 2)}% {ok ? "" : "— يجب أن يساوي 100%"}
        </span>
      </div>
    </div>
  );
}

export function DealForm({
  action,
  initial,
  initialClient,
  initialContact,
  sources,
  staff,
  currencies,
  canAssign,
  submitLabel = "حفظ",
  hidden = {},
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: {
    name?: string;
    value?: string | number | null;
    currency?: string;
    probability?: string | number | null;
    expected_close_date?: string | null;
    assigned_to?: string | null;
    source_id?: string | null;
    scope?: string | null;
    notes?: string | null;
    payment_terms?: TermRow[];
  };
  initialClient?: EntityOption | null;
  initialContact?: EntityOption | null;
  sources: Option[];
  staff: Option[];
  currencies: string[];
  canAssign: boolean;
  submitLabel?: string;
  hidden?: Record<string, string | null | undefined>;
}) {
  const tt = useT();
  const [client, setClient] = useState<EntityOption | null>(initialClient ?? null);
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const [terms, setTerms] = useState<TermRow[]>(initial?.payment_terms ?? []);
  const [value, setValue] = useState(initial?.value !== undefined && initial?.value !== null ? String(initial.value) : "");

  return (
    <ActionForm action={action} successMessage="تم الحفظ">
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <input type="hidden" name="payment_terms_json" value={JSON.stringify(terms)} />

      <FormSection title="الصفقة">
        <TextField name="name" label="اسم الصفقة" required defaultValue={initial?.name ?? ""} span={2} />
        <Field label="الحساب (العميل)" name="client_id" required span={2}>
          <EntitySelector name="client_id" required search={(q) => searchEntitiesAction("client", q)} initial={initialClient} onChange={setClient} placeholder="ابحث عن حساب موجود..." />
        </Field>
        <Field label="جهة الاتصال" name="contact_id" span={2}>
          {client ? (
            <EntitySelector key={client.id} name="contact_id" search={(q) => searchEntitiesAction("contact", q, { client_id: client.id })} initial={initialContact} placeholder="اختر جهة اتصال من الحساب" />
          ) : (
            <input disabled placeholder={tt("اختر الحساب أولاً")} />
          )}
        </Field>
        <SelectField name="source_id" label="المصدر" options={sources} placeholder="—" defaultValue={initial?.source_id ?? ""} />
        {canAssign ? <SelectField name="assigned_to" label="المسؤول (BD)" options={staff} placeholder="أنا" defaultValue={initial?.assigned_to ?? ""} /> : null}
        <TextField name="expected_close_date" label="تاريخ الإغلاق المتوقع" type="date" defaultValue={initial?.expected_close_date ?? ""} />
        <TextField name="probability" label="الاحتمالية %" inputMode="decimal" defaultValue={initial?.probability !== undefined && initial?.probability !== null ? String(initial.probability) : ""} placeholder="حسب المرحلة" />
      </FormSection>

      <FormSection title="القيمة">
        <Field label="قيمة الصفقة" name="value" required>
          <div className="bos-input-group">
            <input id="f-value" name="value" inputMode="decimal" required value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="0.00" />
            <select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="العملة">
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </Field>
      </FormSection>

      <FormSection title="شروط الدفع">
        <PaymentTermsEditor terms={terms} setTerms={setTerms} total={value.replace(/,/g, "")} currency={currency} />
      </FormSection>

      <FormSection title="النطاق والملاحظات">
        <TextAreaField name="scope" label="النطاق المعتمد (يُنسخ للمشروع عند الكسب)" defaultValue={initial?.scope ?? ""} rows={5} />
        <TextAreaField name="notes" label="ملاحظات داخلية" defaultValue={initial?.notes ?? ""} />
      </FormSection>

      <div className="bos-form-actions">
        <SubmitButton label={submitLabel} />
      </div>
    </ActionForm>
  );
}
