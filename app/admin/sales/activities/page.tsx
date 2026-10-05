import { Tx } from "@/components/bos/I18n";
import { nowMs } from "@/lib/bos/clock";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { listActivities } from "@/services/bos/activities";
import { listActiveStaff, userNameMap } from "@/services/bos/shared";
import { PageHeader, StatusBadge, EmptyState } from "@/components/bos/ui";
import { DataTable, type DataColumn } from "@/components/bos/DataTable";
import { FilterBar } from "@/components/bos/FilterBar";
import { ActivityRowActions } from "@/components/bos/ActivityRowActions";
import { formatDateTime } from "@/lib/bos/format";
import { statusLabel, statusOptions } from "@/lib/bos/labels";

const columns: DataColumn[] = [
  { key: "title", label: "النشاط", primary: true, alwaysVisible: true },
  { key: "type", label: "النوع" },
  { key: "related", label: "مرتبط بـ" },
  { key: "assigned", label: "المسؤول" },
  { key: "due", label: "الموعد" },
  { key: "priority", label: "الأولوية" },
  { key: "status", label: "الحالة" },
  { key: "actions", label: "", alwaysVisible: true, align: "end" },
];

export default async function ActivitiesPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("activities.read");
  const params = await readParams(searchParams);
  const [result, names, staff] = await Promise.all([listActivities(bos, scope, { ...params, page: pageOf(params) }), userNameMap(), listActiveStaff()]);
  const now = nowMs();

  return (
    <>
      <PageHeader
        title="الأنشطة"
        subtitle="مكالمات ورسائل ومتابعات ومهام مرتبطة بالعملاء المحتملين والصفقات والحسابات والمشاريع"
       
        actions={
          <Link href="/admin/calendar?type=follow_up" className="admin-btn small secondary">
            <Tx>عرض في التقويم</Tx>
          </Link>
        }
      />
      <FilterBar
        searchPlaceholder="بحث في العناوين..."
        filters={[
          { key: "mine", label: "النطاق", type: "select", options: [{ value: "1", label: "أنشطتي فقط" }] },
          { key: "type", label: "النوع", type: "select", options: statusOptions("activity_type") },
          { key: "status", label: "الحالة", type: "select", options: statusOptions("activity_status") },
          { key: "related", label: "مرتبط بـ", type: "select", options: [{ value: "lead", label: "عميل محتمل" }, { value: "deal", label: "صفقة" }, { value: "client", label: "حساب" }] },
          ...(scope === "all" || scope === "team" ? [{ key: "assigned", label: "المسؤول", type: "select" as const, options: staff.map((s) => ({ value: s.userId, label: s.name })) }] : []),
          { key: "from", label: "من", type: "date" },
          { key: "to", label: "إلى", type: "date" },
        ]}
      />
      <DataTable
        tableId="activities"
        columns={columns}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        empty={<EmptyState title="لا توجد أنشطة" description="سجّل الأنشطة من صفحات العملاء المحتملين والصفقات والحسابات." />}
        rows={result.rows.map((a) => {
          const lead = a.leads as unknown as { name: string } | null;
          const deal = a.deals as unknown as { name: string } | null;
          const client = a.clients as unknown as { name: string } | null;
          const related = a.lead_id ? (
            <Link href={`/admin/sales/leads/${a.lead_id}?tab=activities`}><Tx vars={{ name: lead?.name }}>{"عميل محتمل: {name}"}</Tx></Link>
          ) : a.deal_id ? (
            <Link href={`/admin/sales/deals/${a.deal_id}?tab=activities`}><Tx vars={{ name: deal?.name }}>{"صفقة: {name}"}</Tx></Link>
          ) : a.client_id ? (
            <Link href={`/admin/clients/${a.client_id}`}><Tx vars={{ name: client?.name }}>{"حساب: {name}"}</Tx></Link>
          ) : (
            "—"
          );
          const overdue = a.due_at && ["pending", "in_progress"].includes(a.status) && new Date(a.due_at).getTime() < now;
          return {
            id: a.id,
            cells: {
              title: (
                <span>
                  {a.title}
                  {a.description ? <span className="cell-sub">{a.description.slice(0, 120)}</span> : null}
                </span>
              ),
              type: statusLabel("activity_type", a.type),
              related,
              assigned: a.assigned_to ? names.get(a.assigned_to) ?? "—" : "—",
              due: <span style={overdue || a.status === "overdue" ? { color: "var(--bos-danger)" } : undefined}>{formatDateTime(a.due_at ?? a.completed_at ?? a.created_at)}</span>,
              priority: <StatusBadge map="priority" value={a.priority} />,
              status: <StatusBadge map="activity_status" value={a.status} />,
              actions: can(bos, "activities.update") && !["completed", "cancelled"].includes(a.status) ? <ActivityRowActions id={a.id} /> : null,
            },
          };
        })}
      />
    </>
  );
}
