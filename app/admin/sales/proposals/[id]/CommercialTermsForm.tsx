"use client";

import { Tx, useT } from "@/components/bos/I18n";

import { useState } from "react";
import { ActionForm, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { addMoney, allocateByPercent, toDecimalString, HUNDRED_PERCENT } from "@/lib/bos/money";
import { saveCommercialTermsAction } from "@/app/admin/proposals/actions";

// Pricing & payment terms with automatic totals (§15: $25,000 → 40/30/30 =
// 10,000 / 7,500 / 7,500).
export function CommercialTermsForm({
  proposalId,
  initial,
  currencies,
  disabled,
}: {
  proposalId: string;
  initial: { total: string; currency: string; schedule: { label: string; percent: string }[]; validUntil: string | null; assumptions: string | null; terms: string | null };
  currencies: string[];
  disabled?: boolean;
}) {
  const t = useT();
  const [total, setTotal] = useState(initial.total);
  const [currency, setCurrency] = useState(initial.currency);
  const [rows, setRows] = useState(initial.schedule);
  const sum = addMoney(...rows.map((r) => r.percent || "0"));
  const amounts = allocateByPercent(total || "0", rows.map((r) => r.percent || "0"), currency);

  return (
    <ActionForm action={saveCommercialTermsAction.bind(null, proposalId)} successMessage="تم الحفظ">
      <input type="hidden" name="schedule_json" value={JSON.stringify(rows)} />
      <fieldset disabled={disabled} style={{ border: "none", padding: 0 }} className="bos-stack">
        <div className="bos-form-grid">
          <div className="bos-field">
            <label htmlFor="f-total_amount">
              <Tx>إجمالي المشروع</Tx><span className="req">*</span>
            </label>
            <div className="bos-input-group">
              <input id="f-total_amount" name="total_amount" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value.replace(/[^\d.]/g, ""))} required />
              <select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {currencies.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <TextField name="valid_until" label="صالح حتى" type="date" defaultValue={initial.validUntil ?? ""} />
        </div>
        <div className="bos-field">
          <label><Tx>جدول الدفعات</Tx></label>
          {rows.map((r, i) => (
            <div key={i} className="bos-repeater-row" style={{ gridTemplateColumns: "2fr 90px 1fr 34px" }}>
              <input aria-label={t("الدفعة")} value={r.label} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <input aria-label="%" inputMode="decimal" value={r.percent} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, percent: e.target.value.replace(/[^\d.]/g, "") } : x)))} />
              <span className="bos-num bos-muted" style={{ alignSelf: "center", fontSize: 12.5 }}>
                {toDecimalString(amounts[i] ?? BigInt(0), 2)} {currency}
              </span>
              <button type="button" className="bos-icon-btn" aria-label={t("حذف")} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
          ))}
          <div className="bos-row" style={{ justifyContent: "space-between" }}>
            <span className="bos-row">
              <button type="button" className="admin-btn small ghost" onClick={() => setRows([...rows, { label: "", percent: "" }])}>
                <Tx>+ دفعة</Tx>
              </button>
              <button
                type="button"
                className="admin-btn small ghost"
                onClick={() =>
                  setRows([
                    { label: "Deposit", percent: "40" },
                    { label: "Milestone", percent: "30" },
                    { label: "Final", percent: "30" },
                  ])
                }
              >
                40 / 30 / 30
              </button>
            </span>
            <span className={!rows.length || sum === HUNDRED_PERCENT ? "bos-muted" : "bos-field-error"} style={{ fontSize: 12.5 }}>
              <Tx vars={{ v: toDecimalString(sum, 2) }}>{"المجموع {v}%"}</Tx>
            </span>
          </div>
        </div>
        <TextAreaField name="assumptions" label="الافتراضات" defaultValue={initial.assumptions ?? ""} />
        <TextAreaField name="terms" label="الشروط والأحكام" defaultValue={initial.terms ?? ""} />
        <div className="bos-form-actions">
          <SubmitButton label="حفظ التسعير والشروط" />
        </div>
      </fieldset>
    </ActionForm>
  );
}
