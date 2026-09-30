import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { getSystemTime } from "@/lib/bos/system-time";
import { listDepartments } from "@/services/bos/shared";
import { PageHeader, Card, EmptyState, Money, StatusBadge, UserAvatar } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDate } from "@/lib/bos/format";

// Salaries & allowances overview (docs/bos/28 §6 Compensation, §16).
export default async function CompensationPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("payroll.read", "all");
  const sp = await readParams(searchParams);
  const { today } = await getSystemTime();
  let q = db().from("employees").select("id, full_name, position, photo_updated_at, hourly_cost, cost_currency, hourly_cost_source, department_id, departments(name)").not("lifecycle_status", "in", "(candidate,hired,terminated,archived)").order("full_name");
  if (sp.department) q = q.eq("department_id", sp.department);
  const [{ data: emps }, { data: comps }, { data: components }, { data: pending }, departments] = await Promise.all([
    q,
    db().from("employee_compensation").select("employee_id, basic_salary, currency, effective_from, approval_status").eq("approval_status", "approved").lte("effective_from", today).order("effective_from", { ascending: false }),
    db().from("employee_salary_components").select("employee_id, amount, effective_to, salary_components(kind, calc_type)").lte("effective_from", today),
    db().from("employee_compensation").select("employee_id").eq("approval_status", "pending"),
    listDepartments(),
  ]);
  const current = new Map<string, { basic_salary: number; currency: string; effective_from: string }>();
  for (const c of comps ?? []) if (!current.has(c.employee_id)) current.set(c.employee_id, c);
  const canSeeCost = bos.permissions.has("employees.view_sensitive") || bos.isSuperAdmin;
  const rows = (emps ?? []).filter((e) => !sp.missing || !current.has(e.id));
  return (
    <>
      <PageHeader title="الرواتب والبدلات" subtitle="الراتب الأساسي الساري لكل موظف والبدلات الثابتة" />
      <FilterBar filters={[{ key: "department", label: "القسم", type: "select", options: departments.map((d) => ({ value: d.id, label: d.name })) }, { key: "missing", label: "بدون راتب", type: "select", options: [{ value: "1", label: "بدون راتب معتمد فقط" }] }]} />
      <Card flush>
        {rows.length ? (
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>الموظف</Tx></th><th><Tx>القسم</Tx></th><th><Tx>الأساسي</Tx></th><th><Tx>ساري من</Tx></th><th><Tx>البدلات الثابتة</Tx></th>{canSeeCost ? <th><Tx>تكلفة الساعة (للمشاريع)</Tx></th> : null}<th /></tr></thead>
            <tbody>
              {rows.map((e) => {
                const c = current.get(e.id);
                const mine = (components ?? []).filter((x) => x.employee_id === e.id && (!x.effective_to || x.effective_to >= today) && (x.salary_components as unknown as { kind: string } | null)?.kind === "earning");
                const fixed = mine.filter((x) => (x.salary_components as unknown as { calc_type: string }).calc_type === "fixed").reduce((s, x) => s + Number(x.amount), 0);
                const pct = mine.filter((x) => (x.salary_components as unknown as { calc_type: string }).calc_type === "percent_of_basic").reduce((s, x) => s + Number(x.amount), 0);
                return (
                  <tr key={e.id}>
                    <td className="cell-primary"><Link href={`/admin/team/employees/${e.id}?tab=payroll`} className="bos-row" style={{ gap: 8 }}><UserAvatar name={e.full_name} employeeId={e.id} version={e.photo_updated_at} /><span>{e.full_name}<span className="cell-sub">{e.position ?? ""}</span></span></Link></td>
                    <td>{(e.departments as { name: string } | null)?.name ?? "—"}</td>
                    <td>{c ? <Money value={c.basic_salary} currency={c.currency} /> : <StatusBadge tone="warning" label="غير محدد" />}{(pending ?? []).some((p) => p.employee_id === e.id) ? <span className="cell-sub" style={{ color: "var(--bos-warning)" }}><Tx>تعديل بانتظار الاعتماد</Tx></span> : null}</td>
                    <td>{c ? formatDate(c.effective_from) : "—"}</td>
                    <td>{fixed ? <Money value={fixed} currency={c?.currency ?? null} /> : null}{pct ? <span className="cell-sub"><Tx vars={{ pct }}>{"+ {pct}% من الأساسي"}</Tx></span> : null}{!fixed && !pct ? "—" : null}</td>
                    {canSeeCost ? <td>{e.hourly_cost != null ? <Money value={e.hourly_cost} currency={e.cost_currency} /> : "—"}<span className="cell-sub"><Tx>{e.hourly_cost_source === "salary" ? "من الراتب" : "يدوي"}</Tx></span></td> : null}
                    <td><Link className="bos-link" href={`/admin/team/employees/${e.id}?tab=payroll`}><Tx>إدارة</Tx></Link></td>
                  </tr>
                );
              })}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا يوجد" />}
      </Card>
    </>
  );
}
