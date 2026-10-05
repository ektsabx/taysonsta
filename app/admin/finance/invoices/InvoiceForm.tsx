"use client";

import { Tx, useT } from "@/components/bos/I18n";

import { useMemo, useState } from "react";
import type { ActionState } from "@/lib/bos/action";
import { ActionForm, Field, FormSection, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { EntitySelector, type EntityOption } from "@/components/bos/EntitySelector";
import { searchEntitiesAction } from "@/app/admin/_actions/common";
import { parseMoney, toDecimalString, percentOf } from "@/lib/bos/money";

export interface InvoiceItemRow {
  description: string;
  quantity: string;
  unit_price: string;
}

export function InvoiceForm({
  action,
  currencies,
  initial,
  initialClient,
  initialDeal,
  submitLabel = "حفظ",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  currencies: string[];
  initial: { currency?: string; issue_date?: string; due_date?: string; discount_amount?: string; tax_rate?: string; payment_terms?: string | null; notes?: string | null; items?: InvoiceItemRow[] };
  initialClient: EntityOption | null;
  initialDeal?: EntityOption | null;
  submitLabel?: string;
}) {
  const t = useT();
  const [client, setClient] = useState<EntityOption | null>(initialClient);
  const [currency, setCurrency] = useState(initial.currency ?? "USD");
  const [items, setItems] = useState<InvoiceItemRow[]>(initial.items?.length ? initial.items : [{ description: "", quantity: "1", unit_price: "" }]);
  const [discount, setDiscount] = useState(initial.discount_amount ?? "0");
  const [tax, setTax] = useState(initial.tax_rate ?? "0");

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, i) => s + ((parseMoney(i.quantity || "0") ?? BigInt(0)) * (parseMoney(i.unit_price || "0") ?? BigInt(0))) / BigInt(1000), BigInt(0));
    const d = parseMoney(discount || "0") ?? BigInt(0);
    const taxable = subtotal - d;
    const taxAmount = percentOf(toDecimalString(taxable, 3), tax || "0", currency);
    return { subtotal, discount: d, taxAmount, total: taxable + taxAmount };
  }, [items, discount, tax, currency]);

  const fmt = (v: bigint) => `${toDecimalString(v, 2)} ${currency}`;

  return (
    <ActionForm action={action} successMessage="تم الحفظ">
      <input type="hidden" name="items_json" value={JSON.stringify(items.filter((i) => i.description.trim()))} />
      <FormSection title="الفاتورة">
        <Field label="الحساب" name="client_id" required span={2}>
          <EntitySelector name="client_id" required initial={initialClient} onChange={setClient} search={(q) => searchEntitiesAction("client", q)} />
        </Field>
        <Field label="الصفقة" name="deal_id">
          {client ? <EntitySelector key={`d-${client.id}`} name="deal_id" initial={initialDeal} search={(q) => searchEntitiesAction("deal", q, { client_id: client.id })} /> : <input disabled placeholder={t("اختر الحساب")} />}
        </Field>
        <Field label="العملة" name="currency" required>
          <select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {currencies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <TextField name="issue_date" label="تاريخ الإصدار" type="date" required defaultValue={initial.issue_date} />
        <TextField name="due_date" label="تاريخ الاستحقاق" type="date" required defaultValue={initial.due_date} />
      </FormSection>

      <FormSection title="البنود">
        <div className="bos-field span-all">
          {items.map((it, i) => (
            <div key={i} className="bos-repeater-row" style={{ gridTemplateColumns: "3fr 90px 130px 120px 34px" }}>
              <input aria-label={t("الوصف")} placeholder={t("وصف البند")} value={it.description} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
              <input aria-label={t("الكمية")} inputMode="decimal" value={it.quantity} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, quantity: e.target.value.replace(/[^\d.]/g, "") } : x)))} />
              <input aria-label={t("سعر الوحدة")} inputMode="decimal" placeholder="0.00" value={it.unit_price} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, unit_price: e.target.value.replace(/[^\d.]/g, "") } : x)))} />
              <span className="bos-num bos-muted" style={{ alignSelf: "center", fontSize: 12.5 }}>
                {toDecimalString(((parseMoney(it.quantity || "0") ?? BigInt(0)) * (parseMoney(it.unit_price || "0") ?? BigInt(0))) / BigInt(1000), 2)}
              </span>
              <button type="button" className="bos-icon-btn" aria-label={t("حذف")} onClick={() => setItems(items.filter((_, j) => j !== i))} disabled={items.length === 1}>
                ×
              </button>
            </div>
          ))}
          <button type="button" className="admin-btn small ghost" onClick={() => setItems([...items, { description: "", quantity: "1", unit_price: "" }])}>
            <Tx>+ بند</Tx>
          </button>
        </div>
        <div className="bos-field">
          <label htmlFor="f-discount"><Tx>الخصم</Tx></label>
          <input id="f-discount" name="discount_amount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/[^\d.]/g, ""))} />
        </div>
        <div className="bos-field">
          <label htmlFor="f-tax"><Tx>الضريبة %</Tx></label>
          <input id="f-tax" name="tax_rate" inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value.replace(/[^\d.]/g, ""))} />
        </div>
        <div className="bos-field span-2">
          <label><Tx>الإجماليات</Tx></label>
          <div className="bos-kv" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
            <div><div className="bos-kv-label"><Tx>المجموع</Tx></div><div className="bos-num">{fmt(totals.subtotal)}</div></div>
            <div><div className="bos-kv-label"><Tx>الخصم</Tx></div><div className="bos-num">{fmt(totals.discount)}</div></div>
            <div><div className="bos-kv-label"><Tx>الضريبة</Tx></div><div className="bos-num">{fmt(totals.taxAmount)}</div></div>
            <div><div className="bos-kv-label"><Tx>الإجمالي</Tx></div><div className="bos-num" style={{ fontWeight: 800 }}>{fmt(totals.total)}</div></div>
          </div>
        </div>
      </FormSection>

      <FormSection title="الشروط">
        <TextAreaField name="payment_terms" label="شروط الدفع" defaultValue={initial.payment_terms ?? ""} span={2} />
        <TextAreaField name="notes" label="ملاحظات" defaultValue={initial.notes ?? ""} span={2} />
      </FormSection>

      <div className="bos-form-actions">
        <SubmitButton label={submitLabel} />
      </div>
    </ActionForm>
  );
}
