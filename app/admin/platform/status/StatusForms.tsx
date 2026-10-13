"use client";

import { useState } from "react";
import { ActionForm, CheckboxField, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { useT } from "@/components/bos/I18n";
import { componentAction, createIncidentAction, settingsAction, updateIncidentAction } from "./actions";

const impacts = [{ value: "degraded", label: "أداء أبطأ" }, { value: "partial_outage", label: "توقف جزئي" }, { value: "major_outage", label: "توقف كامل" }];

export function NewIncidentForm({ components }: { components: { id: string; name: string }[] }) {
  const t = useT();
  const [kind, setKind] = useState("incident");
  return (
    <ActionForm action={createIncidentAction} successMessage="تم النشر على صفحة الحالة" resetOnSuccess>
      <div className="bos-form-grid">
        <SelectField name="kind" label="النوع" value={kind} onChange={(e) => setKind(e.target.value)} options={[{ value: "incident", label: "عطل" }, { value: "maintenance", label: "صيانة مجدولة" }]} />
        {kind === "incident" ? <SelectField name="impact" label="درجة التأثير" options={impacts} /> : null}
        <TextField name="title" label="العنوان (يظهر للعملاء)" maxLength={200} required span="all" />
        {kind === "maintenance" ? <><TextField name="scheduledFor" label="البداية" type="datetime-local" required /><TextField name="scheduledUntil" label="النهاية" type="datetime-local" /></> : null}
        <div className="bos-field span-all">
          <label>{t("الخدمات المتأثرة")}</label>
          <div className="bos-row" style={{ gap: 12, flexWrap: "wrap" }}>
            {components.map((c) => <label key={c.id} className="bos-check"><input type="checkbox" name="components" value={c.id} /> {c.name}</label>)}
          </div>
        </div>
        <TextAreaField name="body" label="التحديث الأول (يظهر للعملاء)" rows={3} maxLength={4000} required />
      </div>
      <SubmitButton label="نشر" />
    </ActionForm>
  );
}

export function IncidentUpdateForm({ id, kind }: { id: string; kind: string }) {
  const opts = kind === "maintenance"
    ? [{ value: "in_progress", label: "جارية" }, { value: "completed", label: "اكتملت" }, { value: "scheduled", label: "مجدولة" }]
    : [{ value: "investigating", label: "قيد التحقق" }, { value: "identified", label: "تم تحديد السبب" }, { value: "monitoring", label: "تحت المراقبة" }, { value: "resolved", label: "تم الحل" }];
  return (
    <ActionForm action={updateIncidentAction} successMessage="تم نشر التحديث" resetOnSuccess guardUnsaved={false}>
      <input type="hidden" name="id" value={id} />
      <div className="bos-form-grid">
        <SelectField name="status" label="الحالة" options={opts} />
        {kind === "incident" ? <SelectField name="impact" label="درجة التأثير" placeholder="بدون تغيير" options={impacts} /> : null}
        <TextAreaField name="body" label="نص التحديث (يظهر للعملاء)" rows={2} maxLength={4000} required />
      </div>
      <SubmitButton label="نشر التحديث" className="admin-btn secondary" />
    </ActionForm>
  );
}

export function ComponentForm({ c }: { c: { id: string; name_en: string; name_ar: string; description_en: string | null; description_ar: string | null; is_public: boolean; check_enabled: boolean; sort: number } }) {
  return (
    <ActionForm action={componentAction} successMessage="تم الحفظ" guardUnsaved={false}>
      <input type="hidden" name="id" value={c.id} />
      <div className="bos-form-grid">
        <TextField name="name_en" label="الاسم (إنجليزي)" defaultValue={c.name_en} maxLength={60} required dir="ltr" />
        <TextField name="name_ar" label="الاسم (عربي)" defaultValue={c.name_ar} maxLength={60} required />
        <TextField name="description_en" label="الوصف (إنجليزي)" defaultValue={c.description_en ?? ""} maxLength={200} dir="ltr" />
        <TextField name="description_ar" label="الوصف (عربي)" defaultValue={c.description_ar ?? ""} maxLength={200} />
        <TextField name="sort" label="الترتيب" defaultValue={String(c.sort)} inputMode="numeric" />
      </div>
      <CheckboxField name="is_public" label="تظهر على صفحة الحالة" defaultChecked={c.is_public} />
      <CheckboxField name="check_enabled" label="الفحص الآلي مفعّل" defaultChecked={c.check_enabled} />
      <SubmitButton className="admin-btn small" />
    </ActionForm>
  );
}

export function SettingsForm({ v }: { v: { intervalMinutes: number; failThreshold: number; queueDegradedMinutes: number; queueOutageMinutes: number; failureRateDegraded: number; failureRateOutage: number; slowMs: number } }) {
  return (
    <ActionForm action={settingsAction} successMessage="تم الحفظ">
      <div className="bos-form-grid">
        <TextField name="intervalMinutes" label="الفحص كل (دقائق)" defaultValue={String(v.intervalMinutes)} inputMode="numeric" />
        <TextField name="failThreshold" label="عدد الفحوص الفاشلة المتتالية قبل إظهار العطل" defaultValue={String(v.failThreshold)} inputMode="numeric" />
        <TextField name="slowMs" label="يعتبر بطيئًا بعد (ملي ثانية)" defaultValue={String(v.slowMs)} inputMode="numeric" />
        <TextField name="queueDegradedMinutes" label="انتظار البحث: بطء بعد (دقائق)" defaultValue={String(v.queueDegradedMinutes)} inputMode="numeric" />
        <TextField name="queueOutageMinutes" label="انتظار البحث: توقف جزئي بعد (دقائق)" defaultValue={String(v.queueOutageMinutes)} inputMode="numeric" />
        <TextField name="failureRateDegraded" label="نسبة الفشل للبطء (%)" defaultValue={String(Math.round(v.failureRateDegraded * 100))} inputMode="numeric" />
        <TextField name="failureRateOutage" label="نسبة الفشل للتوقف الجزئي (%)" defaultValue={String(Math.round(v.failureRateOutage * 100))} inputMode="numeric" />
      </div>
      <SubmitButton />
    </ActionForm>
  );
}
