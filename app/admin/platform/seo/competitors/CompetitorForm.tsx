"use client";

import { ActionForm, CheckboxField, FormSection, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { saveCompetitorAction } from "../actions";

export interface CompetitorValues {
  id: string | null; slug: string; name: string; website: string; pricingUrl: string; publishesPrices: "yes" | "no" | "unknown"; pricing: string;
  en: { summary: string; bestFor: string; strengths: string; limits: string };
  ar: { summary: string; bestFor: string; strengths: string; limits: string };
}

// One competitor (D-257). Prices are one line each with their source and the
// date they were checked; "verified" puts a price on the website.
export function CompetitorForm({ v }: { v: CompetitorValues }) {
  const side = (l: "en" | "ar") => {
    const dir = l === "ar" ? "rtl" : "ltr";
    return (
      <FormSection title={l === "en" ? "English" : "العربية"}>
        <TextAreaField name={`summary_${l}`} label="ما هو المنتج" dir={dir} rows={3} defaultValue={v[l].summary} span={2} hint="من موقعه الرسمي، بدون رأي" />
        <TextAreaField name={`best_for_${l}`} label="الأنسب لـ" dir={dir} rows={2} defaultValue={v[l].bestFor} span={2} />
        <TextAreaField name={`strengths_${l}`} label="نقاط القوة" dir={dir} rows={4} defaultValue={v[l].strengths} span={2} hint="سطر لكل نقطة" />
        <TextAreaField name={`limits_${l}`} label="الحدود" dir={dir} rows={4} defaultValue={v[l].limits} span={2} hint="سطر لكل نقطة، مما يقوله المنتج نفسه أو ما لا يقدمه" />
      </FormSection>
    );
  };
  return (
    <ActionForm action={saveCompetitorAction} successMessage="تم الحفظ">
      {v.id && <input type="hidden" name="id" value={v.id} />}
      <FormSection title="المنافس">
        <TextField name="name" label="الاسم" required defaultValue={v.name} />
        <TextField name="slug" label="المعرّف" dir="ltr" required defaultValue={v.slug} hint="apollo، clay…" />
        <TextField name="website" label="الموقع الرسمي" dir="ltr" required defaultValue={v.website} placeholder="https://" />
        <TextField name="pricing_url" label="صفحة الأسعار" dir="ltr" defaultValue={v.pricingUrl} placeholder="https://" />
        <SelectField name="publishes_prices" label="هل ينشر أسعاره؟" defaultValue={v.publishesPrices} options={[{ value: "unknown", label: "غير معروف" }, { value: "yes", label: "نعم" }, { value: "no", label: "لا، بعرض سعر من المبيعات" }]} />
        <TextAreaField name="pricing" label="الأسعار" dir="ltr" rows={6} defaultValue={v.pricing} span={2} hint="سطر لكل خطة: الخطة | السعر | الفترة | رابط المصدر | تاريخ المراجعة YYYY-MM-DD | verified أو unverified" />
      </FormSection>
      <div className="content-langs">{side("en")}{side("ar")}</div>
      <CheckboxField name="reviewed" label="راجعت المعلومات الآن من موقع المنتج الرسمي" hint="يسجّل تاريخ المراجعة واسمك" />
      <SubmitButton />
    </ActionForm>
  );
}
