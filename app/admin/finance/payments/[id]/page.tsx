import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { db } from "@/lib/bos/db";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, Summary, Card, StatusBadge, Money, KeyValues } from "@/components/bos/ui";
import { ActivityTimeline } from "@/components/bos/ActivityTimeline";
import { AuditLogPanel } from "@/components/bos/AuditLogPanel";
import { formatDate, formatDateTime } from "@/lib/bos/format";
import { statusLabel } from "@/lib/bos/labels";
import { PaymentControls } from "./PaymentControls";

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("payments.read");
  const { id } = await params;
  if (!(await canAccessEntity(bos, "payment", id))) notFound();
  const { data: p, error } = await db().from("payments").select("*, clients(id, name, company_name), invoices(id, invoice_number, currency), deals(id, deal_number)").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!p) notFound();
  const names = await userNameMap();
  const client = p.clients as unknown as { id: string; name: string; company_name: string | null } | null;
  const inv = p.invoices as unknown as { id: string; invoice_number: string; currency: string } | null;
  const deal = p.deals as unknown as { id: string; deal_number: string } | null;
  const refundable = Number(p.amount) - Number(p.refunded_amount);

  return (
    <>
      <PageHeader
        title={<Tx vars={{ payment_number: p.payment_number }}>{"دفعة {payment_number}"}</Tx>}
        subtitle={<StatusBadge map="payment_status" value={p.status} />}
       
        actions={can(bos, "payments.update") ? <PaymentControls paymentId={id} status={p.status} refundable={refundable} currency={p.currency} /> : null}
      />
      <Summary
        items={[
          { label: "المبلغ", value: <Money value={p.amount} currency={p.currency} /> },
          { label: "المسترد", value: <Money value={p.refunded_amount} currency={p.currency} /> },
          { label: "التاريخ", value: formatDate(p.payment_date) },
          { label: "الطريقة", value: statusLabel("payment_method", p.method) },
          { label: "الحساب", value: client ? <Link href={`/admin/clients/${client.id}`}>{client.company_name ?? client.name}</Link> : "—" },
          { label: "الفاتورة", value: inv ? <Link href={`/admin/finance/invoices/${inv.id}`}>{inv.invoice_number}</Link> : "—" },
        ]}
      />
      <div className="bos-grid main-side">
        <div>
          <Card title="التفاصيل">
            <KeyValues
              items={[
                { label: "المرجع", value: p.reference },
                { label: "المبلغ بعملة الفاتورة", value: p.invoice_amount && inv ? <Money value={p.invoice_amount} currency={inv.currency} /> : null },
                { label: "الصفقة", value: deal ? <Link className="bos-link" href={`/admin/sales/deals/${deal.id}`}>{deal.deal_number}</Link> : null },
                { label: "سجّلها", value: p.created_by ? names.get(p.created_by) : null },
                { label: "وقت التسجيل", value: formatDateTime(p.created_at) },
                { label: "سبب الاسترداد", value: p.refund_reason, hidden: !p.refund_reason },
              ]}
            />
            {p.notes ? <><div className="bos-divider" /><div className="bos-prose">{p.notes}</div></> : null}
          </Card>
          {can(bos, "audit.read") ? (
            <Card title="سجل التدقيق">
              <AuditLogPanel entityType="payment" entityId={id} />
            </Card>
          ) : null}
        </div>
        <Card title="السجل الزمني">
          <ActivityTimeline entityType="payment" entityId={id} />
        </Card>
      </div>
    </>
  );
}
