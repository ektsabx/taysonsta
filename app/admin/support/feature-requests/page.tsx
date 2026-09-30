import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { listFeatureRequests } from "@/services/bos/support";
import { PageHeader, StatusBadge, EmptyState, Card, Money } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDate } from "@/lib/bos/format";
import { statusOptions } from "@/lib/bos/labels";
import { priorities } from "../SupportControls";

export default async function FeatureRequestsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("feature_requests.read");
  const sp = await readParams(searchParams);
  const rows = await listFeatureRequests(bos, scope, sp);
  return (
    <>
      <PageHeader title="طلبات الميزات" subtitle={<Tx vars={{ rows_count: rows.length }}>{"{rows_count} طلب"}</Tx>} breadcrumbs={[{ label: "الدعم" }, { label: "طلبات الميزات" }]} actions={can(bos, "feature_requests.create") ? <Link className="admin-btn small" href="/admin/support/feature-requests/new"><Tx>+ طلب</Tx></Link> : null} />
      <FilterBar searchPlaceholder="بحث..." filters={[{ key: "status", label: "الحالة", type: "select", options: statusOptions("feature_request_status") }, { key: "priority", label: "الأولوية", type: "select", options: priorities }]} />
      <Card flush>
        {rows.length ? (
          <table className="bos-table responsive">
            <thead><tr><th><Tx>الميزة</Tx></th><th><Tx>العميل / المشروع</Tx></th><th><Tx>الأولوية</Tx></th><th><Tx>الجهد</Tx></th><th><Tx>التكلفة</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>التاريخ</Tx></th></tr></thead>
            <tbody>
              {rows.map((f) => {
                const c = f.clients as unknown as { id: string; name: string; company_name: string | null } | null;
                const p = f.projects as unknown as { id: string; name: string } | null;
                return (
                  <tr key={f.id}>
                    <td className="cell-primary"><Link href={`/admin/support/feature-requests/${f.id}`}><Tx>{f.title}</Tx></Link>{f.deal_id ? <span className="cell-sub"><Tx>صفقة بيع إضافي مرتبطة</Tx></span> : null}</td>
                    <td>{c ? c.company_name ?? c.name : "—"}{p ? <span className="cell-sub">{p.name}</span> : null}</td>
                    <td><StatusBadge map="priority" value={f.priority} /></td>
                    <td>{f.estimated_effort_hours != null ? `${Number(f.estimated_effort_hours)} س` : "—"}</td>
                    <td>{f.cost != null ? <Money value={f.cost} currency={f.currency} /> : "—"}</td>
                    <td><StatusBadge map="feature_request_status" value={f.status} /></td>
                    <td>{formatDate(f.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <EmptyState title="لا توجد طلبات ميزات" />}
      </Card>
    </>
  );
}
