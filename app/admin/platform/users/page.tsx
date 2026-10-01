import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { PageHeader, Card, EmptyState, StatusBadge } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { FilterBar } from "@/components/bos/FilterBar";
import { Tx } from "@/components/bos/I18n";
import { formatDate, formatDateTime } from "@/lib/bos/format";
import { listUsers } from "@/services/yolias/platform";
import { NotConnected, connected, PlanBadge, Pager, qsFor, num } from "@/components/yolias/PlatformUi";

const roleLabel: Record<string, string> = { owner: "المالك", admin: "مسؤول", member: "عضو" };

// Yolias users (docs/09-yolias-admin.md §B "Users"). Read-only in this phase.
export default async function PlatformUsersPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="المستخدمون" /><NotConnected /></>);
  const sp = await readParams(searchParams);
  const page = pageOf(sp);
  const { rows, total, pages } = await listUsers({ q: sp.q, page });
  return (
    <>
      <PageHeader title="المستخدمون" subtitle={<Tx vars={{ n: num(total) }}>{"{n} مستخدم في Yolias"}</Tx>} />
      <FilterBar searchPlaceholder="بحث بالاسم أو البريد" filters={[]} />
      <Card flush>
        {rows.length ? (
          <div className="bos-table-scroll">
            <BosTable className="bos-table responsive">
              <thead><tr><th><Tx>الاسم</Tx></th><th><Tx>البريد الإلكتروني</Tx></th><th><Tx>مساحة العمل</Tx></th><th><Tx>الدور</Tx></th><th><Tx>الخطة</Tx></th><th><Tx>اللغة / الدولة</Tx></th><th><Tx>تاريخ التسجيل</Tx></th><th><Tx>آخر دخول</Tx></th></tr></thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id}>
                    <td>
                      {u.full_name || "—"}
                      {!u.onboarded_at ? <span className="cell-sub"><Tx>لم يكمل الإعداد</Tx></span> : null}
                    </td>
                    <td dir="ltr">
                      {u.email}
                      {!u.confirmed ? <span className="cell-sub"><StatusBadge tone="warning" label="البريد غير مؤكد" /></span> : null}
                    </td>
                    <td>{u.workspace ? <Link className="bos-link" href={`/admin/platform/workspaces/${u.workspace.id}`}>{u.workspace.name || "—"}</Link> : "—"}</td>
                    <td>{u.role ? <Tx>{roleLabel[u.role] ?? u.role}</Tx> : "—"}</td>
                    <td>{u.workspace ? <PlanBadge plan={u.workspace.plan} status={u.workspace.subscription_status} /> : "—"}</td>
                    <td dir="ltr">{u.language.toUpperCase()} · {u.country}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDate(u.created_at)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{u.last_sign_in_at ? formatDateTime(u.last_sign_in_at) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </BosTable>
          </div>
        ) : <EmptyState title="لا يوجد مستخدمون" />}
        <Pager page={page} pages={pages} href={qsFor("/admin/platform/users", sp)} />
      </Card>
    </>
  );
}
