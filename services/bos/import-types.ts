import "server-only";
import { db } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import type { PermissionKey } from "@/lib/bos/permissions";
import type { FieldSpec } from "@/lib/bos/import/fields";

// Import type registry (docs/bos/30 §27.3). Each type writes through the
// module's own service where business rules live (numbering, dedupe,
// events, onboarding), declares its fields, match keys, how to find an
// existing record, a safe "update empty/mapped fields" path, and rollback.

export type Values = Record<string, string | number | boolean | string[] | null>;

export interface ImportType {
  key: string;
  label: string;
  perm: PermissionKey;
  fields: FieldSpec[];
  matchKeys: string[];
  table: string;                                     // for update/rollback snapshots
  resolve?: (v: Values, refs: Refs) => Promise<string[]>;   // fills ref ids into v, returns errors
  find: (v: Values, key: string) => Promise<string | null>;
  create: (bos: BosUser, v: Values) => Promise<string>;
  updatable: string[];                               // columns an update may set (never keys/ownership)
  toRow: (v: Values) => Record<string, unknown>;     // mapped values → table columns for updates
}

export interface Refs { user: (email: string) => Promise<string | null>; client: (s: string) => Promise<string | null>; byName: (table: string, name: string) => Promise<string | null> }

const str = (v: unknown) => (v == null ? null : String(v));
const num = (v: unknown) => (v == null ? null : String(v));

async function findBy(table: string, column: string, value: unknown, extra?: (q: ReturnType<ReturnType<typeof db>["from"]>) => unknown) {
  if (value == null || value === "") return null;
  let q = db().from(table as "clients").select("id").ilike(column as "email", String(value)).limit(1);
  if (extra) q = extra(q as never) as typeof q;
  const { data } = await q.maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

const enumMap = (pairs: [string, string[]][]) => Object.fromEntries(pairs.flatMap(([v, names]) => [v, ...names].map((n) => [n.toLowerCase(), v])));

export const importTypes: ImportType[] = [
  {
    key: "clients", label: "العملاء (الحسابات)", perm: "clients.create", table: "clients", matchKeys: ["email", "company_name"],
    fields: [
      { key: "name", label: "اسم العميل", type: "text", required: true, max: 200, aliases: ["client", "client name", "العميل"] },
      { key: "company_name", label: "الشركة", type: "text", max: 200, aliases: ["company"] },
      { key: "email", label: "البريد", type: "email", required: true, aliases: ["e-mail", "mail"] },
      { key: "phone", label: "الهاتف", type: "phone", aliases: ["mobile", "tel"] },
      { key: "website", label: "الموقع", type: "text", max: 300 },
      { key: "country", label: "الدولة", type: "text", max: 80 },
      { key: "city", label: "المدينة", type: "text", max: 80 },
      { key: "address", label: "العنوان", type: "text", max: 500 },
      { key: "industry", label: "المجال", type: "text", max: 120 },
      { key: "tax_id", label: "الرقم الضريبي", type: "text", max: 60 },
      { key: "default_currency", label: "العملة", type: "currency", aliases: ["currency"] },
      { key: "account_manager", label: "بريد مدير الحساب", type: "ref", ref: "user", aliases: ["account manager"] },
      { key: "notes", label: "ملاحظات", type: "text", max: 5000 },
    ],
    resolve: async (v, refs) => (v.account_manager ? ((v.account_manager_id = await refs.user(String(v.account_manager))) ? [] : [`مدير الحساب غير موجود: ${v.account_manager}`]) : []),
    find: async (v, key) => (key === "company_name" ? findBy("clients", "company_name", v.company_name, (q) => (q as never as { is: (a: string, b: null) => unknown }).is("archived_at", null)) : findBy("clients", "email", v.email)),
    create: async (bos, v) => {
      const { createAccount } = await import("@/services/bos/accounts");
      const a = await createAccount(bos, { name: String(v.name), company_name: str(v.company_name), email: String(v.email), phone: str(v.phone), website: str(v.website), country: str(v.country), city: str(v.city), address: str(v.address), industry: str(v.industry), tax_id: str(v.tax_id), account_manager_id: str(v.account_manager_id), account_status: "active" as never, default_currency: str(v.default_currency), notes: str(v.notes) });
      return (a as { id: string }).id;
    },
    updatable: ["company_name", "phone", "website", "country", "city", "address", "industry", "tax_id", "default_currency", "notes"],
    toRow: (v) => ({ company_name: v.company_name, phone: v.phone, website: v.website, country: v.country, city: v.city, address: v.address, industry: v.industry, tax_id: v.tax_id, default_currency: v.default_currency, notes: v.notes }),
  },
  {
    key: "contacts", label: "جهات الاتصال", perm: "contacts.create", table: "contacts", matchKeys: ["email"],
    fields: [
      { key: "full_name", label: "الاسم", type: "text", required: true, max: 200, aliases: ["name", "full name"] },
      { key: "email", label: "البريد", type: "email", aliases: ["e-mail"] },
      { key: "phone", label: "الهاتف", type: "phone" },
      { key: "whatsapp", label: "واتساب", type: "phone" },
      { key: "position", label: "المسمى", type: "text", max: 120, aliases: ["title", "job title"] },
      { key: "client", label: "الحساب (بريد أو اسم)", type: "ref", ref: "client", aliases: ["company", "account"] },
      { key: "notes", label: "ملاحظات", type: "text", max: 5000 },
    ],
    resolve: async (v, refs) => (v.client ? ((v.client_id = await refs.client(String(v.client))) ? [] : [`الحساب غير موجود: ${v.client} — استورد الحسابات أولاً أو صحّح الاسم/البريد`]) : []),
    find: async (v) => findBy("contacts", "email", v.email),
    create: async (bos, v) => {
      const { createContact } = await import("@/services/bos/contacts");
      const c = await createContact(bos, { client_id: str(v.client_id), full_name: String(v.full_name), position: str(v.position), email: str(v.email), phone: str(v.phone), whatsapp: str(v.whatsapp), linkedin_url: null, is_decision_maker: false, notes: str(v.notes) });
      return (c as { id: string }).id;
    },
    updatable: ["phone", "whatsapp", "position", "notes"],
    toRow: (v) => ({ phone: v.phone, whatsapp: v.whatsapp, position: v.position, notes: v.notes }),
  },
  {
    key: "leads", label: "العملاء المحتملون", perm: "leads.create", table: "leads", matchKeys: ["email", "name"],
    fields: [
      { key: "name", label: "الاسم", type: "text", required: true, max: 200, aliases: ["lead", "lead name"] },
      { key: "company_name", label: "الشركة", type: "text", max: 200, aliases: ["company"] },
      { key: "contact_name", label: "اسم جهة الاتصال", type: "text", max: 200 },
      { key: "email", label: "البريد", type: "email" },
      { key: "phone", label: "الهاتف", type: "phone" },
      { key: "website", label: "الموقع", type: "text", max: 300 },
      { key: "country", label: "الدولة", type: "text", max: 80 },
      { key: "city", label: "المدينة", type: "text", max: 80 },
      { key: "industry", label: "المجال", type: "text", max: 120 },
      { key: "source", label: "المصدر", type: "ref", ref: "lead_source" },
      { key: "estimated_budget", label: "الميزانية", type: "number", aliases: ["budget"] },
      { key: "budget_currency", label: "عملة الميزانية", type: "currency", aliases: ["currency"] },
      { key: "assigned", label: "بريد المسؤول", type: "ref", ref: "user", aliases: ["owner", "assigned to"] },
      { key: "notes", label: "ملاحظات", type: "text", max: 5000 },
    ],
    resolve: async (v, refs) => {
      const e: string[] = [];
      if (v.source && !(v.source_id = await refs.byName("lead_sources", String(v.source)))) e.push(`المصدر غير موجود: ${v.source}`);
      if (v.assigned && !(v.assigned_to = await refs.user(String(v.assigned)))) e.push(`المسؤول غير موجود: ${v.assigned}`);
      if (v.estimated_budget != null && !v.budget_currency) e.push("حدد عملة الميزانية");
      return e;
    },
    find: async (v, key) => (key === "name" ? findBy("leads", "name", v.name, (q) => (q as never as { is: (a: string, b: null) => unknown }).is("archived_at", null)) : findBy("leads", "email", v.email)),
    create: async (bos, v) => {
      const { createLead } = await import("@/services/bos/leads");
      const l = await createLead(bos, { name: String(v.name), company_name: str(v.company_name), contact_name: str(v.contact_name), email: str(v.email), phone: str(v.phone), website: str(v.website), country: str(v.country), city: str(v.city), industry: str(v.industry), source_id: str(v.source_id), estimated_budget: num(v.estimated_budget), budget_currency: str(v.budget_currency), business_stage: null, timeline: null, decision_maker: null, current_solution: null, problem: null, notes: str(v.notes), assigned_to: str(v.assigned_to), team_id: null, priority: "medium" as never, budget_score: 0, fit_score: 0, intent_score: 0, engagement_score: 0 }, { allowDuplicate: true, source: "import" });
      return (l as { id: string }).id;
    },
    updatable: ["company_name", "contact_name", "phone", "website", "country", "city", "industry", "notes"],
    toRow: (v) => ({ company_name: v.company_name, contact_name: v.contact_name, phone: v.phone, website: v.website, country: v.country, city: v.city, industry: v.industry, notes: v.notes }),
  },
  {
    key: "deals", label: "الصفقات", perm: "deals.create", table: "deals", matchKeys: ["name"],
    fields: [
      { key: "name", label: "اسم الصفقة", type: "text", required: true, max: 200, aliases: ["deal"] },
      { key: "client", label: "الحساب (بريد أو اسم)", type: "ref", ref: "client", required: true, aliases: ["account", "company"] },
      { key: "value", label: "القيمة", type: "number", required: true, aliases: ["amount"] },
      { key: "currency", label: "العملة", type: "currency", required: true },
      { key: "expected_close_date", label: "تاريخ الإغلاق المتوقع", type: "date", aliases: ["close date"] },
      { key: "assigned", label: "بريد المسؤول", type: "ref", ref: "user", aliases: ["owner"] },
      { key: "notes", label: "ملاحظات", type: "text", max: 5000 },
    ],
    resolve: async (v, refs) => {
      const e: string[] = [];
      if (!(v.client_id = await refs.client(String(v.client)))) e.push(`الحساب غير موجود: ${v.client} — استورد الحسابات أولاً أو صحّح الاسم/البريد`);
      if (v.assigned && !(v.assigned_to = await refs.user(String(v.assigned)))) e.push(`المسؤول غير موجود: ${v.assigned}`);
      return e;
    },
    find: async (v) => findBy("deals", "name", v.name, (q) => (q as never as { is: (a: string, b: null) => { eq: (a: string, b: unknown) => unknown } }).is("archived_at", null).eq("client_id", v.client_id)),
    create: async (bos, v) => {
      const { createDeal } = await import("@/services/bos/deals");
      const d = await createDeal(bos, { name: String(v.name), client_id: String(v.client_id), contact_id: null, lead_id: null, source_id: null, value: String(v.value), currency: String(v.currency), probability: null, expected_close_date: str(v.expected_close_date), assigned_to: str(v.assigned_to) ?? bos.userId, scope: null, notes: str(v.notes), payment_terms: [] });
      return typeof d === "string" ? d : (d as { id: string }).id;
    },
    updatable: ["expected_close_date", "notes"],
    toRow: (v) => ({ expected_close_date: v.expected_close_date, notes: v.notes }),
  },
  {
    key: "employees", label: "الموظفون (بدون حسابات دخول)", perm: "employees.create", table: "employees", matchKeys: ["email", "employee_code"],
    fields: [
      { key: "full_name", label: "الاسم", type: "text", required: true, max: 200, aliases: ["name"] },
      { key: "email", label: "بريد العمل", type: "email", required: true, aliases: ["work email", "email"] },
      { key: "employee_code", label: "كود الموظف", type: "text", max: 40, aliases: ["code", "employee id"] },
      { key: "phone", label: "الهاتف", type: "phone" },
      { key: "position", label: "المسمى", type: "text", max: 120, aliases: ["job title", "title"] },
      { key: "start_date", label: "تاريخ البدء", type: "date", aliases: ["hire date", "joining date"] },
      { key: "employment_type", label: "نوع التوظيف", type: "enum", values: enumMap([["full_time", ["دوام كامل", "full time", "full-time"]], ["part_time", ["دوام جزئي", "part time", "part-time"]], ["contractor", ["متعاقد", "contract"]], ["intern", ["متدرب", "internship"]], ["freelancer", ["مستقل", "freelance"]]]) },
      { key: "country", label: "الدولة", type: "text", max: 80 },
      { key: "manager", label: "بريد المدير", type: "ref", ref: "employee" },
    ],
    resolve: async (v) => {
      if (!v.manager) return [];
      const { data } = await db().from("employees").select("id").ilike("email", String(v.manager)).is("archived_at", null).maybeSingle();
      v.manager_id = data?.id ?? null;
      return data ? [] : [`المدير غير موجود: ${v.manager} — استورد المديرين في ملف سابق أولاً`];
    },
    find: async (v, key) => (key === "employee_code" ? findBy("employees", "employee_code", v.employee_code) : findBy("employees", "email", v.email)),
    create: async (bos, v) => {
      const { createEmployee } = await import("@/services/bos/employees");
      const { getSetting } = await import("@/lib/bos/settings");
      const tz = (await getSetting("company")).timezone ?? "Africa/Cairo";
      const e = await createEmployee(bos, { full_name: String(v.full_name), employee_code: str(v.employee_code), email: str(v.email), personal_email: null, phone: str(v.phone), position: str(v.position), department_id: null, team_id: null, manager_id: str(v.manager_id), start_date: str(v.start_date), employment_type: (v.employment_type as never) ?? "full_time", work_schedule_id: null, country: str(v.country), timezone: tz, is_remote: false, hourly_cost: null, cost_currency: null }, { roleIds: [], createLogin: false });
      return (e as { id: string }).id;
    },
    updatable: ["phone", "position", "country"],
    toRow: (v) => ({ phone: v.phone, position: v.position, country: v.country }),
  },
  {
    key: "expenses", label: "المصروفات (بانتظار الاعتماد)", perm: "expenses.create", table: "expenses", matchKeys: [],
    fields: [
      { key: "description", label: "الوصف", type: "text", required: true, max: 500 },
      { key: "amount", label: "المبلغ", type: "number", required: true },
      { key: "currency", label: "العملة", type: "currency", required: true },
      { key: "expense_date", label: "التاريخ", type: "date", required: true, aliases: ["date"] },
      { key: "category", label: "التصنيف", type: "ref", ref: "expense_category", required: true },
      { key: "vendor", label: "المورد", type: "ref", ref: "vendor" },
    ],
    resolve: async (v, refs) => {
      const e: string[] = [];
      if (!(v.category_id = await refs.byName("expense_categories", String(v.category)))) e.push(`التصنيف غير موجود: ${v.category}`);
      if (v.vendor && !(v.vendor_id = await refs.byName("vendors", String(v.vendor)))) e.push(`المورد غير موجود: ${v.vendor} — استورد الموردين أولاً`);
      return e;
    },
    find: async () => null,
    // Imported expenses enter the normal approval flow (never auto-approved).
    create: async (bos, v) => {
      const { data, error } = await db().from("expenses").insert({ description: String(v.description), amount: Number(v.amount), currency: String(v.currency), expense_date: String(v.expense_date), category_id: String(v.category_id), vendor_id: str(v.vendor_id), approval_status: "pending", created_by: bos.userId, source_type: "import" } as never).select("id").single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    updatable: [],
    toRow: () => ({}),
  },
  {
    key: "assets", label: "الأصول والمخزون", perm: "devices.create", table: "devices", matchKeys: ["asset_id", "serial_number"],
    fields: [
      { key: "asset_id", label: "رقم الأصل", type: "text", required: true, max: 50, aliases: ["asset", "asset tag", "tag"] },
      { key: "name", label: "الاسم", type: "text", max: 200 },
      { key: "type", label: "النوع", type: "enum", required: true, values: enumMap([["laptop", ["لابتوب"]], ["desktop", ["كمبيوتر مكتبي", "pc"]], ["monitor", ["شاشة"]], ["mobile", ["هاتف", "phone"]], ["tablet", ["تابلت"]], ["headset", ["سماعة"]], ["office_equipment", ["معدات مكتبية", "office"]], ["software_license", ["ترخيص", "license", "licence"]], ["loanable", ["إعارة"]], ["spare_part", ["قطع غيار", "stock"]], ["other", ["أخرى"]]]) },
      { key: "model", label: "الموديل", type: "text", max: 200 },
      { key: "serial_number", label: "الرقم التسلسلي", type: "text", max: 100, aliases: ["serial"] },
      { key: "purchase_date", label: "تاريخ الشراء", type: "date" },
      { key: "warranty_until", label: "الضمان حتى", type: "date", aliases: ["warranty"] },
      { key: "purchase_value", label: "قيمة الشراء", type: "number", aliases: ["value", "cost"] },
      { key: "currency", label: "العملة", type: "currency" },
      { key: "quantity", label: "الكمية", type: "int" },
      { key: "license_seats", label: "مقاعد الترخيص", type: "int", aliases: ["seats"] },
      { key: "location", label: "الموقع", type: "text", max: 200 },
      { key: "notes", label: "ملاحظات", type: "text", max: 2000 },
    ],
    resolve: async (v) => (v.purchase_value != null && !v.currency ? ["حدد عملة قيمة الشراء"] : v.type === "software_license" && !v.license_seats ? ["حدد عدد مقاعد الترخيص"] : []),
    find: async (v, key) => (key === "serial_number" ? findBy("devices", "serial_number", v.serial_number) : findBy("devices", "asset_id", v.asset_id)),
    create: async (bos, v) => {
      const { saveDevice } = await import("@/services/bos/devices");
      return saveDevice(bos, null, { asset_id: String(v.asset_id), type: v.type as never, model: str(v.model), serial_number: str(v.serial_number), os: null, purchase_date: str(v.purchase_date), warranty_until: str(v.warranty_until), condition: "good", location: str(v.location), mdm_provider: null, mdm_reference: null, notes: str(v.notes), name: str(v.name), purchase_value: v.purchase_value != null ? Number(v.purchase_value) : null, currency: str(v.currency), quantity: v.type === "spare_part" ? Number(v.quantity ?? 0) : 1, license_seats: v.license_seats != null ? Number(v.license_seats) : null });
    },
    updatable: ["name", "model", "warranty_until", "location", "notes"],
    toRow: (v) => ({ name: v.name, model: v.model, warranty_until: v.warranty_until, location: v.location, notes: v.notes }),
  },
  {
    key: "vendors", label: "الموردون", perm: "vendors.create", table: "vendors", matchKeys: ["name", "email"],
    fields: [
      { key: "name", label: "الاسم", type: "text", required: true, max: 200 },
      { key: "type", label: "النوع", type: "text", max: 60 },
      { key: "contact_name", label: "جهة الاتصال", type: "text", max: 200 },
      { key: "email", label: "البريد", type: "email" },
      { key: "phone", label: "الهاتف", type: "phone" },
      { key: "services", label: "الخدمات", type: "text", max: 1000 },
      { key: "notes", label: "ملاحظات", type: "text", max: 5000 },
    ],
    find: async (v, key) => (key === "email" ? findBy("vendors", "email", v.email) : findBy("vendors", "name", v.name, (q) => (q as never as { is: (a: string, b: null) => unknown }).is("archived_at", null))),
    create: async (bos, v) => {
      const { data, error } = await db().from("vendors").insert({ name: String(v.name), type: str(v.type), contact_name: str(v.contact_name), email: str(v.email), phone: str(v.phone), services: str(v.services), notes: str(v.notes), created_by: bos.userId }).select("id").single();
      if (error) throw error;
      return data.id;
    },
    updatable: ["type", "contact_name", "email", "phone", "services", "notes"],
    toRow: (v) => ({ type: v.type, contact_name: v.contact_name, email: v.email, phone: v.phone, services: v.services, notes: v.notes }),
  },
  {
    key: "kb_articles", label: "مقالات قاعدة المعرفة (كمسودات)", perm: "knowledge.create", table: "kb_articles", matchKeys: ["title"],
    fields: [
      { key: "title", label: "العنوان", type: "text", required: true, max: 200 },
      { key: "content", label: "المحتوى (Markdown)", type: "text", required: true, max: 200000, aliases: ["body", "text"] },
      { key: "category", label: "التصنيف", type: "ref", ref: "kb_category", required: true },
      { key: "kind", label: "النوع", type: "enum", values: enumMap([["article", ["مقال"]], ["sop", ["إجراء"]], ["documentation", ["توثيق", "docs"]], ["policy", ["سياسة"]], ["onboarding_guide", ["دليل تهيئة"]]]) },
      { key: "tags", label: "الوسوم", type: "list" },
    ],
    resolve: async (v, refs) => ((v.category_id = await refs.byName("kb_categories", String(v.category))) ? [] : [`التصنيف غير موجود: ${v.category}`]),
    find: async (v) => findBy("kb_articles", "title", v.title),
    // Imported articles are drafts: someone with publish rights reviews them.
    create: async (bos, v) => {
      const { createArticle } = await import("@/services/bos/knowledge");
      const a = await createArticle(bos, { kind: (v.kind as never) ?? "article", title: String(v.title), slug: null, content: String(v.content), category_id: String(v.category_id), tags: (v.tags as string[]) ?? [], owner_id: null, allowed_role_ids: null, playbook_section: null, required_documents: null, status: "draft" });
      return a.id;
    },
    updatable: [],
    toRow: () => ({}),
  },
];

export const importTypeMap = new Map(importTypes.map((t) => [t.key, t]));
