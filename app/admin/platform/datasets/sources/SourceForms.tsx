"use client";

import { ActionForm, CheckboxField, FormSection, SelectField, SubmitButton, TextField } from "@/components/bos/Form";
import { openSourceAction } from "../actions";

const keys = [
  { value: "office", label: "مكاتب وشركات (office)" }, { value: "shop", label: "متاجر (shop)" }, { value: "amenity", label: "خدمات ومطاعم (amenity)" },
  { value: "craft", label: "حِرف وورش (craft)" }, { value: "healthcare", label: "رعاية صحية (healthcare)" }, { value: "tourism", label: "فنادق وسياحة (tourism)" },
  { value: "industrial", label: "مصانع (industrial)" },
];

export function OsmForm() {
  return (
    <ActionForm action={openSourceAction} successMessage="تم الاستيراد">
      <input type="hidden" name="source" value="osm" />
      <FormSection>
        <TextField name="country" label="الدولة (رمز ISO)" required placeholder="EG" dir="ltr" maxLength={2} />
        <TextField name="city" label="المدينة (اختياري)" placeholder="Cairo" dir="auto" maxLength={80} hint="بالاسم الإنجليزي أو العربي كما في الخريطة." />
        <SelectField name="key" label="نوع النشاط" defaultValue="office" options={keys} />
        <TextField name="value" label="التصنيف بالتحديد (اختياري)" placeholder="company, lawyer, restaurant" dir="ltr" maxLength={60} />
        <TextField name="limit" label="الحد الأقصى" type="number" min={10} max={5000} defaultValue="1000" />
        <CheckboxField name="contact_only" label="فقط اللي لها موقع أو هاتف أو بريد" defaultChecked />
        <CheckboxField name="enrich" label="إثراء من مواقعها بعد الاستيراد" defaultChecked />
      </FormSection>
      <SubmitButton label="اسحب من OpenStreetMap" pendingLabel="جارٍ السحب (حتى دقيقتين)…" />
    </ActionForm>
  );
}

export function SireneForm() {
  return (
    <ActionForm action={openSourceAction} successMessage="تم الاستيراد">
      <input type="hidden" name="source" value="sirene" />
      <FormSection>
        <TextField name="naf" label="كود النشاط (NAF)" required placeholder="62.01Z" dir="ltr" maxLength={6} />
        <TextField name="departement" label="المقاطعة (اختياري)" placeholder="75" dir="ltr" maxLength={3} />
        <TextField name="pages" label="عدد الصفحات (25 شركة لكل صفحة)" type="number" min={1} max={40} defaultValue="8" />
      </FormSection>
      <SubmitButton label="اسحب من Sirene" pendingLabel="جارٍ السحب…" />
    </ActionForm>
  );
}

export function CompaniesHouseForm() {
  return (
    <ActionForm action={openSourceAction} successMessage="تم الاستيراد">
      <input type="hidden" name="source" value="companies_house" />
      <FormSection>
        <TextField name="sic" label="أكواد SIC" required placeholder="62012, 62020" dir="ltr" maxLength={80} />
        <TextField name="location" label="المدينة (اختياري)" placeholder="London" dir="ltr" maxLength={80} />
        <TextField name="limit" label="الحد الأقصى" type="number" min={10} max={2000} defaultValue="500" />
      </FormSection>
      <SubmitButton label="اسحب من Companies House" pendingLabel="جارٍ السحب…" />
    </ActionForm>
  );
}

export function CommonCrawlForm() {
  return (
    <ActionForm action={openSourceAction} successMessage="تم الاستيراد">
      <input type="hidden" name="source" value="common_crawl" />
      <FormSection>
        <TextField name="suffix" label="امتداد المواقع" required placeholder="com.eg" dir="ltr" maxLength={40} />
        <TextField name="country" label="الدولة (رمز ISO)" placeholder="EG" dir="ltr" maxLength={2} />
        <TextField name="limit" label="عدد المواقع" type="number" min={10} max={3000} defaultValue="500" />
      </FormSection>
      <SubmitButton label="اسحب المواقع وابدأ الزاحف" pendingLabel="جارٍ السحب…" />
    </ActionForm>
  );
}
