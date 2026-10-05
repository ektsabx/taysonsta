import "server-only";
import { db } from "@/lib/bos/db";
import { getTeamUserIds, type BosUser } from "@/lib/bos/auth";
import { ValidationError } from "@/lib/bos/errors";
import { isCurrency } from "@/lib/bos/currency";

// Reports (docs/bos/21): thin, validated wrappers over bos_report_* SQL
// functions. Scope comes from reports.read (own/team/all) — never from input.

export type ReportName = "sales" | "revenue" | "bd" | "clients" | "countries" | "team";

export interface ReportFilters {
  from?: string;
  to?: string;
  client_id?: string;
  country?: string;
  source_id?: string;
  // One currency per report (EGP or USD, final spec §54); USD when absent.
  currency?: string;
  department_id?: string;
  user_id?: string;
}

const allowedKeys: Record<ReportName, (keyof ReportFilters)[]> = {
  sales: ["from", "to", "client_id", "country", "source_id", "user_id", "currency"],
  revenue: ["from", "to", "client_id", "currency"],
  bd: ["from", "to", "user_id", "currency"],
  clients: ["from", "to", "user_id", "currency"],
  countries: ["from", "to", "user_id", "currency"],
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
    if (key === "currency" && !isCurrency(v)) throw new ValidationError("قيمة فلتر غير صالحة.");
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
  const { data, error } = await db().rpc(`bos_report_${name}` as "bos_report_sales", { f: f as never });
  if (error) throw error;
  return { data: data as T, filters: f as ReportFilters };
}

export const reportTitles: Record<string, string> = {
  sales: "تقرير المبيعات",
  revenue: "تقرير الإيرادات",
  bd: "أداء تطوير الأعمال",
  finance: "التقرير المالي",
  clients: "تقرير العملاء",
  team: "تقرير الفريق",
  performance: "تقرير الأداء",
  countries: "أداء الدول",
  hr: "تقارير الموارد البشرية",
};
