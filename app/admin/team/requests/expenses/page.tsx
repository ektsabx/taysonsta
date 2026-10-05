import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { canAccessEntity } from "@/lib/bos/access";
import { managedUserIds } from "@/services/bos/team-scope";
import { listExpenseClaims } from "@/services/bos/hr/requests";
import { listCurrencies, userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, EmptyState, Money, StatusBadge, UserAvatar } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { FileManager } from "@/components/bos/FileManager";
import { formatDate } from "@/lib/bos/format";
import { statusOptions } from "@/lib/bos/labels";
import { ExpenseClaimButton, ReimburseButton } from "../../HrControls";

// Employee expenses (docs/bos/28 §19): claim → receipt → manager → finance →
// reimbursement (direct or with payroll). Stored in the Finance expenses ledger.
export default async function ExpenseClaimsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("hr_requests.read");
  const sp = await readParams(searchParams);
  const all = bos.isSuperAdmin || bos.permissions.get("hr_requests.read") === "all" || bos.permissions.get("expenses.read") === "all";
  const managed = all ? [] : await managedUserIds(bos);
  const [rows, currencies, names, { data: categories }] = await Promise.all([
    listExpenseClaims({ userIds: all ? null : [bos.userId, ...managed], status: sp.status, reimbursement: sp.reimbursement }),
    listCurrencies(),
    userNameMap(),
    db().from("expense_categories").select("id, name").eq("is_active", true).order("name"),
  ]);
  const canReimburse = bos.isSuperAdmin || bos.permissions.get("expenses.approve") === "all" || bos.permissions.get("payroll.approve") === "all";
  const open = sp.open && (await canAccessEntity(bos, "expense", sp.open)) ? rows.find((r) => r.id === sp.open) ?? null : null;
  const total = (list: typeof rows) => {
    const byCur = new Map<string, number>();
    for (const r of list) byCur.set(r.currency, (byCur.get(r.currency) ?? 0) + Number(r.amount));
    return [...byCur.entries()].map(([c, v]) => `${v.toLocaleString("en-US")} ${c}`).join(" · ") || "0";
  };
  return (
    <>
      <PageHeader title="المصروفات والاسترداد" subtitle="تظهر في المالية بعد الاعتماد"
        actions={<ExpenseClaimButton employees={[]} fixedEmployeeId={bos.employee.id} categories={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))} currencies={currencies} label="تقديم مصروف" />} />
      <div className="bos-row" style={{ gap: 16, flexWrap: "wrap", fontSize: 13, marginBottom: 10 }}>
        <span><Tx>بانتظار الموافقة:</Tx> <strong>{total(rows.filter((r) => r.approval_status === "pending"))}</strong></span>
        <span><Tx>بانتظار الاسترداد:</Tx> <strong>{total(rows.filter((r) => r.reimbursement_status === "pending"))}</strong></span>
      </div>
      <FilterBar filters={[{ key: "status", label: "الموافقة", type: "select", options: statusOptions("simple_approval") }, { key: "reimbursement", label: "الاسترداد", type: "select", options: statusOptions("reimbursement_status") }]} />
      {open ? (
        <Card title={<Tx vars={{ description: open.description }}>{"إيصالات: {description}"}</Tx>} actions={<Link className="bos-link" href="/admin/team/requests/expenses"><Tx>إغلاق</Tx></Link>}>
          <FileManager entityType="expense" entityId={open.id} canUpload={open.employee_user_id === bos.userId || all} />
        </Card>
      ) : null}
      <Card flush>
        {rows.length ? (
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>الموظف</Tx></th><th><Tx>التاريخ</Tx></th><th><Tx>الوصف</Tx></th><th><Tx>المبلغ</Tx></th><th><Tx>الموافقة</Tx></th><th><Tx>الاسترداد</Tx></th><th /></tr></thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td>{e.employee_user_id ? <span className="bos-row" style={{ gap: 8 }}><UserAvatar name={names.get(e.employee_user_id)} userId={e.employee_user_id} />{names.get(e.employee_user_id) ?? "—"}</span> : "—"}</td>
                  <td>{formatDate(e.expense_date)}</td>
                  <td className="cell-primary"><Tx>{e.description}</Tx><span className="cell-sub">{(e.expense_categories as { name: string } | null)?.name ?? ""}</span></td>
                  <td><Money value={e.amount} currency={e.currency} /></td>
                  <td><StatusBadge map="simple_approval" value={e.approval_status} /></td>
                  <td><StatusBadge map="reimbursement_status" value={e.reimbursement_status} />{e.reimbursed_at ? <span className="cell-sub">{e.reimbursement_method === "payroll" ? "مع الراتب" : "مباشر"} · {formatDate(e.reimbursed_at)}</span> : null}</td>
                  <td className="bos-row" style={{ gap: 4 }}>
                    <Link className="admin-btn small ghost" href={`/admin/team/requests/expenses?open=${e.id}`}><Tx>الإيصال</Tx></Link>
                    {canReimburse && e.reimbursement_status === "pending" ? <ReimburseButton id={e.id} /> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد مصروفات" />}
      </Card>
    </>
  );
}
