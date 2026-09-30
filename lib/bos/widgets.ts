import type { PermissionKey } from "@/lib/bos/permissions";

// Dashboard widget registry (§79, docs/bos/04-dashboard.md).

export interface WidgetDef {
  key: string;
  title: string;
  size: 1 | 2 | 3 | 4;
  perm: PermissionKey[];
  dashboard: "employee" | "bd" | "pm" | "finance" | "executive";
}

export const widgets: WidgetDef[] = [
  { key: "attendance_status", title: "الحضور", size: 1, perm: ["attendance.create"], dashboard: "employee" },
  { key: "my_tasks_today", title: "مهام اليوم", size: 2, perm: ["tasks.read"], dashboard: "employee" },
  { key: "my_tasks_overdue", title: "مهام متأخرة", size: 1, perm: ["tasks.read"], dashboard: "employee" },
  { key: "upcoming_meetings", title: "الاجتماعات القادمة", size: 2, perm: ["meetings.read"], dashboard: "employee" },
  { key: "my_leads", title: "العملاء المحتملون المسندون", size: 2, perm: ["leads.read"], dashboard: "employee" },
  { key: "my_deals", title: "صفقاتي المفتوحة", size: 2, perm: ["deals.read"], dashboard: "employee" },
  { key: "my_projects", title: "مشاريعي النشطة", size: 2, perm: ["projects.read"], dashboard: "employee" },
  { key: "notifications", title: "آخر الإشعارات", size: 2, perm: ["notifications.read"], dashboard: "employee" },
  { key: "personal_kpis", title: "مؤشراتي هذا الشهر", size: 2, perm: ["kpis.read"], dashboard: "employee" },
  { key: "recent_activity", title: "آخر نشاطاتي", size: 2, perm: ["dashboard.read"], dashboard: "employee" },
  { key: "bd_funnel", title: "قمع المبيعات (هذا الشهر)", size: 4, perm: ["leads.read", "deals.read"], dashboard: "bd" },
  { key: "bd_pipeline", title: "مسار الصفقات", size: 4, perm: ["deals.read"], dashboard: "bd" },
  { key: "deal_radar", title: "رادار الصفقات", size: 2, perm: ["deals.read"], dashboard: "bd" },
  { key: "followups_due", title: "المتابعات المستحقة", size: 2, perm: ["activities.read"], dashboard: "bd" },
  { key: "pm_projects", title: "حالة المشاريع", size: 4, perm: ["projects.read"], dashboard: "pm" },
  { key: "pm_milestones", title: "المراحل القادمة (14 يوم)", size: 2, perm: ["milestones.read"], dashboard: "pm" },
  { key: "pm_approvals", title: "موافقات معلقة", size: 2, perm: ["approvals.read"], dashboard: "pm" },
  { key: "pm_issues", title: "مشكلات مفتوحة", size: 2, perm: ["issues.read"], dashboard: "pm" },
  { key: "pm_utilization", title: "استغلال فريق المشاريع", size: 2, perm: ["timesheets.read"], dashboard: "pm" },
  { key: "fin_revenue", title: "الإيرادات والتحصيل", size: 4, perm: ["invoices.view_sensitive"], dashboard: "finance" },
  { key: "fin_expenses", title: "المصروفات هذا الشهر", size: 2, perm: ["expenses.read"], dashboard: "finance" },
  { key: "fin_commissions", title: "العمولات", size: 2, perm: ["commissions.view_sensitive"], dashboard: "finance" },
  { key: "fin_cashflow", title: "التدفق النقدي (12 شهر)", size: 4, perm: ["revenue.view_sensitive"], dashboard: "finance" },
  { key: "fin_profitability", title: "ربحية المشاريع", size: 4, perm: ["projects.view_sensitive"], dashboard: "finance" },
  { key: "exec_overview", title: "نظرة تنفيذية", size: 4, perm: ["reports.read"], dashboard: "executive" },
  { key: "exec_sales", title: "المبيعات حسب مسؤول التطوير والدولة والمنتج", size: 4, perm: ["reports.read"], dashboard: "executive" },
  { key: "exec_delivery", title: "التسليم", size: 2, perm: ["projects.read"], dashboard: "executive" },
  { key: "exec_team", title: "الفريق والطاقة الاستيعابية", size: 2, perm: ["timesheets.read"], dashboard: "executive" },
  { key: "exec_clients", title: "العملاء", size: 4, perm: ["clients.read"], dashboard: "executive" },
];

export const widgetByKey = new Map(widgets.map((w) => [w.key, w]));

export const defaultLayouts: Record<string, string[]> = {
  employee: ["attendance_status", "my_tasks_today", "my_tasks_overdue", "upcoming_meetings", "my_projects", "notifications", "personal_kpis", "recent_activity"],
  bd: ["deal_radar", "bd_funnel", "bd_pipeline", "followups_due", "my_leads", "my_deals"],
  pm: ["pm_projects", "pm_milestones", "pm_approvals", "pm_issues", "pm_utilization"],
  finance: ["fin_revenue", "fin_cashflow", "fin_expenses", "fin_commissions", "fin_profitability"],
  executive: ["exec_overview", "deal_radar", "exec_sales", "fin_cashflow", "exec_delivery", "exec_team", "exec_clients", "fin_profitability"],
};

// Which dashboard a role contributes (a user with several roles sees the union).
export const roleDashboard: Record<string, keyof typeof defaultLayouts> = {
  super_admin: "executive",
  admin: "executive",
  executive: "executive",
  sales_manager: "bd",
  business_development: "bd",
  account_manager: "bd",
  project_manager: "pm",
  product_manager: "pm",
  finance: "finance",
};
