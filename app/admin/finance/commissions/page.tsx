import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { listCommissions } from "@/services/bos/finance-queries";
import { listActiveStaff, userNameMap } from "@/services/bos/shared";
import { PageHeader, StatusBadge, EmptyState, Money } from "@/components/bos/ui";
import { DataTable, type DataColumn } from "@/components/bos/DataTable";
import { FilterBar } from "@/components/bos/FilterBar";
import { statusLabel, statusOptions } from "@/lib/bos/labels";
import { formatDate } from "@/lib/bos/format";
import { bulkApproveCommissionsAction } from "../actions";
import { CommissionRowActions } from "./CommissionRowActions";

const columns: DataColumn[] = [
  { key: "deal", label: "الصفقة", primary: true, alwaysVisible: true },
  { key: "employee", label: "الموظف" },
  { key: "rule", label: "القاعدة / الاستحقاق" },
  { key: "amount", label: "العمولة", align: "end" },
  { key: "eligible", label: "المستحق حالياً", align: "end" },
  { key: "payment", label: "دفع العميل" },
  { key: "status", label: "الحالة" },
  { key: "dates", label: "التواريخ", defaultHidden: true },
  { key: "actions", label: "", align: "end", alwaysVisible: true },
];

export default async function CommissionsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("commissions.read");
  const params = await readParams(searchParams);
  const [result, names, staff] = await Promise.all([listCommissions(bos, scope, { ...params, page: pageOf(params) }), userNameMap(), listActiveStaff()]);
  const canApprove = can(bos, "commissions.approve");
  const canPay = can(bos, "commissions.manage");
  return (
    <>
      <PageHeader
        title="العمولات"
        subtitle="تُحسب تلقائياً حسب قواعد العمولة وتصبح مستحقة عند تحقق شرط القاعدة (توقيع، تحصيل، سداد كامل، دفعة مرحلة)."
       
        actions={can(bos, "settings.manage", "all") || can(bos, "commissions.manage", "all") ? <Link href="/admin/settings/company#sales-rules" className="admin-btn small secondary"><Tx>قواعد العمولة</Tx></Link> : null}
      />
      <FilterBar
        filters={[
          { key: "status", label: "الحالة", type: "select", options: statusOptions("commission_status") },
          ...(scope !== "own" && scope !== "assigned" ? [{ key: "user", label: "الموظف", type: "select" as const, options: staff.map((s) => ({ value: s.userId, label: s.name })) }] : []),
        ]}
      />
      <DataTable
        tableId="commissions"
        columns={columns}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        exportHref={can(bos, "commissions.export") ? "/api/bos/export/commissions" : undefined}
        bulkActions={canApprove ? [{ key: "approve", label: "اعتماد المستحقة", action: bulkApproveCommissionsAction, confirm: "اعتماد {n} عمولة مستحقة؟" }] : undefined}
        empty={<EmptyState title="لا توجد عمولات" description="تظهر العمولات بعد كسب الصفقات حسب القواعد المعتمدة." />}
        rows={result.rows.map((c) => {
          const deal = c.deals as unknown as { id: string; name: string; deal_number: string; payment_status: string } | null;
          const rule = c.commission_rules as unknown as { name: string; trigger: string } | null;
          return {
            id: c.id,
            cells: {
              deal: deal ? <Link href={`/admin/sales/deals/${deal.id}?tab=commission`}>{deal.name}<span className="cell-sub">{deal.deal_number}</span></Link> : "—",
              employee: names.get(c.user_id) ?? "—",
              rule: rule ? <span>{rule.name}<span className="cell-sub">{statusLabel("commission_trigger", rule.trigger)}</span></span> : "—",
              amount: <Money value={c.amount} currency={c.currency} />,
              eligible: <Money value={c.eligible_amount} currency={c.currency} />,
              payment: deal ? <StatusBadge map="deal_payment_status" value={deal.payment_status} /> : "—",
              status: <StatusBadge map="commission_status" value={c.status} />,
              dates: <span className="bos-faint" style={{ fontSize: 11.5 }}><Tx vars={{ v: formatDate(c.eligible_at), v2: formatDate(c.approved_at), v3: formatDate(c.paid_at) }}>{"مستحقة {v} · معتمدة {v2} · مدفوعة {v3}"}</Tx></span>,
              actions: <CommissionRowActions id={c.id} status={c.status} canApprove={canApprove} canPay={canPay} />,
            },
          };
        })}
      />
    </>
  );
}
