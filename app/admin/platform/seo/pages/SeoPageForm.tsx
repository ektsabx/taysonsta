"use client";

import { useEffect, useRef } from "react";
import { ActionForm, CheckboxField, FormSection, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { useT } from "@/components/bos/I18n";
import { seoBase, type SeoKind } from "@/lib/yolias/seo-pages";
import { saveSeoPageAction } from "../actions";

export interface SeoFormValues {
  id: string | null;
  kind: SeoKind;
  slug: string;
  status: string;
  scheduledAt: string;
  sort: number;
  primaryKeyword: string;
  secondaryKeywords: string;
  origin: "ai_draft" | "human";
  format: "versus" | "list";
  competitor: string;
  tools: string;
  links: string;
  sources: string;
  canonical: string;
  robots: "index" | "noindex";
  schema: "auto" | "none";
  en: Lang;
  ar: Lang;
}
export interface Lang {
  title: string; summary: string; body: string; metaTitle: string; metaDescription: string; h1: string; answer: string;
  audience: string; criteria: string; steps: string; compare: string; faq: string; ctaTitle: string; ctaBody: string; ctaLabel: string; prompt: string;
}

const statusOptions = [
  { value: "draft", label: "مسودة (لا تظهر)" },
  { value: "scheduled", label: "مجدولة (تظهر في الموعد)" },
  { value: "published", label: "منشورة" },
  { value: "hidden", label: "مخفية من الموقع" },
];

// One SEO page, both languages side by side (D-257). Structured fields are
// plain lines; the hint under each says the format.
export function SeoPageForm({ v, competitors }: { v: SeoFormValues; competitors: { slug: string; name: string }[] }) {
  const t = useT();
  // The publish time is typed in the browser's time zone; the offset goes with it.
  const tzRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (tzRef.current) tzRef.current.value = String(new Date().getTimezoneOffset());
    const field = document.querySelector<HTMLInputElement>('input[name="scheduled_at"]');
    if (field && v.scheduledAt) {
      const d = new Date(v.scheduledAt);
      field.value = new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    }
  }, [v.scheduledAt]);
  const compOptions = [{ value: "", label: "—" }, ...competitors.map((c) => ({ value: c.slug, label: c.name }))];
  const lang = (l: "en" | "ar") => {
    const x = v[l];
    const dir = l === "ar" ? "rtl" : "ltr";
    const n = (k: string) => `${k}_${l}`;
    return (
      <FormSection title={l === "en" ? "English" : "العربية"}>
        <TextField name={n("title")} label="اسم الصفحة" dir={dir} required defaultValue={x.title} span={2} hint="يظهر في القوائم ومسار التنقل" />
        <TextField name={n("h1")} label="العنوان الرئيسي (H1)" dir={dir} defaultValue={x.h1} span={2} hint="فارغ = اسم الصفحة" />
        <TextField name={n("meta_title")} label="عنوان البحث (Meta title)" dir={dir} defaultValue={x.metaTitle} span={2} hint="حتى 60 حرفًا تقريبًا؛ يُضاف «| Yolias» إن لم يكن فيه" />
        <TextAreaField name={n("meta_description")} label="وصف البحث (Meta description)" dir={dir} rows={2} defaultValue={x.metaDescription} span={2} hint="حتى 160 حرفًا تقريبًا" />
        <TextAreaField name={n("summary")} label="الفقرة الافتتاحية" dir={dir} rows={3} defaultValue={x.summary} span={2} />
        <TextAreaField name={n("answer")} label="الإجابة المباشرة" dir={dir} rows={3} defaultValue={x.answer} span={2} hint="جملتان أو ثلاث تجيب عن البحث مباشرة" />
        {v.kind === "compare" && <TextAreaField name={n("compare")} label="جدول المقارنة" dir={dir} rows={8} defaultValue={x.compare} span={2} hint="سطر لكل نقطة: النقطة | يولياس | المنافس. صف الأسعار يُضاف تلقائيًا من الأسعار الموثقة." />}
        <TextAreaField name={n("audience")} label="لمن هذه الصفحة" dir={dir} rows={3} defaultValue={x.audience} span={2} hint="سطر لكل بند" />
        <TextAreaField name={n("criteria")} label={v.kind === "alternatives" || v.kind === "compare" ? "معايير الاختيار" : "معايير الشركات المناسبة"} dir={dir} rows={4} defaultValue={x.criteria} span={2} hint="سطر لكل بند" />
        <TextAreaField name={n("steps")} label="الخطوات" dir={dir} rows={5} defaultValue={x.steps} span={2} hint="سطر لكل خطوة: العنوان | ماذا تفعل" />
        {v.kind === "template" && <TextAreaField name={n("prompt")} label="الطلب الذي يفتح به Yolias AI" dir={dir} rows={4} defaultValue={x.prompt} span={2} hint="يظهر في الصفحة ويفتح في Yolias AI ليعدّله العضو قبل التشغيل" />}
        <TextAreaField name={n("body")} label="المحتوى (Markdown)" dir={dir} rows={16} defaultValue={x.body} span={2} hint="## عنوان · ### فرعي · - قائمة · 1. مرقّمة · > ملاحظة · | جدول | · ![وصف الصورة](/رابط) · [نص](/رابط)" />
        <TextAreaField name={n("faq")} label="الأسئلة الشائعة" dir={dir} rows={8} defaultValue={x.faq} span={2} hint={l === "ar" ? "س: السؤال ثم ج: الإجابة، وسطر فارغ بين كل سؤالين" : "Q: question then A: answer, blank line between pairs"} />
        <TextField name={n("cta_title")} label="عنوان الدعوة لاتخاذ إجراء" dir={dir} defaultValue={x.ctaTitle} span={2} />
        <TextAreaField name={n("cta_body")} label="نص الدعوة" dir={dir} rows={2} defaultValue={x.ctaBody} span={2} />
        <TextField name={n("cta_label")} label="نص الزر" dir={dir} defaultValue={x.ctaLabel} span={2} hint="فارغ = «جرّب يولياس». الزر يفتح التسجيل، أو القالب في Yolias AI." />
      </FormSection>
    );
  };
  return (
    <ActionForm action={saveSeoPageAction} successMessage="تم الحفظ">
      {v.id && <input type="hidden" name="id" value={v.id} />}
      <input type="hidden" name="kind" value={v.kind} />
      <input type="hidden" name="origin" value={v.origin} />
      <input type="hidden" name="tz_offset" ref={tzRef} defaultValue="" />
      <FormSection title="الصفحة">
        <TextField name="slug" label="الرابط" dir="ltr" required defaultValue={v.slug} hint={`${seoBase[v.kind]}/…`} />
        <SelectField name="status" label="الحالة" defaultValue={v.status} options={statusOptions} />
        <TextField name="scheduled_at" label="موعد النشر (للمجدولة)" type="datetime-local" hint="بتوقيت جهازك" />
        <TextField name="sort" label="الترتيب" type="number" step={1} defaultValue={String(v.sort)} />
        <TextField name="primary_keyword" label="الكلمة الرئيسية المستهدفة" dir="ltr" defaultValue={v.primaryKeyword} hint="صفحة واحدة لكل كلمة رئيسية" />
        <TextField name="secondary_keywords" label="كلمات ثانوية" dir="ltr" defaultValue={v.secondaryKeywords} hint="مفصولة بفواصل" />
        {v.kind === "compare" && <SelectField name="format" label="الشكل" defaultValue={v.format} options={[{ value: "versus", label: "يولياس مقابل منافس واحد" }, { value: "list", label: "قائمة أدوات (أفضل X)" }]} />}
        {(v.kind === "compare" || v.kind === "alternatives") && <SelectField name="competitor" label={v.kind === "alternatives" ? "المنتج الذي نعرض بدائله" : "المنافس"} defaultValue={v.competitor} options={compOptions} />}
        {(v.kind === "compare" || v.kind === "alternatives") && <TextField name="tools" label="الأدوات المعروضة (بالترتيب)" dir="ltr" defaultValue={v.tools} hint={t("معرّفات المنافسين مفصولة بفواصل: {list}", { list: competitors.map((c) => c.slug).join(", ") })} span={2} />}
      </FormSection>
      <div className="content-langs">{lang("en")}{lang("ar")}</div>
      <FormSection title="الروابط والفهرسة">
        <TextAreaField name="links" label="روابط داخلية" dir="ltr" rows={4} defaultValue={v.links} span={2} hint="سطر لكل رابط: /path | English label | الاسم بالعربية. تُضاف تلقائيًا 3 صفحات من نفس النوع." />
        <TextField name="canonical" label="الرابط الأساسي (Canonical)" dir="ltr" defaultValue={v.canonical} hint="فارغ = رابط الصفحة نفسها. ضع مسار صفحة أخرى فقط إذا كانت هذه نسخة منها" />
        <SelectField name="robots" label="الفهرسة" defaultValue={v.robots} options={[{ value: "index", label: "قابلة للفهرسة" }, { value: "noindex", label: "noindex (لا تظهر في البحث)" }]} />
        <SelectField name="schema" label="البيانات المنظمة" defaultValue={v.schema} options={[{ value: "auto", label: "تلقائية (WebPage وBreadcrumb وFAQ من المحتوى)" }, { value: "none", label: "بدون" }]} />
        <TextAreaField name="sources" label="مصادر المعلومات (للمراجعة، لا تظهر)" dir="ltr" rows={3} defaultValue={v.sources} span={2} hint="رابط لكل سطر لكل ادعاء في الصفحة" />
        <CheckboxField name="allow_shared" label="السماح بنفس الكلمة الرئيسية لصفحة أخرى (اذكر السبب في المصادر)" />
        <CheckboxField name="reviewed" label="راجعت المحتوى والمصادر، ويمكن نشره" defaultChecked={v.origin === "human"} hint={v.origin === "human" ? undefined : "الصفحة مسودة كتبها الذكاء الاصطناعي: لا تُنشر قبل هذه المراجعة"} />
      </FormSection>
      <SubmitButton />
    </ActionForm>
  );
}
