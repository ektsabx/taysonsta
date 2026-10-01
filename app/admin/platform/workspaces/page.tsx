import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { PageHeader, Card, EmptyState, ProgressBar } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { FilterBar } from "@/components/bos/FilterBar";
import { Tx } from "@/components/bos/I18n";
import { formatDate } from "@/lib/bos/format";
import { yoliasPlanIds, yoliasPlanLabel } from "@/lib/yolias/plans";
import { listWorkspaces } from "@/services/yolias/platform";
import { NotConnected, connected, PlanBadge, Pager, qsFor, num } from "@/components/yolias/PlatformUi";

// Yolias workspaces with plan, members and this month's prospect usage
// (docs/09-yolias-admin.md §B "Workspaces", "Prospect Quotas").
export default async function PlatformWorkspacesPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="مساحات العمل" /><NotConnected /></>);
  const sp = await readParams(searchParams);
  const page = pageOf(sp);
  const { rows, total, pages } = await listWorkspaces({ q: sp.q, plan: sp.plan, page });
  return (
    <>
      <PageHeader title="مساحات العمل" subtitle={<Tx vars={{ n: num(total) }}>{"{n} مساحة عمل"}</Tx>} />
      <FilterBar searchPlaceholder="بحث بالاسم أو الموقع" filters={[
        { key: "plan", label: "الخطة", type: "select", options: yoliasPlanIds.map((p) => ({ value: p, label: yoliasPlanLabel[p] })) },
      ]} />
      <Card flush>
        {rows.length ? (
          <div className="bos-table-scroll">
            <BosTable className="bos-table responsive">
              <thead><tr><th><Tx>مساحة العمل</Tx></th><th><Tx>الخطة</Tx></th><th><Tx>الأعضاء</Tx></th><th><Tx>عمليات البحث</Tx></th><th style={{ minWidth: 180 }}><Tx>الاستخدام هذا الشهر</Tx></th><th><Tx>تاريخ الإنشاء</Tx></th></tr></thead>
              <tbody>
                {rows.map((w) => {
                  const quota = w.stats?.allowance ?? 0;
                  const used = w.stats?.prospects_month ?? 0;
                  return (
                    <tr key={w.id}>
                      <td>
                        <Link className="bos-link" href={`/admin/platform/workspaces/${w.id}`}>{w.name || <Tx>مساحة عمل بدون اسم</Tx>}</Link>
                        {w.website ? <span className="cell-sub" dir="ltr">{w.website}</span> : null}
                      </td>
                      <td><PlanBadge plan={w.plan} status={w.subscription_status} /></td>
                      <td className="bos-num">{num(w.stats?.members ?? 0)}</td>
                      <td className="bos-num">{num(w.stats?.searches ?? 0)}</td>
                      <td>
                        <span className="bos-num" style={{ fontSize: 12 }}>{num(used)} / {num(quota)}</span>
                        <ProgressBar value={quota ? (used / quota) * 100 : 0} tone={quota && used >= quota ? "warning" : undefined} />
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{formatDate(w.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </BosTable>
          </div>
        ) : <EmptyState title="لا توجد مساحات عمل" />}
        <Pager page={page} pages={pages} href={qsFor("/admin/platform/workspaces", sp)} />
      </Card>
    </>
  );
}
