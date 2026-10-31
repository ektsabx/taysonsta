// Targeting schema (owner, 2026-10-31, D-272): every targeting field is
// described once here (id, type, operators, options, which channels support
// it, where its data comes from), and the audience editor builds its
// selectors from this list. A new field = a new entry, not a new component.
// Options carry both languages; the value stored is the English label (what
// the search understands). Only fields the search can actually use are here:
// no age, gender or other personal traits (B2B, and not ours to target).

import type { ChannelId } from "./channels";

export type Lang = "en" | "ar";
export interface Option { value: string; en: string; ar: string }
export type FieldType = "country" | "multi" | "tags" | "range" | "toggle";
export type FieldGroup = "geo" | "company" | "people" | "signals";

export interface TargetingField {
  id: TargetingKey;
  group: FieldGroup;
  type: FieldType;
  label: { en: string; ar: string };
  hint?: { en: string; ar: string };
  /** include / exclude: both are offered where the search can honour an exclusion. */
  operators: ("include" | "exclude")[];
  options?: Option[];
  /** Free values beside the list (a job title or a city not in it). */
  custom?: boolean;
  channels: ChannelId[];
  source: "search" | "workspace";
}

const o = (en: string, ar: string): Option => ({ value: en, en, ar });

export const INDUSTRIES: Option[] = [
  o("Software & SaaS", "البرمجيات وSaaS"), o("IT services", "خدمات تقنية المعلومات"), o("Fintech", "التقنية المالية"), o("Banking & finance", "البنوك والتمويل"),
  o("Insurance", "التأمين"), o("Real estate", "العقارات"), o("Construction", "المقاولات والبناء"), o("Architecture & engineering", "العمارة والهندسة"),
  o("E-commerce", "التجارة الإلكترونية"), o("Retail", "التجزئة"), o("Wholesale & distribution", "الجملة والتوزيع"), o("Manufacturing", "التصنيع"),
  o("Logistics & transport", "اللوجستيات والنقل"), o("Automotive", "السيارات"), o("Healthcare & clinics", "الرعاية الصحية والعيادات"), o("Dental", "طب الأسنان"),
  o("Pharma & medical devices", "الأدوية والأجهزة الطبية"), o("Education & training", "التعليم والتدريب"), o("Hospitality & hotels", "الضيافة والفنادق"), o("Restaurants & cafes", "المطاعم والمقاهي"),
  o("Food & beverage", "الأغذية والمشروبات"), o("Travel & tourism", "السفر والسياحة"), o("Marketing & advertising agencies", "وكالات التسويق والإعلان"), o("Media & publishing", "الإعلام والنشر"),
  o("Consulting", "الاستشارات"), o("Legal services", "الخدمات القانونية"), o("Accounting", "المحاسبة"), o("HR & recruitment", "الموارد البشرية والتوظيف"),
  o("Telecommunications", "الاتصالات"), o("Energy & utilities", "الطاقة والمرافق"), o("Oil & gas", "النفط والغاز"), o("Agriculture", "الزراعة"),
  o("Beauty & wellness", "التجميل والعناية"), o("Fitness & gyms", "اللياقة والصالات الرياضية"), o("Events", "الفعاليات"), o("Security", "الأمن والحراسة"),
  o("Facilities & cleaning", "إدارة المرافق والنظافة"), o("Non-profit", "القطاع غير الربحي"), o("Government", "الجهات الحكومية"), o("Gaming & entertainment", "الألعاب والترفيه"),
];

export const COMPANY_TYPES: Option[] = [
  o("Startup", "شركة ناشئة"), o("Small business", "شركة صغيرة"), o("Medium business", "شركة متوسطة"), o("Enterprise", "شركة كبيرة"),
  o("Agency", "وكالة"), o("Consultancy", "شركة استشارات"), o("Software company", "شركة برمجيات"), o("E-commerce business", "متجر إلكتروني"),
  o("Freelancer / independent business", "مستقل / نشاط فردي"), o("Local business", "نشاط محلي"),
];

export const SIZES: Option[] = [
  { value: "1-10", en: "1–10", ar: "1–10" }, { value: "11-50", en: "11–50", ar: "11–50" }, { value: "51-200", en: "51–200", ar: "51–200" },
  { value: "201-500", en: "201–500", ar: "201–500" }, { value: "501-1000", en: "501–1,000", ar: "501–1,000" }, { value: "1001-", en: "1,000+", ar: "+1,000" },
];

export const SENIORITY: Option[] = [
  o("Owner / Founder", "مالك / مؤسس"), o("C-level", "إدارة عليا"), o("VP", "نائب رئيس"), o("Director", "مدير إدارة"), o("Head", "رئيس قسم"), o("Manager", "مدير"),
];

export const DEPARTMENTS: Option[] = [
  o("Executive", "الإدارة التنفيذية"), o("Marketing", "التسويق"), o("Sales", "المبيعات"), o("Operations", "العمليات"), o("Finance", "المالية"),
  o("Human resources", "الموارد البشرية"), o("Technology", "التقنية"), o("Product", "المنتج"), o("Procurement", "المشتريات"), o("Customer success", "نجاح العملاء"),
];

export const JOB_TITLES: Option[] = [
  o("CEO", "الرئيس التنفيذي"), o("Founder", "المؤسس"), o("Co-Founder", "شريك مؤسس"), o("Owner", "المالك"), o("Managing Director", "المدير العام"), o("General Manager", "المدير العام التنفيذي"),
  o("COO", "مدير العمليات التنفيذي"), o("CFO", "المدير المالي"), o("CTO", "المدير التقني"), o("CMO", "مدير التسويق التنفيذي"), o("Marketing Director", "مدير التسويق"), o("Head of Marketing", "رئيس التسويق"),
  o("Marketing Manager", "مدير تسويق"), o("Sales Director", "مدير المبيعات"), o("Head of Sales", "رئيس المبيعات"), o("Sales Manager", "مدير مبيعات"), o("Business Development Manager", "مدير تطوير الأعمال"),
  o("Operations Manager", "مدير العمليات"), o("HR Director", "مدير الموارد البشرية"), o("HR Manager", "مدير موارد بشرية"), o("Procurement Manager", "مدير المشتريات"), o("IT Manager", "مدير تقنية المعلومات"),
  o("Head of Growth", "رئيس النمو"), o("E-commerce Manager", "مدير التجارة الإلكترونية"), o("Clinic Manager", "مدير العيادة"), o("Medical Director", "المدير الطبي"), o("Practice Owner", "صاحب العيادة"),
  o("Branch Manager", "مدير الفرع"), o("Product Manager", "مدير المنتج"), o("Finance Manager", "مدير مالي"),
];

export const FUNDING: Option[] = [o("Pre-seed", "ما قبل التأسيسية"), o("Seed", "تأسيسية"), o("Series A", "الجولة A"), o("Series B", "الجولة B"), o("Series C+", "الجولة C وما بعدها")];

export type TargetingKey = "countries" | "cities" | "industries" | "company_types" | "sizes" | "hiring" | "funding" | "technologies" | "keywords" | "titles" | "seniority" | "departments";

export const TARGETING: TargetingField[] = [
  { id: "countries", group: "geo", type: "country", label: { en: "Countries", ar: "الدول" }, operators: ["include", "exclude"], channels: ["email"], source: "search" },
  { id: "cities", group: "geo", type: "tags", label: { en: "Cities or regions", ar: "المدن أو المناطق" }, hint: { en: "Inside the countries you picked.", ar: "داخل الدول التي اخترتها." }, operators: ["include"], custom: true, channels: ["email"], source: "search" },
  { id: "industries", group: "company", type: "multi", label: { en: "Industries", ar: "المجالات" }, operators: ["include", "exclude"], options: INDUSTRIES, custom: true, channels: ["email"], source: "search" },
  { id: "company_types", group: "company", type: "multi", label: { en: "Company type", ar: "نوع الشركة" }, operators: ["include"], options: COMPANY_TYPES, channels: ["email"], source: "search" },
  { id: "sizes", group: "company", type: "multi", label: { en: "Employees", ar: "عدد الموظفين" }, operators: ["include"], options: SIZES, channels: ["email"], source: "search" },
  { id: "hiring", group: "signals", type: "toggle", label: { en: "Hiring now", ar: "توظّف الآن" }, operators: ["include"], channels: ["email"], source: "search" },
  { id: "funding", group: "signals", type: "multi", label: { en: "Funding stage", ar: "مرحلة التمويل" }, hint: { en: "Only where the data is published.", ar: "حيث تكون البيانات منشورة فقط." }, operators: ["include"], options: FUNDING, channels: ["email"], source: "search" },
  { id: "technologies", group: "signals", type: "tags", label: { en: "Technologies they use", ar: "تقنيات يستخدمونها" }, operators: ["include"], custom: true, channels: ["email"], source: "search" },
  { id: "keywords", group: "signals", type: "tags", label: { en: "Keywords (services, needs, website topics)", ar: "كلمات مفتاحية (خدمات، احتياجات، موضوعات الموقع)" }, operators: ["include", "exclude"], custom: true, channels: ["email"], source: "search" },
  { id: "titles", group: "people", type: "multi", label: { en: "Job titles", ar: "المسميات الوظيفية" }, operators: ["include", "exclude"], options: JOB_TITLES, custom: true, channels: ["email"], source: "search" },
  { id: "seniority", group: "people", type: "multi", label: { en: "Seniority", ar: "المستوى الوظيفي" }, operators: ["include"], options: SENIORITY, channels: ["email"], source: "search" },
  { id: "departments", group: "people", type: "multi", label: { en: "Department", ar: "الإدارة" }, operators: ["include"], options: DEPARTMENTS, channels: ["email"], source: "search" },
];

/** What an audience group targets: per field, the values to include and to exclude. */
export type Targeting = Partial<Record<TargetingKey, { include: string[]; exclude?: string[] }>> & { description?: string };

export const values = (t: Targeting, k: TargetingKey) => t[k]?.include ?? [];
export const excluded = (t: Targeting, k: TargetingKey) => t[k]?.exclude ?? [];

/** Any field set at all (an empty audience can't be searched). */
export function hasTargeting(t: Targeting): boolean {
  return Boolean(t.description?.trim()) || TARGETING.some((f) => values(t, f.id).length > 0);
}

/**
 * The audience in the words the search already understands (the same
 * request a member could type). Values OR inside a field, fields AND across.
 */
export function targetingPrompt(t: Targeting, countryName: (code: string) => string): string {
  const line = (label: string, xs: string[]) => (xs.length ? `${label}: ${xs.join(" OR ")}` : "");
  const sizes = values(t, "sizes").map((s) => (s.endsWith("-") ? `${s.slice(0, -1)}+` : s.replace("-", " to ")));
  return [
    t.description?.trim() ?? "",
    line("Countries", values(t, "countries").map(countryName)),
    line("Cities", values(t, "cities")),
    line("Industries", values(t, "industries")),
    excluded(t, "industries").length ? `Exclude industries: ${excluded(t, "industries").join(", ")}` : "",
    line("Company type", values(t, "company_types")),
    sizes.length ? `Company size (employees): ${sizes.join(" OR ")}` : "",
    values(t, "hiring").length ? "Only companies hiring now" : "",
    line("Funding stage", values(t, "funding")),
    line("Uses technologies", values(t, "technologies")),
    line("Keywords", values(t, "keywords")),
    excluded(t, "keywords").length ? `Exclude: ${excluded(t, "keywords").join(", ")}` : "",
    line("Decision makers", values(t, "titles")),
    excluded(t, "titles").length ? `Not these roles: ${excluded(t, "titles").join(", ")}` : "",
    line("Seniority", values(t, "seniority")),
    line("Department", values(t, "departments")),
  ].filter(Boolean).join("\n");
}

/** The employee range the sizes cover (for the search's own min / max), or nulls. */
export function sizeRange(t: Targeting): { min: number | null; max: number | null } {
  const bands = values(t, "sizes").map((s) => s.split("-").map((x) => (x ? Number(x) : null)));
  if (!bands.length) return { min: null, max: null };
  const mins = bands.map((b) => b[0] ?? 1), maxs = bands.map((b) => b[1] ?? null);
  return { min: Math.min(...mins), max: maxs.includes(null) ? null : Math.max(...(maxs as number[])) };
}

export const optionLabel = (f: TargetingField, value: string, lang: Lang) => f.options?.find((x) => x.value === value)?.[lang] ?? value;
