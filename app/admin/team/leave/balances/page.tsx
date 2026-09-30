import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { getSystemTime } from "@/lib/bos/system-time";
import { peopleScope } from "@/services/bos/team-scope";
import { getBalances, listBalanceAdjustments, listLeaveTypes } from "@/services/bos/leave";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, EmptyState, UserAvatar } from "@/components/bos/ui";
import { SubNav } from "@/components/bos/SubNav";
import { hrSection } from "@/lib/bos/hr-nav";
import { formatDate } from "@/lib/bos/format";
import { BalanceAdjustButton } from "../../HrControls";

// Leave balances per employee and type: allowance, used, pending, remaining
// (docs/bos/28 §14), with adjustments / carry-forward.
export default async function LeaveBalancesPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("leave.read");
  const sp = await readParams(searchParams);
  const { today } = await getSystemTime();
  const year = sp.year && /^\d{4}$/.test(sp.year) ? Number(sp.year) : Number(today.slice(0, 4));
  const { users } = await peopleScope(bos, "leave.read");
  let q = db().from("employees").select("id, user_id, full_name, photo_updated_at, position").not("user_id", "is", null).is("archived_at", null).in("lifecycle_status", ["active", "on_leave", "onboarding", "offboarding"]).order("full_name");
  if (users) q = q.in("user_id", users.length ? users : ["00000000-0000-0000-0000-000000000000"]);
  const [{ data: emps }, types, names] = await Promise.all([q, listLeaveTypes(), userNameMap()]);
  const rows = await Promise.all((emps ?? []).map(async (e) => ({ e, balances: await getBalances(e.user_id as string, year) })));
  const canAdjust = bos.permissions.get("leave.update") === "all" || bos.isSuperAdmin;
  const selected = sp.employee ? rows.find((r) => r.e.id === sp.employee) : null;
  const adjustments = selected ? await listBalanceAdjustments(selected.e.user_id as string, year) : [];
  return (
    <>
      <PageHeader title="أرصدة الإجازات" subtitle={<Tx vars={{ year }}>{"سنة {year}"}</Tx>} breadcrumbs={[{ label: "الفريق" }, { label: "الإجازات", href: "/admin/team/leave" }, { label: "الأرصدة" }]} />
      <SubNav items={hrSection(bos, "leave")} active="balances" label="الإجازات" />
      <div className="bos-row" style={{ gap: 8, marginBottom: 10 }}>
        <Link className="admin-btn small ghost" href={`/admin/team/leave/balances?year=${year - 1}`}>{year - 1}</Link>
        <Link className="admin-btn small ghost" href={`/admin/team/leave/balances?year=${year + 1}`}>{year + 1}</Link>
      </div>
      <Card flush>
        {rows.length ? (
          <div className="bos-table-scroll">
            <table className="bos-table">
              <thead><tr><th><Tx>الموظف</Tx></th>{types.map((t) => <th key={t.id}>{t.name}<span className="cell-sub"><Tx>المتبقي / الرصيد</Tx></span></th>)}<th /></tr></thead>
              <tbody>
                {rows.map(({ e, balances }) => (
                  <tr key={e.id}>
                    <td><Link href={`/admin/team/leave/balances?year=${year}&employee=${e.id}`} className="bos-row" style={{ gap: 8 }}><UserAvatar name={e.full_name} employeeId={e.id} version={e.photo_updated_at} />{e.full_name}</Link></td>
                    {types.map((t) => {
                      const b = balances.find((x) => x.type.id === t.id);
                      if (!b) return <td key={t.id} className="bos-faint">—</td>;
                      return <td key={t.id}>{b.remaining ?? "∞"}{b.allowance != null ? ` / ${b.allowance}` : ""}<span className="cell-sub">مستخدم {b.used}{b.pending ? ` · معلّق ${b.pending}` : ""}</span></td>;
                    })}
                    <td>{canAdjust ? <BalanceAdjustButton userId={e.user_id as string} types={types.map((t) => ({ value: t.id, label: t.name }))} year={year} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="لا يوجد موظفون" />}
      </Card>
      {selected ? (
        <Card title={<Tx vars={{ full_name: selected.e.full_name, year }}>{"تعديلات رصيد {full_name} — {year}"}</Tx>}>
          {adjustments.length ? adjustments.map((a) => (
            <div key={a.id} style={{ fontSize: 13, marginBottom: 6 }}>
              {(a.leave_types as { name: string } | null)?.name}: <strong>{Number(a.days) > 0 ? "+" : ""}{a.days}</strong> يوم ({a.kind === "carry_forward" ? "ترحيل" : a.kind === "allowance_override" ? "رصيد مخصص" : "تعديل"}) — {a.reason}
              <span className="bos-faint" style={{ fontSize: 12 }}> · {a.created_by ? names.get(a.created_by) ?? "" : ""} · {formatDate(a.created_at)}</span>
            </div>
          )) : <EmptyState title="لا توجد تعديلات" />}
        </Card>
      ) : null}
    </>
  );
}
