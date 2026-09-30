import "server-only";
import { db } from "@/lib/bos/db";
import { getTeamUserIds, type BosUser } from "@/lib/bos/auth";
import { ValidationError } from "@/lib/bos/errors";
import { branchFilter } from "@/lib/bos/branch";

// Reports (docs/bos/21): thin, validated wrappers over bos_report_* SQL
// functions. Scope comes from reports.read (own/team/all) — never from input.

export type ReportName = "sales" | "revenue" | "bd" | "projects" | "clients" | "countries" | "products" | "team";

export interface ReportFilters {
  from?: string;
  to?: string;
  client_id?: string;
  project_id?: string;
  country?: string;
  product_id?: string;
  source_id?: string;
  department_id?: string;
  user_id?: string;
}

const allowedKeys: Record<ReportName, (keyof ReportFilters)[]> = {
  sales: ["from", "to", "client_id", "country", "product_id", "source_id", "user_id"],
  revenue: ["from", "to", "client_id", "project_id"],
  bd: ["from", "to", "user_id"],
  projects: ["from", "to", "client_id", "user_id"],
  clients: ["from", "to", "user_id"],
  countries: ["from", "to", "user_id"],
  products: ["from", "to", "user_id"],
  team: ["from", "to", "department_id", "user_id"],
};

const iso = /^\d{4}-\d{2}-\d{2}$/;
const uuid = /^[0-9a-f-]{36}$/i;

export async function runReport<T = unknown>(bos: BosUser, name: ReportName, raw: Record<string, string | undefined>): Promise<{ data: T; filters: ReportFilters }> {
  const f: Record<string, unknown> = {};
  for (const key of allowedKeys[name]) {
    const v = raw[key];
    if (!v) continue;
    if ((key === "from" || key === "to") && !iso.test(v)) throw new ValidationError("تاريخ غير صالح.");
    if (key.endsWith("_id") && !uuid.test(v)) throw new ValidationError("قيمة فلتر غير صالحة.");
    if (key === "country" && v.length > 80) throw new ValidationError("قيمة فلتر غير صالحة.");
    f[key] = v;
  }
  if (f.from && f.to && String(f.from) > String(f.to)) throw new ValidationError("بداية الفترة بعد نهايتها.");
  if (f.from && f.to && new Date(String(f.to)).getTime() - new Date(String(f.from)).getTime() > 5 * 366 * 86400_000) throw new ValidationError("الفترة القصوى 5 سنوات.");

  // Scope → user_ids (own/team); an explicit employee filter must be inside it.
  const scope = bos.permissions.get("reports.read");
  let users: string[] | null = scope === "all" ? null : scope === "team" ? await getTeamUserIds(bos) : [bos.userId];
  const pick = f.user_id as string | undefined;
  delete f.user_id;
  if (pick) {
    if (users && !users.includes(pick)) throw new ValidationError("الموظف خارج نطاق صلاحيتك.");
    users = [pick];
  }
  if (users) f.user_ids = users;
  // Branch scope (docs/bos/30 §3.2): allowed/selected branches, never input.
  const branches = await branchFilter(bos);
  if (branches) f.branch_ids = branches;
  const { data, error } = await db().rpc(`bos_report_${name}` as "bos_report_sales", { f: f as never });
  if (error) throw error;
  return { data: data as T, filters: f as ReportFilters };
}

export const reportTitles: Record<string, string> = {
  sales: "تقرير المبيعات",
  revenue: "تقرير الإيرادات",
  bd: "أداء تطوير الأعمال",
  projects: "تقرير المشاريع",
  finance: "التقرير المالي",
  clients: "تقرير العملاء",
  team: "تقرير الفريق",
  performance: "تقرير الأداء",
  countries: "أداء الدول",
  products: "المنتجات والخدمات",
  hr: "تقارير الموارد البشرية",
};
