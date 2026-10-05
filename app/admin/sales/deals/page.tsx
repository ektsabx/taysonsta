import { ImportButton } from "@/components/bos/ImportButton";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can, scopeUserIds } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { listDeals } from "@/services/bos/deals";
import { pipelineMetrics } from "@/services/bos/metrics";
import { isCurrency } from "@/lib/bos/currency";
import { getPipeline, listActiveStaff, listCurrencies, listSavedViews, userNameMap } from "@/services/bos/shared";
import { PageHeader, StatusBadge, EmptyState, Money, KpiCard } from "@/components/bos/ui";
import { DataTable, type DataColumn } from "@/components/bos/DataTable";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDate, todayIn, startOfMonth } from "@/lib/bos/format";
import { formatMoney, percentOf, toDecimalString } from "@/lib/bos/money";
import { bulkAssignDealsAction } from "./actions";
import { deleteViewAction, saveViewAction } from "@/app/admin/_actions/common";

const columns: DataColumn[] = [
  { key: "name", label: "الصفقة", sortable: true, primary: true, alwaysVisible: true },
  { key: "client", label: "الحساب" },
  { key: "contact", label: "جهة الاتصال", defaultHidden: true },
  { key: "value", label: "القيمة", sortable: true },
  { key: "stage", label: "المرحلة" },
  { key: "probability", label: "الاحتمالية", sortable: true },
  { key: "weighted", label: "القيمة الموزونة" },
  { key: "close", label: "الإغلاق المتوقع", sortable: true },
  { key: "owner", label: "المسؤول" },
  { key: "payment", label: "حالة الدفع" },
  { key: "created", label: "تاريخ الإنشاء", sortable: true, defaultHidden: true },
];
const sortMap: Record<string, string> = { name: "name", value: "value", probability: "probability", close: "expected_close_date", created: "created_at" };

export default async function DealsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("deals.read");
  const params = await readParams(searchParams);
  const today = todayIn(bos.employee.timezone);
  const [{ stages }, staff, names, currencies, views, result, metrics] = await Promise.all([
    getPipeline("deal"),
    listActiveStaff(),
    userNameMap(),
    listCurrencies(),
    listSavedViews(bos, "deals"),
    listDeals(bos, scope, { ...params, sort: params.sort ? sortMap[params.sort] : undefined, page: pageOf(params) }),
    pipelineMetrics({ userIds: await scopeUserIds(bos, scope), from: params.closeFrom ?? startOfMonth(today), to: params.closeTo ?? today, currency: isCurrency(params.currency) ? params.currency : undefined }),
  ]);
  const base = metrics.currency;

  return (
    <>
      <PageHeader
        title="الصفقات"
       
        actions={<span className="bos-row" style={{ gap: 6 }}><ImportButton bos={bos} type="deals" />{
          <>
            <Link href="/admin/sales/pipeline" className="admin-btn secondary small">
              <Tx>عرض Kanban</Tx>
            </Link>
            {can(bos, "deals.create") ? (
              <Link href="/admin/sales/deals/new" className="admin-btn small">
                <Tx>+ صفقة</Tx>
              </Link>
            ) : null}
          </>
        }</span>}
      />

      <div className="bos-kpis">
        <KpiCard label="قيمة المسار" value={formatMoney(metrics.pipelineValue, base)} sub={<Tx vars={{ openCount: metrics.openCount }}>{"{openCount} صفقة مفتوحة"}</Tx>} />
        <KpiCard label="المسار الموزون" value={formatMoney(metrics.weightedPipeline, base)} />
        <KpiCard label="الإيراد المتوقع (الفترة)" value={formatMoney(metrics.expectedRevenue, base)} />
        <KpiCard label="المكسوب (الفترة)" value={formatMoney(metrics.wonRevenue, base)} sub={<Tx vars={{ wonCount: metrics.wonCount }}>{"{wonCount} صفقة"}</Tx>} />
        <KpiCard label="المفقود (الفترة)" value={formatMoney(metrics.lostRevenue, base)} sub={<Tx vars={{ lostCount: metrics.lostCount }}>{"{lostCount} صفقة"}</Tx>} />
        <KpiCard label="معدل التحويل" value={`${metrics.conversionRate}%`} sub="مكسوبة ÷ مؤهلة" />
      </div>
      {metrics.otherCurrencyCount ? <div className="bos-hint" style={{ marginTop: -8, marginBottom: 10 }}><Tx vars={{ n: metrics.otherCurrencyCount, currency: metrics.currency }}>{"الإجماليات بعملة {currency} فقط؛ {n} صفقة بالعملة الأخرى غير محسوبة."}</Tx></div> : null}

      <FilterBar
        searchPlaceholder="بحث باسم الصفقة أو رقمها..."
        filters={[
          { key: "status", label: "الحالة", type: "select", options: [{ value: "open", label: "مفتوحة" }, { value: "won", label: "مكسوبة" }, { value: "lost", label: "خاسرة" }] },
          { key: "stage", label: "المرحلة", type: "select", options: stages.map((s) => ({ value: s.id, label: s.name })) },
          ...(scope === "all" || scope === "team" ? [{ key: "assigned", label: "المسؤول", type: "select" as const, options: [{ value: "me", label: "أنا" }, ...staff.map((s) => ({ value: s.userId, label: s.name }))] }] : []),
          { key: "currency", label: "العملة", type: "select", options: currencies.map((c) => ({ value: c, label: c })) },
          { key: "upsell", label: "بيع إضافي", type: "select", options: [{ value: "1", label: "نعم" }] },
          { key: "closeFrom", label: "إغلاق من", type: "date" },
          { key: "closeTo", label: "إلى", type: "date" },
        ]}
      />

      <DataTable
        tableId="deals"
        columns={columns}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        exportHref={can(bos, "deals.export") ? "/api/bos/export/deals" : undefined}
        savedViews={views}
        onSaveView={saveViewAction.bind(null, "deals")}
        onDeleteView={deleteViewAction}
        bulkActions={can(bos, "deals.assign") ? [{ key: "assign", label: "تعيين", optionLabel: "المسؤول", options: staff.map((s) => ({ value: s.userId, label: s.name })), action: bulkAssignDealsAction }] : undefined}
        empty={
          <EmptyState
            title={Object.keys(params).length ? "لا توجد صفقات مطابقة" : "لا توجد صفقات بعد"}
            description="الصفقات تُنشأ من تحويل العملاء المحتملين المؤهلين أو مباشرة لحساب موجود."
            actions={can(bos, "deals.create") ? <Link href="/admin/sales/deals/new" className="admin-btn small"><Tx>صفقة جديدة</Tx></Link> : null}
          />
        }
        rows={result.rows.map((d) => {
          const stage = d.pipeline_stages as unknown as { name: string; category: string };
          const client = d.clients as unknown as { name: string; company_name: string | null } | null;
          return {
            id: d.id,
            cells: {
              name: (
                <Link href={`/admin/sales/deals/${d.id}`}>
                  {d.name}
                  <span className="cell-sub">
                    {d.deal_number}
                    {d.is_upsell ? " · بيع إضافي" : ""}
                  </span>
                </Link>
              ),
              client: client ? <Link href={`/admin/clients/${d.client_id}`}>{client.company_name ?? client.name}</Link> : "—",
              contact: (d.contacts as unknown as { full_name: string } | null)?.full_name ?? "—",
              value: <Money value={d.value} currency={d.currency} />,
              stage: <StatusBadge label={stage.name} tone={stage.category === "won" ? "success" : stage.category === "lost" ? "danger" : "info"} />,
              probability: `${d.probability}%`,
              weighted: stage.category === "open" ? <Money value={toDecimalString(percentOf(d.value, d.probability, d.currency), 2)} currency={d.currency} /> : "—",
              close: formatDate(d.expected_close_date),
              owner: d.assigned_to ? names.get(d.assigned_to) ?? "—" : "—",
              payment: <StatusBadge map="deal_payment_status" value={d.payment_status} />,
              created: formatDate(d.created_at),
            },
          };
        })}
      />
    </>
  );
}
