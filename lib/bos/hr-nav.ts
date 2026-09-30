import type { BosUser } from "@/lib/bos/auth";
import type { PermissionKey } from "@/lib/bos/permissions";

// Sub-sections of each HR area (docs/bos/28 §5, §37). The sidebar shows the
// areas; these tabs show what is inside, filtered by permission.
type Item = { key: string; href: string; label: string; perm?: PermissionKey | PermissionKey[]; all?: PermissionKey };

const sections: Record<string, Item[]> = {
  employees: [
    { key: "list", href: "/admin/team/employees", label: "الموظفون", perm: "employees.read" },
    { key: "onboarding", href: "/admin/team/onboarding", label: "التهيئة", perm: "onboarding.read" },
    { key: "offboarding", href: "/admin/team/offboarding", label: "إنهاء الخدمة", perm: "onboarding.read" },
  ],
  schedules: [
    { key: "roster", href: "/admin/team/schedules", label: "جدول الأسبوع", perm: "attendance.read" },
    { key: "schedules", href: "/admin/team/schedules/list", label: "الجداول والورديات", perm: "attendance.read" },
    { key: "assignments", href: "/admin/team/schedules/assignments", label: "التعيينات", perm: "attendance.manage" },
    { key: "holidays", href: "/admin/team/schedules/holidays", label: "العطلات وأيام الراحة", perm: "attendance.read" },
  ],
  leave: [
    { key: "requests", href: "/admin/team/leave", label: "الطلبات والتقويم", perm: "leave.read" },
    { key: "balances", href: "/admin/team/leave/balances", label: "الأرصدة", perm: "leave.read" },
  ],
  payroll: [
    { key: "runs", href: "/admin/team/payroll", label: "دورات الرواتب", all: "payroll.read" },
    { key: "payslips", href: "/admin/team/payroll/payslips", label: "قسائم الرواتب", perm: "payroll.read" },
    { key: "bonuses", href: "/admin/team/payroll/bonuses", label: "المكافآت", perm: "payroll.read" },
    { key: "loans", href: "/admin/team/payroll/loans", label: "القروض والسلف", perm: "payroll.read" },
    { key: "compensation", href: "/admin/team/payroll/compensation", label: "الرواتب والبدلات", all: "payroll.read" },
  ],
  recruitment: [
    { key: "overview", href: "/admin/team/recruitment", label: "الوظائف", perm: "recruitment.read" },
    { key: "candidates", href: "/admin/team/recruitment/candidates", label: "المرشحون", perm: "recruitment.read" },
    { key: "applications", href: "/admin/team/recruitment/applications", label: "الطلبات", perm: "recruitment.read" },
    { key: "pipeline", href: "/admin/team/recruitment/pipeline", label: "مسار التوظيف", perm: "recruitment.read" },
    { key: "interviews", href: "/admin/team/recruitment/interviews", label: "المقابلات", perm: "recruitment.read" },
    { key: "offers", href: "/admin/team/recruitment/offers", label: "عروض العمل", perm: "recruitment.read" },
  ],
  performance: [
    { key: "overview", href: "/admin/team/performance", label: "نظرة عامة", perm: "performance.read" },
    { key: "goals", href: "/admin/team/performance/goals", label: "الأهداف", perm: "performance.read" },
    { key: "kpis", href: "/admin/team/kpis", label: "مؤشرات الأداء", perm: "kpis.read" },
    { key: "reviews", href: "/admin/team/performance/reviews", label: "المراجعات والدورات", perm: "performance.read" },
    { key: "feedback", href: "/admin/team/performance/feedback", label: "تقييم 360", perm: "performance.read" },
  ],
  requests: [
    { key: "overview", href: "/admin/team/requests", label: "طلباتي وطلبات الفريق", perm: "hr_requests.read" },
    { key: "expenses", href: "/admin/team/requests/expenses", label: "المصروفات", perm: "hr_requests.read" },
    { key: "advances", href: "/admin/team/payroll/loans", label: "السلف والقروض", perm: "payroll.read" },
    { key: "overtime", href: "/admin/team/overtime", label: "العمل الإضافي", perm: "overtime.read" },
    { key: "other", href: "/admin/team/requests/other", label: "طلبات أخرى", perm: "hr_requests.read" },
  ],
  documents: [
    { key: "documents", href: "/admin/team/documents", label: "مستندات الموظفين", perm: "hr_documents.read" },
    { key: "contracts", href: "/admin/team/documents/contracts", label: "عقود الموظفين", perm: "hr_documents.read" },
  ],
  it: [
    { key: "access", href: "/admin/team/access", label: "الصلاحيات والأدوات", perm: "access.read" },
    { key: "accounts", href: "/admin/team/accounts", label: "حسابات الشركة", perm: "access.manage" },
    { key: "devices", href: "/admin/team/devices", label: "الأجهزة", perm: "devices.read" },
  ],
};

export function hrSection(bos: BosUser, key: keyof typeof sections) {
  return sections[key].filter((i) => {
    if (i.all && bos.permissions.get(i.all) !== "all") return false;
    if (!i.perm) return true;
    return (Array.isArray(i.perm) ? i.perm : [i.perm]).some((p) => bos.permissions.has(p));
  });
}
