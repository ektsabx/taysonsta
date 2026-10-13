import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card, KeyValues, StatusBadge, EmptyState } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { NotConnected, connected } from "@/components/yolias/PlatformUi";
import { getPayout } from "@/services/yolias/affiliates";
import { PayoutForm } from "../../AffiliateForms";
import { cents, commissionKindLabel, commissionStatusLabel, commissionStatusTone, eventLabel, payoutStatusLabel, payoutStatusTone } from "../../labels";

export default async function AffiliatePayoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("affiliates.read");
  if (!connected()) return (<><PageHeader title="طلب سحب" /><NotConnected /></>);
  const { id } = await params;
  const found = await getPayout(id, { sensitive: can(bos, "affiliates.view_sensitive") });
  if (!found) notFound();
  const { payout: p, affiliate, commissions, events } = found;
  const sum = commissions.reduce((s, c) => s + Number(c.amount_cents), 0);
  return (
    <>
      <PageHeader
        title="طلب سحب"
        subtitle={<StatusBadge tone={payoutStatusTone[p.status]} label={payoutStatusLabel[p.status]} />}
        actions={<Link className="admin-btn secondary small" href="/admin/affiliates/payouts"><Tx>كل الطلبات</Tx></Link>}
      />
      <Card title="الطلب">
        <KeyValues items={[
          { label: "المسوّق", value: affiliate ? <Link className="bos-link" dir="ltr" href={`/admin/affiliates/${p.affiliate_id}`}>{affiliate.email}</Link> : "—" },
          { label: "المبلغ", value: <strong dir="ltr">{cents(p.amount_cents)} {p.currency}</strong> },
          { label: "مجموع العمولات المرتبطة", value: <span dir="ltr">{cents(sum)}</span> },
          { label: "الطريقة", value: p.method },
          { label: "بيانات السحب وقت الطلب", value: <span dir="auto" style={{ whiteSpace: "pre-wrap" }}>{p.details_snapshot ?? "—"}</span> },
          { label: "تاريخ الطلب", value: formatDateTime(p.requested_at) },
          { label: "القرار", value: p.decided_at ? `${formatDateTime(p.decided_at)} · ${p.decided_by ?? ""}` : "—" },
          { label: "تسجيل الدفع", value: p.paid_at ? `${formatDateTime(p.paid_at)} · ${p.paid_by ?? ""}` : "—" },
          { label: "مرجع التحويل", value: <span dir="ltr">{p.reference ?? "—"}</span> },
          { label: "السبب", value: p.reason ?? "—", hidden: !p.reason },
          { label: "ملاحظة داخلية", value: p.admin_note ?? "—", hidden: !p.admin_note },
        ]} />
        {sum !== Number(p.amount_cents) ? <p className="bos-field-error"><Tx>مجموع العمولات لا يساوي مبلغ الطلب (عمولة عُكست أثناء الطلب). راجعها قبل الدفع.</Tx></p> : null}
      </Card>
      {can(bos, "affiliate_payouts.approve", "all") && ["requested", "approved", "processing"].includes(p.status) ? (
        <Card title="الإجراء">
          <PayoutForm id={p.id} status={p.status} />
        </Card>
      ) : null}
      <Card title="العمولات في هذا الطلب">
        {commissions.length ? (
          <div className="bos-table-scroll">
            <BosTable className="bos-table responsive">
              <thead><tr><th><Tx>التاريخ</Tx></th><th><Tx>النوع</Tx></th><th><Tx>المبلغ</Tx></th><th><Tx>الحالة</Tx></th></tr></thead>
              <tbody>
                {commissions.map((c) => (
                  <tr key={c.id}>
                    <td>{formatDateTime(c.created_at)}</td>
                    <td><Tx>{commissionKindLabel[c.kind]}</Tx></td>
                    <td dir="ltr">{cents(c.amount_cents)}</td>
                    <td><StatusBadge tone={commissionStatusTone[c.status]} label={commissionStatusLabel[c.status]} />{c.on_hold ? <span className="cell-sub"><Tx>قيد المراجعة</Tx></span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </BosTable>
          </div>
        ) : <EmptyState title="لا توجد عمولات مرتبطة" />}
      </Card>
      <Card title="سجل الإجراءات">
        {events.length ? (
          <ul className="aff-events">
            {events.map((e) => (
              <li key={e.id}>
                <span className="cell-sub" style={{ whiteSpace: "nowrap" }}>{formatDateTime(e.created_at)}</span>
                <span><Tx>{eventLabel[e.action] ?? e.action}</Tx></span>
                <span className="cell-sub" dir="ltr">{e.actor}</span>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="لا توجد إجراءات" />}
      </Card>
    </>
  );
}
