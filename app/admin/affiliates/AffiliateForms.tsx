"use client";

import { useState } from "react";
import { ActionForm, CheckboxField, SelectField, SubmitButton, TextAreaField, TextField, FormSection } from "@/components/bos/Form";
import { useT } from "@/components/bos/I18n";
import { adjustAction, affiliateNoteAction, affiliateStatusAction, commissionActionForm, payoutActionForm, programAction } from "./actions";

const statusMoves: Record<string, { value: string; label: string }[]> = {
  pending: [{ value: "approved", label: "موافقة" }, { value: "rejected", label: "رفض" }],
  rejected: [{ value: "approved", label: "موافقة (إعادة نظر)" }],
  approved: [{ value: "suspended", label: "تعليق" }, { value: "disabled", label: "إغلاق نهائي" }],
  suspended: [{ value: "approved", label: "إعادة تفعيل" }, { value: "disabled", label: "إغلاق نهائي" }],
  disabled: [],
};

export function AffiliateStatusForm({ id, status }: { id: string; status: string }) {
  const options = statusMoves[status] ?? [];
  if (!options.length) return null;
  return (
    <ActionForm action={affiliateStatusAction} successMessage="تم تحديث الحالة" guardUnsaved={false}>
      <input type="hidden" name="id" value={id} />
      <div className="bos-form-grid">
        <SelectField name="to" label="الإجراء" options={options} required />
        <TextField name="reason" label="السبب" hint="مطلوب للرفض والتعليق والإغلاق، ويظهر للمسوّق في البريد ولوحته." maxLength={500} />
      </div>
      <SubmitButton label="تنفيذ" pendingLabel="..." />
    </ActionForm>
  );
}

export function NoteForm({ id }: { id: string }) {
  return (
    <ActionForm action={affiliateNoteAction} successMessage="تمت إضافة الملاحظة" resetOnSuccess guardUnsaved={false}>
      <input type="hidden" name="id" value={id} />
      <TextAreaField name="body" label="ملاحظة داخلية" hint="لا تظهر للمسوّق." rows={3} maxLength={4000} required />
      <SubmitButton label="إضافة" pendingLabel="..." className="admin-btn secondary" />
    </ActionForm>
  );
}

export function AdjustForm({ id }: { id: string }) {
  return (
    <ActionForm action={adjustAction} successMessage="تم تسجيل التسوية" resetOnSuccess guardUnsaved={false}>
      <input type="hidden" name="id" value={id} />
      <div className="bos-form-grid">
        <TextField name="amount" label="المبلغ بالدولار" hint="موجب لإضافة مبلغ مستحق، سالب لخصم مبلغ. يظهر كقيد منفصل ولا يغيّر العمولات السابقة." inputMode="decimal" placeholder="25 أو -10" required />
        <TextField name="reason" label="السبب" maxLength={500} required />
      </div>
      <SubmitButton label="تسجيل التسوية" pendingLabel="..." className="admin-btn secondary" />
    </ActionForm>
  );
}

const commissionMoves = (status: string, onHold: boolean) => {
  const o: { value: string; label: string }[] = [];
  if (status === "pending") o.push({ value: "approve", label: "اعتماد مبكر" });
  if (["pending", "approved", "available"].includes(status) && !onHold) o.push({ value: "hold", label: "وضع قيد المراجعة" });
  if (onHold && ["pending", "approved"].includes(status)) o.push({ value: "release", label: "رفع التعليق" });
  if (["pending", "approved", "available"].includes(status)) o.push({ value: "reject", label: "رفض" });
  if (["pending", "approved", "available", "paid"].includes(status)) o.push({ value: "reverse", label: status === "paid" ? "عكس (استرداد من الرصيد القادم)" : "عكس" });
  return o;
};

export function CommissionForm({ id, status, onHold }: { id: string; status: string; onHold: boolean }) {
  const options = commissionMoves(status, onHold);
  if (!options.length) return null;
  return (
    <ActionForm action={commissionActionForm} successMessage="تم" guardUnsaved={false} className="aff-inline-form">
      <input type="hidden" name="id" value={id} />
      <select name="action" aria-label="الإجراء" className="llm-input" required defaultValue="">
        <option value="" disabled>إجراء…</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <input name="reason" className="llm-input" placeholder="السبب (مطلوب للرفض والعكس والتعليق)" maxLength={500} aria-label="السبب" />
      <SubmitButton label="تنفيذ" pendingLabel="..." className="admin-btn small" />
    </ActionForm>
  );
}

const payoutMoves: Record<string, { value: string; label: string }[]> = {
  requested: [{ value: "approved", label: "موافقة" }, { value: "rejected", label: "رفض" }],
  approved: [{ value: "processing", label: "بدء التحويل" }, { value: "rejected", label: "رفض" }],
  processing: [{ value: "paid", label: "تسجيل إتمام الدفع" }, { value: "failed", label: "فشل التحويل" }],
};

export function PayoutForm({ id, status }: { id: string; status: string }) {
  const options = payoutMoves[status] ?? [];
  const [to, setTo] = useState(options[0]?.value ?? "");
  if (!options.length) return null;
  return (
    <ActionForm action={payoutActionForm} successMessage="تم تحديث طلب السحب" guardUnsaved={false}>
      <input type="hidden" name="id" value={id} />
      <div className="bos-form-grid">
        <SelectField name="to" label="الإجراء" options={options} value={to} onChange={(e) => setTo(e.target.value)} required />
        {to === "paid" ? <TextField name="reference" label="مرجع التحويل" hint="رقم العملية في PayPal أو البنك. تسجيل الدفع لا يحوّل أي أموال؛ سجّله بعد أن تحوّل المبلغ بنفسك." maxLength={200} required /> : null}
        {to === "rejected" || to === "failed" ? <TextField name="reason" label="السبب" hint="يظهر للمسوّق. يعود المبلغ إلى رصيده المتاح." maxLength={500} required /> : null}
        <TextField name="note" label="ملاحظة داخلية" maxLength={2000} />
      </div>
      <SubmitButton label="تنفيذ" pendingLabel="..." />
    </ActionForm>
  );
}

export interface ProgramFormValues {
  enabled: boolean; autoApprove: boolean; questions: { id: string; label: string; required: boolean }[];
  commissionType: "percent" | "fixed"; percent: number; fixedUsd: number; plans: string[]; periods: string[]; packs: boolean;
  recurring: boolean; maxPayments: number | null; packMonths: number; attributionDays: number; model: string; minPaymentUsd: number; holdDays: number; minPayoutUsd: number;
  excludedWorkspaces: string[]; excludedEmails: string[]; holdSameIp: boolean; maxSignupsPerIpDay: number;
  payoutMethods: { id: string; label: string; enabled: boolean }[]; includeTestPayments: boolean; notifyAffiliates: boolean; termsVersion: string; terms: string;
}

export function ProgramForm({ v, canEdit }: { v: ProgramFormValues; canEdit: boolean }) {
  const t = useT();
  const qs = [...v.questions, ...Array(Math.max(0, 6 - v.questions.length)).fill({ id: "", label: "", required: false })].slice(0, 6);
  const ms = [...v.payoutMethods, ...Array(Math.max(0, 5 - v.payoutMethods.length)).fill({ id: "", label: "", enabled: false })].slice(0, 5);
  return (
    <ActionForm action={programAction} successMessage="تم حفظ إصدار جديد من إعدادات البرنامج">
      <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0 }}>
        <FormSection title="البرنامج">
          <CheckboxField name="enabled" label="البرنامج مفتوح" defaultChecked={v.enabled} hint="عند الإيقاف: لا طلبات جديدة، ولا إحالات أو عمولات جديدة. العمولات الحالية تبقى كما هي." />
          <CheckboxField name="autoApprove" label="الموافقة التلقائية على الطلبات" defaultChecked={v.autoApprove} />
          <CheckboxField name="notifyAffiliates" label="إرسال إشعارات للمسوّقين" defaultChecked={v.notifyAffiliates} />
          <CheckboxField name="includeTestPayments" label="احتساب دفعات وضع الاختبار" defaultChecked={v.includeTestPayments} hint="للتجربة فقط. لا تفعّله مع الدفع الحقيقي." />
        </FormSection>
        <FormSection title="العمولة">
          <SelectField name="commissionType" label="نوع العمولة" defaultValue={v.commissionType} options={[{ value: "percent", label: "نسبة من الدفعة" }, { value: "fixed", label: "مبلغ ثابت لكل دفعة" }]} />
          <TextField name="percent" label="النسبة %" inputMode="decimal" defaultValue={String(v.percent)} />
          <TextField name="fixedUsd" label="المبلغ الثابت بالدولار" inputMode="decimal" defaultValue={String(v.fixedUsd)} />
          <TextField name="minPaymentUsd" label="الحد الأدنى للدفعة المؤهلة بالدولار" inputMode="decimal" defaultValue={String(v.minPaymentUsd)} />
          <div className="bos-field">
            <label>{t("الخطط المؤهلة")}</label>
            <label className="bos-check"><input type="checkbox" name="plans" value="pro" defaultChecked={v.plans.includes("pro")} /> Pro</label>
            <label className="bos-check"><input type="checkbox" name="plans" value="growth" defaultChecked={v.plans.includes("growth")} /> Growth</label>
          </div>
          <div className="bos-field">
            <label>{t("دورات الفوترة المؤهلة")}</label>
            <label className="bos-check"><input type="checkbox" name="periods" value="monthly" defaultChecked={v.periods.includes("monthly")} /> {t("شهري")}</label>
            <label className="bos-check"><input type="checkbox" name="periods" value="annual" defaultChecked={v.periods.includes("annual")} /> {t("سنوي")}</label>
          </div>
          <CheckboxField name="packs" label="شحن الرصيد (الدفع حسب الاستخدام) مؤهل" defaultChecked={v.packs} />
          <TextField name="packMonths" label="مدة عمولة الشحن (بالشهور)" hint="كل شحن يدفعه العميل خلال هذه المدة من أول دفعة له يأخذ عمولة." inputMode="numeric" defaultValue={String(v.packMonths)} />
          <CheckboxField name="recurring" label="عمولات متكررة على التجديدات" defaultChecked={v.recurring} />
          <TextField name="maxPayments" label="أقصى عدد دفعات لكل عميل" hint="فارغ = طوال مدة الاشتراك. 1 = الدفعة الأولى فقط." inputMode="numeric" defaultValue={v.maxPayments == null ? "" : String(v.maxPayments)} />
          <TextField name="holdDays" label="فترة انتظار الاعتماد (أيام)" hint="بعدها تصبح العمولة متاحة للسحب، إن لم تكن قيد المراجعة." inputMode="numeric" defaultValue={String(v.holdDays)} required />
          <TextField name="minPayoutUsd" label="الحد الأدنى للسحب بالدولار" inputMode="decimal" defaultValue={String(v.minPayoutUsd)} required />
        </FormSection>
        <FormSection title="الإسناد">
          <TextField name="attributionDays" label="مدة الإسناد (أيام)" hint="المدة بين زيارة الرابط والتسجيل." inputMode="numeric" defaultValue={String(v.attributionDays)} required />
          <SelectField name="model" label="نموذج الإسناد" defaultValue={v.model} options={[{ value: "first_touch", label: "أول رابط (First-Touch)" }, { value: "last_touch", label: "آخر رابط (Last-Touch)" }]} />
        </FormSection>
        <FormSection title="المخاطر والاستثناءات">
          <CheckboxField name="holdSameIp" label="وضع العمولة قيد المراجعة إذا كان التسجيل من نفس شبكة المسوّق" defaultChecked={v.holdSameIp} />
          <TextField name="maxSignupsPerIpDay" label="أقصى تسجيلات من نفس الشبكة يوميًا قبل التنبيه" inputMode="numeric" defaultValue={String(v.maxSignupsPerIpDay)} required />
          <TextAreaField name="excludedWorkspaces" label="مساحات عمل مستثناة (معرّف في كل سطر)" rows={2} defaultValue={v.excludedWorkspaces.join("\n")} />
          <TextAreaField name="excludedEmails" label="عملاء مستثنون بالبريد (بريد في كل سطر)" rows={2} defaultValue={v.excludedEmails.join("\n")} />
        </FormSection>
        <FormSection title="أسئلة طلب الانضمام">
          {qs.map((q, i) => (
            <div key={i} className="bos-field span-all aff-row">
              <input name={`q${i}_id`} defaultValue={q.id} placeholder="id" aria-label={t("المعرّف")} dir="ltr" className="aff-id" />
              <input name={`q${i}_label`} defaultValue={q.label} placeholder={t("نص السؤال")} aria-label={t("نص السؤال")} />
              <label className="bos-check"><input type="checkbox" name={`q${i}_required`} defaultChecked={q.required} /> {t("مطلوب")}</label>
            </div>
          ))}
        </FormSection>
        <FormSection title="طرق السحب">
          {ms.map((m, i) => (
            <div key={i} className="bos-field span-all aff-row">
              <input name={`m${i}_id`} defaultValue={m.id} placeholder="paypal" aria-label={t("المعرّف")} dir="ltr" className="aff-id" />
              <input name={`m${i}_label`} defaultValue={m.label} placeholder="PayPal" aria-label={t("الاسم")} />
              <label className="bos-check"><input type="checkbox" name={`m${i}_enabled`} defaultChecked={m.enabled} /> {t("مفعّلة")}</label>
            </div>
          ))}
          <p className="bos-hint span-all">{t("السحب يدوي: يحوّل الفريق المبلغ بنفسه ثم يسجّله. لا يوجد تكامل دفع آلي للمسوّقين.")}</p>
        </FormSection>
        <FormSection title="الشروط">
          <TextField name="termsVersion" label="إصدار الشروط" hint="غيّره عند أي تعديل جوهري؛ يوافق عليه المسوّقون الجدد ويُحفظ مع كل طلب." defaultValue={v.termsVersion} dir="ltr" required />
          <CheckboxField name="notifyTermsChange" label="إبلاغ المسوّقين الحاليين بتغيير الشروط" hint="يُرسل مرة واحدة لكل إصدار جديد." />
          <TextAreaField name="terms" label="نص شروط البرنامج وسياسة العمولات" rows={10} defaultValue={v.terms} required />
          <TextField name="note" label="ملاحظة على هذا التعديل" maxLength={300} span="all" />
        </FormSection>
      </fieldset>
      {canEdit ? <SubmitButton label="حفظ إصدار جديد" /> : null}
    </ActionForm>
  );
}
