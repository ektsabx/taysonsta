import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { myProjectIds, teamProjectIds } from "@/lib/bos/access";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { PageHeader, StatusBadge, EmptyState, Money } from "@/components/bos/ui";
import { DataTable } from "@/components/bos/DataTable";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDate } from "@/lib/bos/format";
import { statusOptions } from "@/lib/bos/labels";

export default async function ChangeRequestsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("change_requests.read");
  const params = await readParams(searchParams);
  const page = pageOf(params);
  let q = db().from("change_requests").select("*, projects(id, name), clients(name, company_name)", { count: "exact" });
  if (scope !== "all") {
    const ids = scope === "team" ? await teamProjectIds(bos) : await myProjectIds(bos);
    q = ids.length ? q.in("project_id", ids) : q.eq("project_id", "00000000-0000-0000-0000-000000000000");
  }
  if (params.status) q = q.eq("status", params.status as "requested");
  if (params.q) q = q.or(`title.ilike.%${params.q.replace(/[%_,()]/g, " ")}%,cr_number.ilike.%${params.q.replace(/[%_,()]/g, " ")}%`);
  const { data, count, error } = await q.order("created_at", { ascending: false }).range((page - 1) * 25, page * 25 - 1);
  if (error) throw error;
  return (
    <>
      <PageHeader title="طلبات التغيير" subtitle="الأعمال خارج النطاق الأصلي: تقييم → عرض → موافقة العميل → إضافة للمشروع" />
      <FilterBar searchPlaceholder="رقم أو عنوان الطلب..." filters={[{ key: "status", label: "الحالة", type: "select", options: statusOptions("change_request_status") }]} />
      <DataTable
        tableId="change-requests"
        columns={[
          { key: "title", label: "الطلب", primary: true, alwaysVisible: true },
          { key: "project", label: "المشروع" },
          { key: "client", label: "العميل" },
          { key: "cost", label: "التكلفة", align: "end" },
          { key: "days", label: "أيام إضافية" },
          { key: "status", label: "الحالة" },
          { key: "date", label: "التاريخ" },
        ]}
        total={count ?? 0}
        page={page}
        pageSize={25}
        empty={<EmptyState title="لا توجد طلبات تغيير" description="أنشئ طلب التغيير من صفحة المشروع." />}
        rows={(data ?? []).map((c) => {
          const p = c.projects as unknown as { id: string; name: string } | null;
          const cl = c.clients as unknown as { name: string; company_name: string | null } | null;
          return {
            id: c.id,
            cells: {
              title: <Link href={`/admin/projects/change-requests/${c.id}`}><Tx>{c.title}</Tx><span className="cell-sub"><Tx>{c.cr_number}</Tx></span></Link>,
              project: p ? <Link href={`/admin/projects/${p.id}?tab=change_requests`}>{p.name}</Link> : "—",
              client: cl?.company_name ?? cl?.name ?? "—",
              cost: <Money value={c.additional_cost} currency={c.currency} />,
              days: c.additional_days,
              status: <StatusBadge map="change_request_status" value={c.status} />,
              date: formatDate(c.created_at),
            },
          };
        })}
      />
    </>
  );
}
