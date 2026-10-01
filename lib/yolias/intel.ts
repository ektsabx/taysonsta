import { z } from "zod";

// Admin-side copy of the capability list (Yolias/lib/intel/capabilities.ts);
// keep both in sync. Labels are Arabic source text, translated by <Tx>.
export const intelCapabilities = [
  "company.search", "company.enrich", "company.lookup_local", "person.search", "person.enrich", "email.find",
  "email.verify", "phone.find", "web.search", "web.extract", "tech.detect", "signals.hiring",
] as const;

export const capabilityLabel: Record<string, string> = {
  "company.search": "بحث الشركات",
  "company.enrich": "إثراء بيانات الشركة",
  "company.lookup_local": "البحث المحلي عن الشركات (خرائط)",
  "person.search": "بحث صناع القرار",
  "person.enrich": "إثراء بيانات الشخص",
  "email.find": "إيجاد البريد",
  "email.verify": "التحقق من البريد",
  "phone.find": "إيجاد الهاتف",
  "web.search": "بحث الويب",
  "web.extract": "استخراج صفحات الويب",
  "tech.detect": "رصد التقنيات",
  "signals.hiring": "إشارات التوظيف",
};

export const skipReasonLabel: Record<string, string> = {
  disabled: "معطّل",
  no_adapter: "لا يوجد محوّل في الكود",
  no_capability: "لا يدعم هذه القدرة",
  no_credentials: "لا توجد بيانات اعتماد",
  circuit_open: "متوقف مؤقتاً بعد أخطاء متتالية",
  daily_budget: "تجاوز الميزانية اليومية",
  monthly_budget: "تجاوز الميزانية الشهرية",
  storage_not_allowed: "الترخيص لا يسمح بالتخزين",
};

const nonNeg = z.number().min(0);

export const settingSchemas = {
  routing_ladder: z.array(z.enum(["shared_db", "code", "public", "paid", "llm"])).min(1).refine((a) => new Set(a).size === a.length, "مكرر"),
  ttl_days: z.record(z.string(), z.number().int().positive()),
  circuit_breaker: z.object({ failures: z.number().int().min(1).max(100), open_seconds: z.number().int().min(10).max(86_400) }),
  llm_prices: z.record(
    z.string().min(1),
    z.object({ input: nonNeg, output: nonNeg, cache_read_multiplier: nonNeg.optional(), cache_write_multiplier: nonNeg.optional() }),
  ),
} as const;

export type SettingKey = keyof typeof settingSchemas;
export const settingKeys = Object.keys(settingSchemas) as SettingKey[];

export const settingLabel: Record<SettingKey, { title: string; hint: string }> = {
  routing_ladder: { title: "سلّم التوجيه", hint: "ترتيب المصادر: قاعدة البيانات المشتركة → الكود → المصادر العامة → المزودون المدفوعون → النموذج اللغوي." },
  ttl_days: { title: "مدة صلاحية البيانات (أيام)", hint: "بعدها تُحدّث البيانات أو تُعرض بتاريخها." },
  circuit_breaker: { title: "قاطع الدائرة", hint: "عدد الأخطاء المتتالية قبل إيقاف المزود مؤقتاً، ومدة الإيقاف بالثواني." },
  llm_prices: { title: "أسعار النماذج اللغوية", hint: "دولار لكل مليون رمز. راجعها على صفحة أسعار المزود قبل الاعتماد عليها." },
};

export const pricingSchema = z.partialRecord(
  z.enum(intelCapabilities),
  z.object({ unit: z.string().min(1).max(40), unit_cost_usd: nonNeg, notes: z.string().max(200).optional() }),
);
