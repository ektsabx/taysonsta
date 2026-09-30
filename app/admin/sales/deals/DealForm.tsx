"use client";

import { Tx, Opt, useT } from "@/components/bos/I18n";

import { useMemo, useState } from "react";
import type { ActionState } from "@/lib/bos/action";
import { ActionForm, Field, FormSection, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { EntitySelector, type EntityOption } from "@/components/bos/EntitySelector";
import { searchEntitiesAction } from "@/app/admin/_actions/common";
import { addMoney, allocateByPercent, parseMoney, toDecimalString, HUNDRED_PERCENT } from "@/lib/bos/money";

export interface TermRow {
  label: string;
  percent: string;
  trigger: "on_signing" | "on_date" | "on_milestone" | "on_completion";
  due_offset_days: number;
}

export interface ProductRow {
  product_id: string;
  quantity: string;
  unit_price: string;
}

interface Option {
  value: string;
  label: string;
}

const triggers: Option[] = [
  { value: "on_signing", label: "عند التوقيع" },
  { value: "on_date", label: "بتاريخ" },
  { value: "on_milestone", label: "عند مرحلة" },
  { value: "on_completion", label: "عند التسليم" },
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
                { label: "Milestone", percent: "30", trigger: "on_milestone", due_offset_days: 15 },
                { label: "Final", percent: "30", trigger: "on_completion", due_offset_days: 45 },
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
  products,
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
    products?: ProductRow[];
  };
  initialClient?: EntityOption | null;
  initialContact?: EntityOption | null;
  sources: Option[];
  products: { value: string; label: string; price: string | null; currency: string | null }[];
  staff: Option[];
  currencies: string[];
  canAssign: boolean;
  submitLabel?: string;
  hidden?: Record<string, string | null | undefined>;
}) {
  const tt = useT();
  const [client, setClient] = useState<EntityOption | null>(initialClient ?? null);
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const [lines, setLines] = useState<ProductRow[]>(initial?.products ?? []);
  const [terms, setTerms] = useState<TermRow[]>(initial?.payment_terms ?? []);
  const linesTotal = useMemo(
    () => toDecimalString(lines.reduce((s, l) => s + ((parseMoney(l.quantity || "0") ?? BigInt(0)) * (parseMoney(l.unit_price || "0") ?? BigInt(0))) / BigInt(1000), BigInt(0)), 2),
    [lines],
  );
  const [value, setValue] = useState(initial?.value !== undefined && initial?.value !== null ? String(initial.value) : "");
  const effectiveValue = value || (lines.length ? linesTotal : "");

  return (
    <ActionForm action={action} successMessage="تم الحفظ">
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <input type="hidden" name="payment_terms_json" value={JSON.stringify(terms)} />
      <input type="hidden" name="products_json" value={JSON.stringify(lines.filter((l) => l.product_id))} />

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

      <FormSection title="المنتجات والخدمات">
        <div className="bos-field span-all">
          {lines.map((l, i) => (
            <div key={i} className="bos-repeater-row" style={{ gridTemplateColumns: "2fr 90px 140px 120px 34px" }}>
              <select
                aria-label={tt("المنتج")}
                value={l.product_id}
                onChange={(e) => {
                  const p = products.find((x) => x.value === e.target.value);
                  setLines(lines.map((x, j) => (j === i ? { ...x, product_id: e.target.value, unit_price: x.unit_price || p?.price || "" } : x)));
                }}
              >
                <Opt value="">اختر</Opt>
                {products.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <input aria-label={tt("الكمية")} inputMode="decimal" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: e.target.value.replace(/[^\d.]/g, "") } : x)))} />
              <input aria-label={tt("سعر الوحدة")} inputMode="decimal" value={l.unit_price} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, unit_price: e.target.value.replace(/[^\d.]/g, "") } : x)))} />
              <span className="bos-num bos-muted" style={{ alignSelf: "center", fontSize: 12.5 }}>
                {toDecimalString(((parseMoney(l.quantity || "0") ?? BigInt(0)) * (parseMoney(l.unit_price || "0") ?? BigInt(0))) / BigInt(1000), 2)}
              </span>
              <button type="button" className="bos-icon-btn" aria-label={tt("حذف")} onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
          ))}
          <div className="bos-row" style={{ justifyContent: "space-between" }}>
            <button type="button" className="admin-btn small ghost" onClick={() => setLines([...lines, { product_id: "", quantity: "1", unit_price: "" }])}>
              <Tx>+ بند</Tx>
            </button>
            {lines.length ? <span className="bos-muted" style={{ fontSize: 12.5 }}><Tx vars={{ linesTotal, currency }}>{"إجمالي البنود: {linesTotal} {currency}"}</Tx></span> : null}
          </div>
        </div>
        <Field label="قيمة الصفقة" name="value" required>
          <div className="bos-input-group">
            <input id="f-value" name="value" inputMode="decimal" required value={effectiveValue} onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="0.00" />
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
        <PaymentTermsEditor terms={terms} setTerms={setTerms} total={effectiveValue.replace(/,/g, "")} currency={currency} />
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
