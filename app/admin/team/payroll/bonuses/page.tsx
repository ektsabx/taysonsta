import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { getSystemTime } from "@/lib/bos/system-time";
import { managedEmployeeIds } from "@/services/bos/team-scope";
import { listBonuses } from "@/services/bos/hr/requests";
import { listCurrencies, userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, EmptyState, Money, StatusBadge, UserAvatar } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { SubNav } from "@/components/bos/SubNav";
import { hrSection } from "@/lib/bos/hr-nav";
import { formatDate } from "@/lib/bos/format";
import { statusOptions } from "@/lib/bos/labels";
import { BonusButton, CancelBonusButton } from "../../HrControls";

// Bonuses (docs/bos/28 §18): request → Finance approval → paid in payroll.
export default async function BonusesPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("payroll.read");
  const sp = await readParams(searchParams);
  const { today } = await getSystemTime();
  const hrAll = scope === "all" || bos.isSuperAdmin;
  const managed = hrAll ? [] : await managedEmployeeIds(bos);
  const [rows, currencies, names, { data: employees }] = await Promise.all([
    listBonuses({ employeeIds: hrAll ? null : [bos.employee.id, ...managed], status: sp.status, employee: sp.employee }),
    listCurrencies(),
    userNameMap(),
    hrAll ? db().from("employees").select("id, full_name").in("lifecycle_status", ["active", "on_leave", "onboarding", "offboarding"]).order("full_name") : db().from("employees").select("id, full_name").in("id", managed.length ? managed : ["00000000-0000-0000-0000-000000000000"]).order("full_name"),
  ]);
  const canRequest = bos.permissions.get("payroll.create") === "all" || bos.isSuperAdmin || managed.length > 0;
  const empOptions = (employees ?? []).map((e) => ({ value: e.id, label: e.full_name }));
  return (
    <>
      <PageHeader title="المكافآت" breadcrumbs={[{ label: "الرواتب", href: "/admin/team/payroll" }, { label: "المكافآت" }]} actions={canRequest && empOptions.length ? <BonusButton employees={empOptions} currencies={currencies} defaultPeriod={today.slice(0, 7)} /> : null} />
      <SubNav items={hrSection(bos, "payroll")} active="bonuses" label="الرواتب" />
      <FilterBar filters={[{ key: "status", label: "الحالة", type: "select", options: statusOptions("bonus_status") }, ...(empOptions.length ? [{ key: "employee", label: "الموظف", type: "select" as const, options: empOptions }] : [])]} />
      <Card flush>
        {rows.length ? (
          <table className="bos-table responsive">
            <thead><tr><th><Tx>الموظف</Tx></th><th><Tx>البيان</Tx></th><th><Tx>النوع</Tx></th><th><Tx>شهر الصرف</Tx></th><th><Tx>المبلغ</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>طلبها</Tx></th><th /></tr></thead>
            <tbody>
              {rows.map((b) => {
                const emp = b.employees as unknown as { id: string; full_name: string; photo_updated_at: string | null } | null;
                return (
                  <tr key={b.id}>
                    <td>{emp ? <Link href={`/admin/team/employees/${emp.id}?tab=bonuses`} className="bos-row" style={{ gap: 8 }}><UserAvatar name={emp.full_name} employeeId={emp.id} version={emp.photo_updated_at} />{emp.full_name}</Link> : "—"}</td>
                    <td className="cell-primary"><Tx>{b.title}</Tx><span className="cell-sub">{b.reason}</span></td>
                    <td><StatusBadge map="bonus_type" value={b.bonus_type} /></td>
                    <td>{b.pay_period.slice(0, 7)}</td>
                    <td><Money value={b.amount} currency={b.currency} /></td>
                    <td><StatusBadge map="bonus_status" value={b.status} />{b.decision_comment ? <span className="cell-sub">{b.decision_comment}</span> : null}</td>
                    <td>{b.requested_by ? names.get(b.requested_by) ?? "—" : "—"}<span className="cell-sub">{formatDate(b.created_at)}</span></td>
                    <td>{hrAll && ["pending", "approved"].includes(b.status) && !b.payslip_id ? <CancelBonusButton id={b.id} /> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <EmptyState title="لا توجد مكافآت" />}
      </Card>
    </>
  );
}
