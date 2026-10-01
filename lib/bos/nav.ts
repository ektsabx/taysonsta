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
  // docs/bos/35 A7: the catalogue is its own module, not a settings page.
  { key: "products", label: "المنتجات والخدمات", icon: "products", href: "/admin/products", perm: "products.read" },
  // Yolias platform (docs/09-yolias-admin.md §B): the customer app's users,
  // workspaces and searches, read from the Yolias database.
  {
    key: "platform",
    label: "منصة Yolias",
    icon: "platform",
    items: [
      { href: "/admin/platform", label: "نظرة عامة", perm: "platform.read" },
      { href: "/admin/platform/users", label: "المستخدمون", perm: "platform.read" },
      { href: "/admin/platform/workspaces", label: "مساحات العمل", perm: "platform.read" },
      { href: "/admin/platform/searches", label: "عمليات البحث", perm: "platform.read" },
      { href: "/admin/platform/providers", label: "المزودون", perm: "platform.read" },
      { href: "/admin/platform/costs", label: "التكاليف", perm: "platform.read" },
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
      { href: "/admin/sales/radar", label: "رادار الصفقات", perm: "deals.read" },
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
    key: "projects",
    label: "المشاريع",
    icon: "projects",
    items: [
      { href: "/admin/projects", label: "كل المشاريع", perm: "projects.read" },
      { href: "/admin/projects/my", label: "مشاريعي", perm: "projects.read" },
      { href: "/admin/projects/tasks", label: "المهام", perm: "tasks.read" },
      { href: "/admin/projects/time", label: "الساعات", perm: "timesheets.read" },
      { href: "/admin/projects/milestones", label: "المراحل", perm: "milestones.read" },
      { href: "/admin/projects/files", label: "ملفات المشاريع", perm: "projects.read" },
      { href: "/admin/projects/change-requests", label: "طلبات التغيير", perm: "change_requests.read" },
      { href: "/admin/projects/issues", label: "المشكلات", perm: "issues.read" },
      { href: "/admin/approvals", label: "الموافقات", perm: "approvals.read" },
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
      { href: "/admin/team/access", label: "الأجهزة والصلاحيات", perm: ["access.read", "devices.read"], children: hr("it") },
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
      { href: "/admin/communication/messaging", label: "واتساب و SMS", perm: "messaging.read" },
      { href: "/admin/communication/meetings", label: "الاجتماعات", perm: "meetings.read" },
      { href: "/admin/communication/notifications", label: "الإشعارات", perm: "notifications.read" },
      { href: "/admin/calendar", label: "التقويم", perm: "calendar.read" },
    ],
  },
  {
    key: "marketing",
    label: "التسويق",
    icon: "marketing",
    // Master upgrade Phases 10–12 (docs/bos/30 §12–15).
    items: [
      { href: "/admin/social", label: "التواصل الاجتماعي", perm: "social.read" },
      { href: "/admin/social/calendar", label: "تقويم المحتوى", perm: "social.read" },
      { href: "/admin/social/posts", label: "المنشورات", perm: "social.read" },
      {
        href: "/admin/content", label: "استوديو المحتوى", perm: "content.read",
        children: [
          { href: "/admin/content", label: "لوحة المحتوى", perm: "content.read" },
          { href: "/admin/content/ideas", label: "مولّد الأفكار", perm: "content.create" },
          { href: "/admin/content/stages", label: "مراحل العمل", perm: "content.manage" },
        ],
      },
      { href: "/admin/content/insights", label: "أداء المحتوى", perm: "content.read" },
      {
        href: "/admin/ads", label: "الإعلانات", perm: "ads.read",
        children: [
          { href: "/admin/ads", label: "الأداء", perm: "ads.read" },
          { href: "/admin/ads/alerts", label: "التنبيهات", perm: "ads.manage" },
        ],
      },
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
    // docs/bos/37 §3: exactly these six pages; customers and teams open from
    // the inbox, the website widget lives in Settings → Integrations.
    items: [
      { href: "/admin/support", label: "نظرة عامة", perm: "conversations.read" },
      { href: "/admin/support/inbox", label: "صندوق الوارد", perm: "conversations.read" },
      { href: "/admin/support/spam", label: "الرسائل المزعجة", perm: "conversations.read" },
      { href: "/admin/support/ai-agents", label: "وكيل الذكاء الاصطناعي", perm: "conversations.manage", all: "conversations.manage" },
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
      { href: "/admin/reports/projects", label: "المشاريع", perm: "reports.read" },
      { href: "/admin/reports/finance", label: "المالية", perm: ["revenue.view_sensitive", "expenses.read"] },
      { href: "/admin/reports/team", label: "الفريق", perm: "reports.read" },
      { href: "/admin/reports/hr", label: "الموارد البشرية", perm: "reports.read" },
      { href: "/admin/reports/clients", label: "العملاء", perm: "reports.read" },
      { href: "/admin/reports/performance", label: "الأداء", perm: "reports.read" },
      { href: "/admin/reports/countries", label: "أداء الدول", perm: "reports.read" },
      { href: "/admin/reports/products", label: "المنتجات والخدمات", perm: "reports.read" },
    ],
  },
  {
    key: "automation",
    label: "الأتمتة",
    icon: "automation",
    items: [
      { href: "/admin/automation/workflows", label: "مسارات العمل", perm: "automation.read" },
      { href: "/admin/automation/rules", label: "القواعد", perm: "automation.read" },
      { href: "/admin/automation/logs", label: "سجل الأحداث", perm: "automation.read" },
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
      { href: "/admin/documents/signatures", label: "طلبات التوقيع", perm: "documents.read" },
      { href: "/admin/files/templates", label: "ملفات قوالب مرفوعة", perm: "files.read" },
    ],
  },
  {
    key: "settings",
    label: "الإعدادات",
    icon: "settings",
    items: [
      { href: "/admin/settings/company", label: "الشركة", perm: ["settings.manage", "commissions.manage", "invoices.manage"] },
      { href: "/admin/settings/branches", label: "الفروع", perm: ["settings.manage", "branches.manage"] },
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
        href: "/admin/settings/integrations", label: "مركز التكاملات", perm: ["integrations.manage", "conversations.manage", "messaging.manage", "social.manage", "ads.manage"], hrefPerm: "integrations.manage",
        children: [
          { href: "/admin/settings/integrations", label: "الخدمات والمفاتيح", perm: "integrations.manage", all: "integrations.manage" },
          { href: "/admin/settings/integrations/widgets", label: "ويدجت الموقع", perm: ["conversations.manage", "messaging.manage"] },
          { href: "/admin/settings/integrations/social", label: "الحسابات الاجتماعية", perm: "social.manage" },
          { href: "/admin/settings/integrations/ads", label: "الحسابات الإعلانية", perm: "ads.manage" },
        ],
      },
      { href: "/admin/settings/security", label: "الأمان", perm: "settings.manage" },
      { href: "/admin/settings/it", label: "التطبيقات الخارجية", perm: "apps.manage" },
      { href: "/admin/settings/cameras", label: "الكاميرات", perm: "cameras.read" },
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
