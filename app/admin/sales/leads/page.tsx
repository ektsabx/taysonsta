import { Tx } from "@/components/bos/I18n";
import { nowMs } from "@/lib/bos/clock";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { listLeads } from "@/services/bos/leads";
import { getPipeline, listActiveStaff, listLeadSources, listSavedViews, userNameMap } from "@/services/bos/shared";
import { PageHeader, StatusBadge, EmptyState, Money } from "@/components/bos/ui";
import { DataTable, type DataColumn } from "@/components/bos/DataTable";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDate, formatDateTime } from "@/lib/bos/format";
import { statusOptions } from "@/lib/bos/labels";
import { bulkArchiveLeadsAction, bulkAssignLeadsAction, bulkStageLeadsAction } from "./actions";
import { deleteViewAction, saveViewAction } from "@/app/admin/_actions/common";

const columns: DataColumn[] = [
  { key: "name", label: "العميل المحتمل", sortable: true, primary: true, alwaysVisible: true },
  { key: "company", label: "الشركة", sortable: true },
  { key: "contact", label: "جهة الاتصال" },
  { key: "country", label: "الدولة", sortable: true },
  { key: "industry", label: "القطاع", defaultHidden: true },
  { key: "source", label: "المصدر" },
  { key: "assigned", label: "المسؤول (BD)" },
  { key: "stage", label: "الحالة" },
  { key: "score", label: "التقييم", sortable: true },
  { key: "budget", label: "الميزانية التقديرية", sortable: true },
  { key: "last", label: "آخر نشاط", sortable: true },
  { key: "next", label: "النشاط التالي", sortable: true },
  { key: "created", label: "تاريخ الإنشاء", sortable: true },
  { key: "updated", label: "آخر تحديث", sortable: true, defaultHidden: true },
];

const sortMap: Record<string, string> = {
  name: "name", company: "company_name", country: "country", score: "total_score", budget: "estimated_budget",
  last: "last_activity_at", next: "next_activity_at", created: "created_at", updated: "updated_at",
};

export default async function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("leads.read");
  const params = await readParams(searchParams);
  const [{ stages }, sources, staff, names, views] = await Promise.all([getPipeline("lead"), listLeadSources(), listActiveStaff(), userNameMap(), listSavedViews(bos, "leads")]);

  let result;
  try {
    result = await listLeads(bos, scope, {
      ...params,
      sort: params.sort ? sortMap[params.sort] : undefined,
      page: pageOf(params),
    });
  } catch {
    result = null;
  }

  const canCreate = can(bos, "leads.create");
  const canAssign = can(bos, "leads.assign");
  const canArchive = can(bos, "leads.delete");
  const now = nowMs();

  return (
    <>
      <PageHeader
        title="العملاء المحتملون"
        subtitle={scope === "all" ? "كل العملاء المحتملين" : scope === "team" ? "عملاء فريقك المحتملون" : "العملاء المحتملون المسندون إليك"}
        breadcrumbs={[{ label: "المبيعات" }, { label: "العملاء المحتملون" }]}
        actions={
          <>
            <Link href="/admin/sales/pipeline?entity=lead" className="admin-btn secondary small">
              <Tx>عرض المسار</Tx>
            </Link>
            {can(bos, "leads.manage") ? (
              <Link href="/admin/sales/leads/import" className="admin-btn secondary small">
                <Tx>استيراد</Tx>
              </Link>
            ) : null}
            {canCreate ? (
              <Link href="/admin/sales/leads/new" className="admin-btn small">
                <Tx>+ عميل محتمل</Tx>
              </Link>
            ) : null}
          </>
        }
      />

      <FilterBar
        searchPlaceholder="بحث بالاسم أو الشركة أو البريد أو الرقم..."
        filters={[
          { key: "stage", label: "المرحلة", type: "select", options: stages.map((s) => ({ value: s.id, label: s.name })) },
          { key: "source", label: "المصدر", type: "select", options: sources.map((s) => ({ value: s.id, label: s.name })) },
          ...(scope !== "own" && scope !== "assigned"
            ? [{ key: "assigned", label: "المسؤول", type: "select" as const, options: [{ value: "me", label: "أنا" }, { value: "none", label: "غير معيّن" }, ...staff.map((s) => ({ value: s.userId, label: s.name }))] }]
            : []),
          { key: "priority", label: "الأولوية", type: "select", options: statusOptions("priority") },
          { key: "country", label: "الدولة", type: "text" },
          { key: "industry", label: "القطاع", type: "text" },
          { key: "scoreMin", label: "أقل تقييم", type: "select", options: [25, 50, 75].map((v) => ({ value: String(v), label: `${v}+` })) },
          { key: "overdue", label: "متابعة متأخرة", type: "select", options: [{ value: "1", label: "نعم" }] },
          { key: "from", label: "من", type: "date" },
          { key: "to", label: "إلى", type: "date" },
          { key: "archived", label: "المؤرشفة", type: "select", options: [{ value: "1", label: "عرض المؤرشفة" }] },
        ]}
      />

      {!result ? (
        <div className="bos-error-state">
          <div className="title"><Tx>تعذر تحميل العملاء المحتملين</Tx></div>
          <Link href="/admin/sales/leads" className="admin-btn secondary small"><Tx>إعادة المحاولة</Tx></Link>
        </div>
      ) : (
        <DataTable
          tableId="leads"
          columns={columns}
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
          exportHref={can(bos, "leads.export") ? "/api/bos/export/leads" : undefined}
          savedViews={views}
          onSaveView={saveViewAction.bind(null, "leads")}
          onDeleteView={deleteViewAction}
          bulkActions={[
            ...(canAssign
              ? [{ key: "assign", label: "تعيين", optionLabel: "المسؤول", options: [{ value: "none", label: "إلغاء التعيين" }, ...staff.map((s) => ({ value: s.userId, label: s.name }))], action: bulkAssignLeadsAction }]
              : []),
            { key: "stage", label: "نقل المرحلة", optionLabel: "المرحلة", options: stages.filter((s) => s.category === "open").map((s) => ({ value: s.id, label: s.name })), action: bulkStageLeadsAction },
            ...(canArchive ? [{ key: "archive", label: "أرشفة", danger: true, confirm: "أرشفة {n} عميل محتمل؟ يمكن استعادتهم لاحقاً.", action: bulkArchiveLeadsAction }] : []),
          ]}
          empty={
            <EmptyState
              title={Object.keys(params).length ? "لا توجد نتائج مطابقة" : "لا يوجد عملاء محتملون بعد"}
              description={Object.keys(params).length ? "جرّب تعديل الفلاتر." : "ابدأ بإضافة أول عميل محتمل أو استيراد قائمة."}
              actions={
                canCreate ? (
                  <>
                    <Link href="/admin/sales/leads/new" className="admin-btn small">
                      <Tx>إضافة عميل محتمل</Tx>
                    </Link>
                    {can(bos, "leads.manage") ? (
                      <Link href="/admin/sales/leads/import" className="admin-btn small secondary">
                        <Tx>استيراد عملاء</Tx>
                      </Link>
                    ) : null}
                  </>
                ) : null
              }
            />
          }
          rows={result.rows.map((l) => {
            const stage = l.pipeline_stages as unknown as { name: string; key: string; category: string };
            const overdue = l.next_activity_at && new Date(l.next_activity_at).getTime() < now;
            return {
              id: l.id,
              cells: {
                name: (
                  <Link href={`/admin/sales/leads/${l.id}`}>
                    {l.name}
                    <span className="cell-sub">{l.lead_number}{l.converted_deal_id ? " · تم التحويل" : ""}{l.archived_at ? " · مؤرشف" : ""}</span>
                  </Link>
                ),
                company: l.company_name ?? "—",
                contact: (
                  <span>
                    <Tx>{l.contact_name ?? "—"}</Tx>
                    <span className="cell-sub">{l.email ?? l.phone ?? ""}</span>
                  </span>
                ),
                country: l.country ?? "—",
                industry: l.industry ?? "—",
                source: (l.lead_sources as unknown as { name: string } | null)?.name ?? "—",
                assigned: l.assigned_to ? names.get(l.assigned_to) ?? "—" : <span className="bos-faint"><Tx>غير معيّن</Tx></span>,
                stage: <StatusBadge label={stage.name} tone={stage.category === "won" ? "success" : stage.category === "lost" ? "danger" : "info"} />,
                score: <span className="bos-num"><Tx>{l.total_score}</Tx></span>,
                budget: l.estimated_budget ? <Money value={l.estimated_budget} currency={l.budget_currency} /> : "—",
                last: l.last_activity_at ? formatDateTime(l.last_activity_at) : "—",
                next: l.next_activity_at ? <span style={overdue ? { color: "#f87171" } : undefined}>{formatDateTime(l.next_activity_at)}</span> : <span className="bos-faint"><Tx>لا يوجد</Tx></span>,
                created: formatDate(l.created_at),
                updated: formatDate(l.updated_at),
              },
            };
          })}
        />
      )}
    </>
  );
}
