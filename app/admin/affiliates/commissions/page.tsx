import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { PageHeader, Card, EmptyState, StatusBadge } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { FilterBar } from "@/components/bos/FilterBar";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { NotConnected, connected, Pager, qsFor, num } from "@/components/yolias/PlatformUi";
import { listCommissions } from "@/services/yolias/affiliates";
import { CommissionForm } from "../AffiliateForms";
import { cents, commissionKindLabel, commissionStatusLabel, commissionStatusTone, riskFlagLabel } from "../labels";

export default async function AffiliateCommissionsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("affiliates.read");
  if (!connected()) return (<><PageHeader title="العمولات" /><NotConnected /></>);
  const sp = await readParams(searchParams);
  const page = pageOf(sp);
  const canEdit = can(bos, "affiliates.update", "all");
  const { rows, total, pages } = await listCommissions({ q: sp.q, status: sp.status, affiliate: sp.affiliate, held: sp.held, from: sp.from, to: sp.to, page });
  return (
    <>
      <PageHeader title="العمولات" subtitle={<Tx vars={{ n: num(total) }}>{"{n} قيد"}</Tx>} />
      <FilterBar
        searchPlaceholder="بحث ببريد المسوّق أو الكود"
        filters={[
          { key: "status", label: "الحالة", type: "select", options: Object.entries(commissionStatusLabel).map(([value, label]) => ({ value, label })) },
          { key: "held", label: "المراجعة", type: "select", options: [{ value: "1", label: "قيد المراجعة فقط" }] },
          { key: "from", label: "من", type: "date" },
          { key: "to", label: "إلى", type: "date" },
        ]}
      />
      <Card flush>
        {rows.length ? (
          <div className="bos-table-scroll">
            <BosTable className="bos-table responsive">
              <thead><tr><th><Tx>التاريخ</Tx></th><th><Tx>المسوّق</Tx></th><th><Tx>النوع</Tx></th><th><Tx>الدفعة</Tx></th><th><Tx>العمولة</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>تفاصيل الحساب</Tx></th>{canEdit ? <th /> : null}</tr></thead>
              <tbody>
                {rows.map((c) => {
                  const rule = (c.rule ?? {}) as { type?: string; percent_bps?: number; fixed_cents?: number };
                  return (
                    <tr key={c.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(c.created_at)}</td>
                      <td>{c.affiliate ? <Link className="bos-link" dir="ltr" href={`/admin/affiliates/${c.affiliate_id}`}>{c.affiliate.email}</Link> : "—"}</td>
                      <td><Tx>{commissionKindLabel[c.kind]}</Tx>{c.payment_seq ? <span className="cell-sub"><Tx vars={{ n: c.payment_seq }}>{"الدفعة رقم {n}"}</Tx></span> : null}</td>
                      <td dir="ltr">{c.base_cents ? cents(c.base_cents) : "—"}{c.payment_kind ? <span className="cell-sub">{c.payment_kind}</span> : null}</td>
                      <td dir="ltr">{cents(c.amount_cents)} USD</td>
                      <td>
                        <StatusBadge tone={commissionStatusTone[c.status]} label={commissionStatusLabel[c.status]} />
                        {c.on_hold ? <span className="cell-sub"><Tx>قيد المراجعة</Tx>: {c.hold_reasons.map((h) => riskFlagLabel[h] ?? h).join("، ")}</span> : null}
                        {c.reason ? <span className="cell-sub">{c.reason}</span> : null}
                      </td>
                      <td>
                        <span className="cell-sub" dir="ltr">{rule.type === "fixed" ? `fixed ${cents(rule.fixed_cents ?? 0)}` : rule.type ? `${(rule.percent_bps ?? 0) / 100}% of ${cents(c.base_cents)}` : "manual"}</span>
                        <span className="cell-sub"><Tx vars={{ v: c.program_version_id ?? "—", d: formatDateTime(c.available_at) }}>{"إصدار القواعد {v} · متاحة من {d}"}</Tx></span>
                      </td>
                      {canEdit ? <td><CommissionForm id={c.id} status={c.status} onHold={c.on_hold} /></td> : null}
                    </tr>
                  );
                })}
              </tbody>
            </BosTable>
          </div>
        ) : <EmptyState title="لا توجد عمولات" description="تُنشأ العمولة تلقائيًا من قاعدة البيانات عند اكتمال دفعة مؤكدة لعميل مُحال." />}
        <Pager page={page} pages={pages} href={qsFor("/admin/affiliates/commissions", sp)} />
      </Card>
    </>
  );
}
