import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { listApps, listCompanyAccounts } from "@/services/bos/it-access";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, StatusBadge, EmptyState } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDate } from "@/lib/bos/format";
import { statusOptions } from "@/lib/bos/labels";
import { CompanyAccountButton } from "../TeamControls";

// Company-managed accounts (IT §3): the company owns the account; no passwords stored.
export default async function CompanyAccountsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("access.manage", "all");
  const sp = await readParams(searchParams);
  const [rows, apps, names, { data: emps }] = await Promise.all([listCompanyAccounts(sp), listApps(), userNameMap(), db().from("employees").select("id, full_name").is("archived_at", null).order("full_name")]);
  const empOpts = (emps ?? []).map((e) => ({ value: e.id, label: e.full_name }));
  const appOpts = apps.map((a) => ({ value: a.id, label: a.name }));
  const staffOpts = [...names.entries()].map(([value, label]) => ({ value, label }));
  return (
    <>
      <PageHeader title="حسابات الشركة" subtitle="حسابات تملكها الشركة ويُمنح الموظف حق استخدامها — لا تُخزن كلمات المرور هنا أبداً" actions={<CompanyAccountButton employees={empOpts} apps={appOpts} staff={staffOpts} />} />
      <FilterBar searchPlaceholder="المعرّف أو المزوّد..." filters={[{ key: "employee", label: "الموظف", type: "select", options: empOpts }, { key: "status", label: "الحالة", type: "select", options: statusOptions("access_status") }, { key: "mfa", label: "2FA", type: "select", options: [{ value: "noncompliant", label: "غير ملتزم" }] }]} />
      <Card flush>
        {rows.length ? (
          <div className="bos-table-scroll">
            <BosTable className="bos-table responsive">
              <thead><tr><th><Tx>الحساب</Tx></th><th><Tx>الموظف</Tx></th><th><Tx>الحالة</Tx></th><th>2FA</th><th><Tx>المالك / الاسترداد</Tx></th><th><Tx>آخر وصول</Tx></th><th><Tx>آخر مراجعة</Tx></th><th><Tx>أُنشئ</Tx></th><th /></tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td className="cell-primary" data-label="الحساب"><span dir="ltr">{a.identifier}</span><span className="cell-sub">{a.provider} · {a.account_type}{(a.external_apps as { name: string } | null) ? ` · ${(a.external_apps as { name: string }).name}` : ""}</span></td>
                    <td data-label="الموظف"><Link href={`/admin/team/employees/${(a.employees as { id: string }).id}?tab=access`}>{(a.employees as { full_name: string }).full_name}</Link></td>
                    <td data-label="الحالة"><StatusBadge map="access_status" value={a.status} /></td>
                    <td data-label="2FA"><StatusBadge map="mfa_status" value={a.mfa_status} />{a.mfa_method ? <span className="cell-sub"><Tx>{a.mfa_method}</Tx></span> : null}</td>
                    <td data-label="المالك">{a.owner_user_id ? names.get(a.owner_user_id) : "—"}<span className="cell-sub">{a.recovery_owner_user_id ? `استرداد: ${names.get(a.recovery_owner_user_id)}` : ""}</span></td>
                    <td data-label="آخر وصول">{formatDate(a.last_access_at)}</td>
                    <td data-label="آخر مراجعة">{formatDate(a.last_reviewed_at)}</td>
                    <td data-label="أُنشئ">{formatDate(a.created_at)}</td>
                    <td className="col-actions"><CompanyAccountButton label="تعديل" initial={{ ...a }} employees={empOpts} apps={appOpts} staff={staffOpts} /></td>
                  </tr>
                ))}
              </tbody>
            </BosTable>
          </div>
        ) : <EmptyState title="لا توجد حسابات مسجلة" />}
      </Card>
    </>
  );
}
