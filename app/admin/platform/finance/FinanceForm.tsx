"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/bos/Form";
import { useT } from "@/components/bos/I18n";
import { deleteFinanceEntryAction, saveFinanceEntryAction } from "./actions";

// Add or update one month's cost (D-276). The same month, kind and item replaces the amount.
export const CATEGORY_LABEL: Record<string, string> = {
  servers: "السيرفرات", database: "قاعدة البيانات", email: "إرسال البريد", ai: "الذكاء الاصطناعي", software: "برامج واشتراكات", salaries: "الرواتب", office: "المكتب", other: "أخرى",
  seo: "SEO", geo: "GEO / AEO", paid_ads: "إعلانات مدفوعة", social: "سوشيال ميديا", affiliate: "شركاء",
};
const FIXED = ["servers", "database", "email", "ai", "software", "salaries", "office", "other"];
const MARKETING = ["seo", "geo", "paid_ads", "social", "affiliate", "email", "other"];

export function FinanceForm({ month }: { month: string }) {
  const t = useT();
  const [kind, setKind] = useState<"fixed" | "marketing">("marketing");
  const [category, setCategory] = useState("paid_ads");
  const cats = kind === "fixed" ? FIXED : MARKETING;
  return (
    <ActionForm action={saveFinanceEntryAction} resetOnSuccess successMessage="تم الحفظ" className="yd-form">
      <label className="yd-field"><span>{t("الشهر")}</span><input type="month" name="month" defaultValue={month} required dir="ltr" /></label>
      <label className="yd-field"><span>{t("النوع")}</span>
        <select name="kind" value={kind} onChange={(e) => { const k = e.target.value as "fixed" | "marketing"; setKind(k); setCategory(k === "fixed" ? "servers" : "paid_ads"); }}>
          <option value="marketing">{t("تسويق")}</option><option value="fixed">{t("تكلفة ثابتة")}</option>
        </select>
      </label>
      <label className="yd-field"><span>{t("البند")}</span>
        <select name="category" value={category} onChange={(e) => setCategory(e.target.value)}>{cats.map((c) => <option key={c} value={c}>{t(CATEGORY_LABEL[c])}</option>)}</select>
      </label>
      <label className="yd-field"><span>{t("المبلغ بالدولار")}</span><input type="number" name="amount_usd" min={0} step="0.01" required dir="ltr" /></label>
      {kind === "fixed" && <label className="yd-check"><input type="checkbox" name="cogs" defaultChecked={["servers", "database", "email", "ai"].includes(category)} key={category} />{t("ضمن تكلفة تقديم الخدمة")}</label>}
      <label className="yd-field wide"><span>{t("ملاحظة")}</span><input type="text" name="note" maxLength={300} /></label>
      <SubmitButton label="حفظ" className="yd-btn primary" />
    </ActionForm>
  );
}

export function DeleteEntry({ id }: { id: string }) {
  const t = useT();
  return (
    <ActionForm action={deleteFinanceEntryAction} guardUnsaved={false} className="yd-inline-form">
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="yd-btn ghost" aria-label={t("حذف")} onClick={(e) => { if (!confirm(t("حذف هذا البند؟"))) e.preventDefault(); }}>×</button>
    </ActionForm>
  );
}
