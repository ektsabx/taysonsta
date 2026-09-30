// KPI metric registry (docs/bos/12-team-hr.md). Keys map to SQL branches in
// bos_kpi_actual(); "manual" KPIs take values entered by the manager.

export interface KpiMetric {
  key: string;
  label: string;
  unit: "count" | "currency" | "percent" | "hours" | "score";
  calculation: "count" | "sum" | "avg" | "ratio" | "manual";
  direction: "higher_better" | "lower_better";
}

export const kpiMetrics: KpiMetric[] = [
  { key: "leads.qualified_count", label: "عملاء محتملون مؤهلون", unit: "count", calculation: "count", direction: "higher_better" },
  { key: "leads.created_count", label: "عملاء محتملون جدد", unit: "count", calculation: "count", direction: "higher_better" },
  { key: "activities.outreach_count", label: "أنشطة التواصل", unit: "count", calculation: "count", direction: "higher_better" },
  { key: "meetings.count", label: "الاجتماعات", unit: "count", calculation: "count", direction: "higher_better" },
  { key: "proposals.sent_count", label: "المقترحات المرسلة", unit: "count", calculation: "count", direction: "higher_better" },
  { key: "deals.pipeline_value", label: "قيمة خط المبيعات", unit: "currency", calculation: "sum", direction: "higher_better" },
  { key: "deals.won_value", label: "الإيراد المكسوب", unit: "currency", calculation: "sum", direction: "higher_better" },
  { key: "deals.conversion_rate", label: "معدل التحويل", unit: "percent", calculation: "ratio", direction: "higher_better" },
  { key: "payments.collected_value", label: "التحصيل", unit: "currency", calculation: "sum", direction: "higher_better" },
  { key: "commissions.amount", label: "العمولات", unit: "currency", calculation: "sum", direction: "higher_better" },
  { key: "projects.on_time_ratio", label: "المشاريع في موعدها", unit: "percent", calculation: "ratio", direction: "higher_better" },
  { key: "milestones.completion_ratio", label: "إنجاز المراحل", unit: "percent", calculation: "ratio", direction: "higher_better" },
  { key: "tasks.completion_ratio", label: "إنجاز المهام", unit: "percent", calculation: "ratio", direction: "higher_better" },
  { key: "tasks.completed_count", label: "المهام المنجزة", unit: "count", calculation: "count", direction: "higher_better" },
  { key: "projects.budget_variance", label: "انحراف الميزانية", unit: "percent", calculation: "ratio", direction: "lower_better" },
  { key: "projects.satisfaction_avg", label: "رضا العملاء", unit: "score", calculation: "avg", direction: "higher_better" },
  { key: "issues.open_count", label: "المشكلات المفتوحة", unit: "count", calculation: "count", direction: "lower_better" },
  { key: "attendance.on_time_ratio", label: "الالتزام بالحضور", unit: "percent", calculation: "ratio", direction: "higher_better" },
  { key: "time.logged_hours", label: "الساعات المسجلة", unit: "hours", calculation: "sum", direction: "higher_better" },
  { key: "manual", label: "إدخال يدوي", unit: "count", calculation: "manual", direction: "higher_better" },
];

export const kpiMetricMap = new Map(kpiMetrics.map((m) => [m.key, m]));

export const kpiUnitLabels: Record<string, string> = { count: "عدد", currency: "مبلغ", percent: "%", hours: "ساعات", score: "درجة" };
export const kpiPeriodLabels: Record<string, string> = { weekly: "أسبوعي", monthly: "شهري", quarterly: "ربع سنوي", yearly: "سنوي" };

// Period containing `date` (YYYY-MM-DD). Weeks start on Sunday (default
// schedule work week Sun–Thu).
export function periodRange(period: string, date: string): { start: string; end: string } {
  const d = new Date(`${date}T00:00:00Z`);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  if (period === "weekly") {
    const start = new Date(d);
    start.setUTCDate(d.getUTCDate() - d.getUTCDay());
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    return { start: iso(start), end: iso(end) };
  }
  if (period === "quarterly") {
    const q = Math.floor(d.getUTCMonth() / 3);
    return { start: iso(new Date(Date.UTC(d.getUTCFullYear(), q * 3, 1))), end: iso(new Date(Date.UTC(d.getUTCFullYear(), q * 3 + 3, 0))) };
  }
  if (period === "yearly") return { start: `${d.getUTCFullYear()}-01-01`, end: `${d.getUTCFullYear()}-12-31` };
  return { start: iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))), end: iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))) };
}

// Attainment in percent, respecting direction. null when not computable.
export function attainment(actual: number | null, target: number | null, direction: string): number | null {
  if (actual == null || target == null) return null;
  if (direction === "lower_better") {
    if (actual <= target) return 100;
    return target === 0 ? 0 : Math.max(0, Math.round((target / actual) * 100));
  }
  if (target === 0) return actual > 0 ? 100 : null;
  return Math.round((actual / target) * 100);
}
