import type { BosUser } from "@/lib/bos/auth";
import type { PermissionKey } from "@/lib/bos/permissions";
import { hrSections, type HrNavItem, type HrSectionKey } from "@/lib/bos/hr-nav";

// Main sidebar (§5), extended with the IT & Access pages (addendum) and the
// pre-existing website admin (careers, booking). Items are shown only when
// the user holds the permission (any scope).

export interface NavLink {
  href: string;
  label: string;
  perm?: PermissionKey | PermissionKey[];
  // Needs this permission with scope "all" (on top of `perm`).
  all?: PermissionKey;
  // Permission for `href` itself when `perm` also admits child-only users;
  // without it the item links to the first permitted child.
  hrefPerm?: PermissionKey;
  // Pages inside this area, shown under the item while it is active (they
  // replace the in-page tab strips — docs/bos/35 B1).
  children?: NavLink[];
}

export interface NavGroup {
  key: string;
  label: string;
  icon: string;
  href?: string;
  perm?: PermissionKey | PermissionKey[];
  items?: NavLink[];
}

const hr = (key: HrSectionKey): NavLink[] => (hrSections[key] as HrNavItem[]).map(({ href, label, perm, all }) => ({ href, label, perm, all }));

export const navigation: NavGroup[] = [
  { key: "dashboard", label: "لوحة التحكم", icon: "dashboard", href: "/admin/dashboard", perm: "dashboard.read" },
  // Phase 17 (docs/bos/30 §25): questions over the user's permitted data.
  { key: "assistant", label: "المساعد الذكي", icon: "assistant", href: "/admin/assistant", perm: "dashboard.read" },
  // Yolias (docs/09-yolias-admin.md §B), read from the Yolias database. Owner
  // rule (2026-10-13): every Yolias area is a sidebar section of its own and a
  // section holds pages only — no section inside a section. Same routes as before.
  {
    key: "y_overview",
    label: "Yolias",
    icon: "platform",
    items: [
      { href: "/admin/platform", label: "نظرة عامة", perm: "platform.read" },
      { href: "/admin/platform/switches", label: "تشغيل وإيقاف الخدمات", perm: "platform.read" },
    ],
  },
  {
    key: "y_users",
    label: "المستخدمون",
    icon: "y_users",
    items: [
      { href: "/admin/platform/users", label: "نظرة عامة", perm: "platform.read" },
      { href: "/admin/platform/users/all", label: "كل المستخدمين", perm: "platform.read" },
      { href: "/admin/platform/users/registered", label: "المستخدمون المسجلون", perm: "platform.read" },
      { href: "/admin/platform/users/subscribed", label: "المستخدمون المشتركون", perm: "platform.read" },
      { href: "/admin/platform/users/suspended", label: "المستخدمون الموقوفون", perm: "platform.read" },
      { href: "/admin/platform/users/banned", label: "المستخدمون المحظورون", perm: "platform.read" },
    ],
  },
  { key: "y_workspaces", label: "مساحات العمل", icon: "y_workspaces", href: "/admin/platform/workspaces", perm: "platform.read" },
  {
    key: "y_revenue",
    label: "الاشتراكات والإيرادات",
    icon: "y_revenue",
    items: [
      { href: "/admin/platform/conversions", label: "نظرة عامة", perm: "platform.read" },
      { href: "/admin/platform/conversions/subscriptions", label: "الاشتراكات", perm: "platform.read" },
      { href: "/admin/platform/payments", label: "المدفوعات", perm: "platform.read" },
      { href: "/admin/platform/conversions/funnel", label: "رحلة التحويل", perm: "platform.read" },
      { href: "/admin/platform/conversions/abandoned", label: "Abandoned Checkouts", perm: "platform.read" },
      { href: "/admin/platform/conversions/failed", label: "فشل الدفع", perm: "platform.read" },
      { href: "/admin/platform/conversions/trials", label: "التجارب المجانية", perm: "platform.read" },
      { href: "/admin/platform/plans", label: "الخطط والحصص", perm: "platform.read" },
      { href: "/admin/platform/profitability", label: "الربحية", perm: "platform.read" },
    ],
  },
  {
    key: "y_growth",
    label: "الاكتساب والنمو",
    icon: "y_growth",
    items: [
      { href: "/admin/platform/onboarding", label: "الترحيب ومصادر التسجيل", perm: "platform.read" },
      { href: "/admin/platform/content", label: "محتوى الموقع", perm: "platform.read" },
    ],
  },
  // SEO Control Center (D-257): organic growth from search to paid accounts.
  {
    key: "y_seo",
    label: "SEO",
    icon: "y_search",
    items: [
      { href: "/admin/platform/seo", label: "الأداء", perm: "platform.read" },
      { href: "/admin/platform/seo/pages", label: "صفحات SEO", perm: "platform.read" },
      { href: "/admin/platform/seo/competitors", label: "المنافسون", perm: "platform.read" },
      { href: "/admin/platform/seo/keywords", label: "الكلمات والفرص", perm: "platform.read" },
      { href: "/admin/platform/seo/reports", label: "التقارير التجارية", perm: "platform.read" },
      { href: "/admin/platform/seo/indexing", label: "الفهرسة وخريطة الموقع", perm: "platform.read" },
      { href: "/admin/platform/seo/settings", label: "تكاملات SEO", perm: "platform.read" },
    ],
  },
  {
    key: "y_data",
    label: "البيانات",
    icon: "y_data",
    items: [
      { href: "/admin/platform/data", label: "البيانات المشتركة", perm: "platform.read" },
      { href: "/admin/platform/data/companies", label: "الشركات والأشخاص", perm: "platform.read" },
      { href: "/admin/platform/quality", label: "جودة البيانات", perm: "platform.read" },
    ],
  },
  // Data import (D-248): bought lists, open data, registries, our crawler.
  {
    key: "y_import",
    label: "استيراد البيانات",
    icon: "y_data",
    items: [
      { href: "/admin/platform/datasets", label: "البيانات المستوردة", perm: "platform.read" },
      { href: "/admin/platform/datasets/new", label: "استيراد بيانات", perm: "platform.manage" },
      { href: "/admin/platform/datasets/sources", label: "المصادر المفتوحة", perm: "platform.read" },
    ],
  },
  {
    key: "y_search",
    label: "البحث والمزودون",
    icon: "y_search",
    items: [
      { href: "/admin/platform/searches", label: "عمليات البحث", perm: "platform.read" },
      { href: "/admin/platform/providers", label: "المزودون", perm: "platform.read" },
    ],
  },
  {
    key: "y_ai",
    label: "الذكاء الاصطناعي",
    icon: "y_ai",
    items: [
      { href: "/admin/platform/agent", label: "Yolias AI", perm: "platform.read" },
      { href: "/admin/platform/llm", label: "النماذج اللغوية", perm: "platform.read" },
    ],
  },
  // Messaging & Automation (D-243): one section, pages only.
  {
    key: "y_messages",
    label: "الرسائل والأتمتة",
    icon: "y_messages",
    items: [
      { href: "/admin/platform/messaging", label: "نظرة عامة", perm: "platform.read" },
      { href: "/admin/platform/messaging/automations", label: "الأتمتة", perm: "platform.read" },
      { href: "/admin/platform/messaging/sequences", label: "تسلسلات الإيميلات", perm: "platform.read" },
      { href: "/admin/platform/messaging/campaigns", label: "الحملات", perm: "platform.read" },
      { href: "/admin/platform/messaging/templates", label: "القوالب", perm: "platform.read" },
      { href: "/admin/platform/messaging/segments", label: "الجمهور والشرائح", perm: "platform.read" },
      { href: "/admin/platform/messaging/activity", label: "سجل الأحداث والتنفيذ", perm: "platform.read" },
      { href: "/admin/platform/messaging/analytics", label: "التحليلات", perm: "platform.read" },
      { href: "/admin/platform/emails", label: "رسائل النظام", perm: "platform.read" },
      { href: "/admin/platform/messaging/settings", label: "الإعدادات", perm: "platform.read" },
    ],
  },
  {
    key: "y_usage",
    label: "الاستخدام والتكاليف",
    icon: "y_usage",
    items: [
      { href: "/admin/platform/usage", label: "الاستخدام", perm: "platform.read" },
      { href: "/admin/platform/costs", label: "التكاليف", perm: "platform.read" },
    ],
  },
  {
    key: "y_monitoring",
    label: "مراقبة المنصة",
    icon: "status",
    items: [
      { href: "/admin/platform/health", label: "صحة المنصة", perm: "platform.read" },
      { href: "/admin/platform/status", label: "صفحة الحالة", perm: "platform.read" },
      { href: "/admin/platform/jobs", label: "المهام والطابور", perm: "platform.read" },
      { href: "/admin/platform/risk", label: "المخاطر", perm: "platform.read" },
    ],
  },
  // Yolias affiliate program (D-178): marketers, commissions, payouts, rules.
  {
    key: "affiliates",
    label: "الأفلييت",
    icon: "affiliates",
    items: [
      { href: "/admin/affiliates", label: "نظرة عامة", perm: "affiliates.read" },
      { href: "/admin/affiliates/list", label: "المسوّقون", perm: "affiliates.read" },
      { href: "/admin/affiliates/commissions", label: "العمولات", perm: "affiliates.read" },
      { href: "/admin/affiliates/payouts", label: "طلبات السحب", perm: "affiliates.read" },
      { href: "/admin/affiliates/settings", label: "إعدادات البرنامج", perm: "affiliates.read" },
      { href: "/admin/affiliates/audit", label: "سجل التدقيق", perm: "affiliates.read" },
    ],
  },
  {
    key: "sales",
    label: "المبيعات",
    icon: "sales",
    items: [
      { href: "/admin/sales/leads", label: "العملاء المحتملون", perm: "leads.read" },
      { href: "/admin/sales/deals", label: "الصفقات", perm: "deals.read" },
      { href: "/admin/sales/activities", label: "الأنشطة", perm: "activities.read" },
      { href: "/admin/sales/proposals", label: "المقترحات", perm: "proposals.read" },
      { href: "/admin/sales/contracts", label: "العقود", perm: "contracts.read" },
      { href: "/admin/sales/pipeline", label: "مسار المبيعات", perm: ["deals.read", "leads.read"] },
      { href: "/admin/approvals", label: "الموافقات", perm: "approvals.read" },
    ],
  },
  {
    key: "clients",
    label: "العملاء",
    icon: "clients",
    items: [
      { href: "/admin/clients", label: "الحسابات", perm: "clients.read" },
      { href: "/admin/contacts", label: "جهات الاتصال", perm: "contacts.read" },
      { href: "/admin/communications", label: "سجل التواصل", perm: "communications.read" },
    ],
  },
  {
    key: "finance",
    label: "المالية",
    icon: "finance",
    items: [
      { href: "/admin/finance/invoices", label: "الفواتير", perm: "invoices.read" },
      { href: "/admin/finance/payments", label: "المدفوعات", perm: "payments.read" },
      { href: "/admin/finance/revenue", label: "الإيرادات", perm: "revenue.read" },
      { href: "/admin/finance/expenses", label: "المصروفات", perm: ["expenses.read", "expenses.create"] },
      { href: "/admin/finance/commissions", label: "العمولات", perm: "commissions.read" },
      { href: "/admin/finance/vendors", label: "الموردون", perm: "vendors.read" },
      // Payroll lives in HR; Finance approves and pays it there (docs/bos/28 §32).
      { href: "/admin/team/payroll", label: "الرواتب", perm: ["payroll.approve", "payroll.manage"] },
    ],
  },
  {
    key: "team",
    label: "الفريق",
    icon: "team",
    // HR & Workforce Management (docs/bos/28 §5, §37): one area per HR
    // domain; sub-pages are tabs inside each area (lib/bos/hr-nav.ts).
    items: [
      { href: "/admin/team", label: "نظرة عامة", perm: ["employees.read", "attendance.read"] },
      { href: "/admin/team/me", label: "ملفي", perm: "attendance.create" },
      { href: "/admin/team/employees", label: "الموظفون", perm: "employees.read", children: hr("employees") },
      { href: "/admin/team/attendance", label: "الحضور", perm: "attendance.read", children: hr("attendance") },
      { href: "/admin/team/schedules", label: "الجداول", perm: "attendance.read", children: hr("schedules") },
      { href: "/admin/team/leave", label: "الإجازات", perm: "leave.read", children: hr("leave") },
      { href: "/admin/team/payroll", label: "الرواتب", perm: "payroll.read", children: hr("payroll") },
      { href: "/admin/team/recruitment", label: "التوظيف", perm: "recruitment.read", children: hr("recruitment") },
      { href: "/admin/team/performance", label: "الأداء", perm: "performance.read", children: hr("performance") },
      { href: "/admin/team/requests", label: "المصروفات والطلبات", perm: "hr_requests.read", children: hr("requests") },
      { href: "/admin/team/documents", label: "المستندات والعقود", perm: "hr_documents.read", children: hr("documents") },
      { href: "/admin/team/locations", label: "مشاركة الموقع", perm: ["attendance.create", "location.read"] },
    ],
  },
  {
    key: "communication",
    label: "التواصل",
    icon: "communication",
    items: [
      { href: "/admin/communication/inbox", label: "صندوق الوارد", perm: "notifications.read" },
      { href: "/admin/communication/chat", label: "المحادثات الداخلية", perm: "chat.read" },
      { href: "/admin/communication/meetings", label: "الاجتماعات", perm: "meetings.read" },
      { href: "/admin/communication/notifications", label: "الإشعارات", perm: "notifications.read" },
      { href: "/admin/calendar", label: "التقويم", perm: "calendar.read" },
    ],
  },
  {
    key: "knowledge",
    label: "المعرفة",
    icon: "knowledge",
    items: [
      { href: "/admin/knowledge", label: "قاعدة المعرفة", perm: "knowledge.read" },
      { href: "/admin/knowledge/sops", label: "إجراءات التشغيل", perm: "knowledge.read" },
      { href: "/admin/knowledge/playbooks", label: "أدلة المبيعات", perm: "knowledge.read" },
      { href: "/admin/knowledge/docs", label: "التوثيق والسياسات", perm: "knowledge.read" },
    ],
  },
  {
    key: "support",
    label: "الدعم",
    icon: "support",
    // docs/bos/37 §3 (plus Website messages, 2026-10-12): customers and teams
    // open from the inbox. The support AI agent and the website widget are
    // controlled from here (owner, 2026-10-13, D-207).
    items: [
      { href: "/admin/support", label: "نظرة عامة", perm: "conversations.read" },
      { href: "/admin/support/inbox", label: "صندوق الوارد", perm: "conversations.read" },
      { href: "/admin/support/messages", label: "رسائل الموقع والبلاغات", perm: "conversations.read" },
      { href: "/admin/support/ratings", label: "التقييمات", perm: "conversations.read" },
      { href: "/admin/support/profile", label: "ملفي في الدعم", perm: "conversations.read" },
      { href: "/admin/support/spam", label: "الرسائل المزعجة", perm: "conversations.read" },
      { href: "/admin/support/ai-agents", label: "وكيل الذكاء الاصطناعي", perm: "conversations.manage", all: "conversations.manage" },
      { href: "/admin/support/widgets", label: "ويدجت الموقع", perm: "conversations.manage", all: "conversations.manage" },
      { href: "/admin/support/tickets", label: "التذاكر", perm: "tickets.read" },
      { href: "/admin/support/knowledge", label: "قاعدة المعرفة", perm: "knowledge.read" },
    ],
  },
  {
    key: "reports",
    label: "التقارير",
    icon: "reports",
    items: [
      { href: "/admin/reports", label: "نظرة عامة", perm: "reports.read" },
      { href: "/admin/reports/sales", label: "المبيعات", perm: "reports.read" },
      { href: "/admin/reports/bd", label: "تطوير الأعمال", perm: "reports.read" },
      { href: "/admin/reports/revenue", label: "الإيرادات", perm: ["revenue.read", "revenue.view_sensitive"] },
      { href: "/admin/reports/finance", label: "المالية", perm: ["revenue.view_sensitive", "expenses.read"] },
      { href: "/admin/reports/team", label: "الفريق", perm: "reports.read" },
      { href: "/admin/reports/hr", label: "الموارد البشرية", perm: "reports.read" },
      { href: "/admin/reports/clients", label: "العملاء", perm: "reports.read" },
      { href: "/admin/reports/performance", label: "الأداء", perm: "reports.read" },
      { href: "/admin/reports/countries", label: "أداء الدول", perm: "reports.read" },
    ],
  },
  {
    key: "files",
    label: "الملفات",
    icon: "files",
    items: [
      { href: "/admin/files", label: "كل الملفات", perm: "files.read" },
      { href: "/admin/files/shared", label: "الملفات المشتركة", perm: "files.read" },
      { href: "/admin/documents", label: "المستندات والقوالب", perm: "documents.read" },
      { href: "/admin/files/templates", label: "ملفات قوالب مرفوعة", perm: "files.read" },
    ],
  },
  {
    key: "settings",
    label: "الإعدادات",
    icon: "settings",
    items: [
      { href: "/admin/settings/company", label: "الشركة", perm: ["settings.manage", "commissions.manage", "invoices.manage"] },
      { href: "/admin/settings/users", label: "المستخدمون", perm: "users.read" },
      { href: "/admin/settings/roles", label: "الأدوار", perm: "roles.manage" },
      { href: "/admin/settings/permissions", label: "الأذونات", perm: "roles.manage" },
      { href: "/admin/settings/pipeline", label: "مراحل المبيعات", perm: ["settings.manage", "leads.manage"] },
      { href: "/admin/settings/hr", label: "الموارد البشرية", perm: ["settings.manage", "attendance.manage", "payroll.manage"] },
      { href: "/admin/settings/notifications", label: "الإشعارات", perm: "settings.manage" },
      { href: "/admin/settings/dashboards", label: "لوحات التحكم", perm: "settings.manage" },
      // docs/bos/37 §5: everything that connects the system to an outside
      // service, site or platform is managed here.
      {
        href: "/admin/settings/integrations", label: "مركز التكاملات", perm: ["integrations.manage", "conversations.manage"], hrefPerm: "integrations.manage",
        children: [
          { href: "/admin/settings/integrations", label: "الخدمات والمفاتيح", perm: "integrations.manage", all: "integrations.manage" },
        ],
      },
      { href: "/admin/settings/security", label: "الأمان", perm: "settings.manage" },
      { href: "/admin/settings/audit-logs", label: "سجل التدقيق", perm: "audit.read" },
    ],
  },
];

function allowed(bos: BosUser, perm: NavLink["perm"], all?: PermissionKey): boolean {
  if (all && bos.permissions.get(all) !== "all") return false;
  if (!perm) return true;
  const list = Array.isArray(perm) ? perm : [perm];
  return list.some((p) => bos.permissions.has(p));
}

function linkFor(bos: BosUser, item: NavLink): NavLink {
  const children = item.children?.filter((c) => allowed(bos, c.perm, c.all));
  const href = item.hrefPerm && !allowed(bos, item.hrefPerm, item.hrefPerm) && children?.length ? children[0].href : item.href;
  // A single sub-page is the page itself — no third level.
  return { ...item, href, children: children && children.length > 1 ? children : undefined };
}

export function navigationFor(bos: BosUser): NavGroup[] {
  return navigation
    .map((group) => ({ ...group, items: group.items?.filter((i) => allowed(bos, i.perm, i.all)).map((i) => linkFor(bos, i)) }))
    .filter((group) => (group.href ? allowed(bos, group.perm) : (group.items?.length ?? 0) > 0));
}
