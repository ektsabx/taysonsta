import { RecordDocuments } from "@/components/bos/RecordDocuments";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { listCurrencies } from "@/services/bos/shared";
import { PageHeader, Summary, Card, StatusBadge, Money, Tabs } from "@/components/bos/ui";
import { ActivityTimeline } from "@/components/bos/ActivityTimeline";
import { AuditLogPanel } from "@/components/bos/AuditLogPanel";
import { ApprovalPanel } from "@/components/bos/ApprovalPanel";
import { ActionButton, ConfirmButton } from "@/components/bos/Dialog";
import { formatDate, todayIn } from "@/lib/bos/format";
import { statusLabel } from "@/lib/bos/labels";
import { PaymentForm } from "../../payments/PaymentForm";
import { InvoiceForm } from "../InvoiceForm";
import { cancelInvoiceAction, sendInvoiceAction, updateInvoiceAction } from "../../actions";

const tabs = [
  { key: "overview", label: "الفاتورة" },
  { key: "payment", label: "تسجيل دفعة" },
  { key: "edit", label: "تعديل" },
  { key: "approvals", label: "الموافقات" },
  { key: "timeline", label: "السجل الزمني" },
  { key: "audit", label: "سجل التدقيق" },
];

export default async function InvoiceDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { bos } = await requirePermission("invoices.read");
  const { id } = await params;
  const sp = await readParams(searchParams);
  const tab = tabs.some((t) => t.key === sp.tab) ? sp.tab : "overview";
  if (!(await canAccessEntity(bos, "invoice", id))) notFound();

  const { data: inv, error } = await db()
    .from("invoices")
    .select("*, clients(id, name, company_name, email), projects(id, name, project_number), deals(id, name, deal_number), payment_schedules!invoices_schedule_id_fkey(label, percent)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!inv) notFound();
  const [{ data: items }, { data: payments }, currencies] = await Promise.all([
    db().from("invoice_items").select("*").eq("invoice_id", id).order("sort_order"),
    db().from("payments").select("id, payment_number, amount, currency, invoice_amount, method, payment_date, status, reference, refunded_amount").eq("invoice_id", id).order("payment_date"),
    listCurrencies(),
  ]);
  const client = inv.clients as unknown as { id: string; name: string; company_name: string | null } | null;
  const project = inv.projects as unknown as { id: string; name: string; project_number: string } | null;
  const deal = inv.deals as unknown as { id: string; name: string; deal_number: string } | null;
  const schedule = inv.payment_schedules as unknown as { label: string; percent: number } | null;
  const canUpdate = can(bos, "invoices.update") && (await canAccessEntity(bos, "invoice", id, "update"));
  const editable = canUpdate && ["draft", "sent", "overdue"].includes(inv.status) && Number(inv.amount_paid) === 0;
  const payable = can(bos, "payments.create") && ["draft", "sent", "partially_paid", "overdue"].includes(inv.status) && Number(inv.balance) > 0;
  const netPaid = Number(inv.amount_paid) - Number(inv.amount_refunded);

  return (
    <>
      <PageHeader
        title={<Tx vars={{ invoice_number: inv.invoice_number }}>{"فاتورة {invoice_number}"}</Tx>}
        subtitle={<StatusBadge map="invoice_status" value={inv.status} />}
        breadcrumbs={[{ label: "المالية" }, { label: "الفواتير", href: "/admin/finance/invoices" }, { label: inv.invoice_number }]}
        actions={
          <>
            <Link href={`/admin/finance/invoices/${id}/print`} className="admin-btn small secondary" target="_blank">
              <Tx>عرض للطباعة / PDF</Tx>
            </Link>
            {canUpdate && inv.status === "draft" ? <ActionButton label="إرسال الفاتورة" className="admin-btn small" action={sendInvoiceAction.bind(null, id)} /> : null}
            {payable ? <Link href={`/admin/finance/invoices/${id}?tab=payment`} className="admin-btn small success"><Tx>تسجيل دفعة</Tx></Link> : null}
            {can(bos, "invoices.delete") && !["paid", "cancelled"].includes(inv.status) ? (
              <ConfirmButton label="إلغاء" className="admin-btn small danger" message="إلغاء الفاتورة؟ لا يمكن إلغاء فاتورة عليها مدفوعات." requireReason action={(reason) => cancelInvoiceAction(id, reason)} />
            ) : null}
          </>
        }
      />
      <Summary
        items={[
          { label: "الحساب", value: client ? <Link href={`/admin/clients/${client.id}`}>{client.company_name ?? client.name}</Link> : "—" },
          { label: "الصفقة", value: deal ? <Link href={`/admin/sales/deals/${deal.id}`}>{deal.deal_number}</Link> : "—" },
          { label: "المشروع", value: project ? <Link href={`/admin/projects/${project.id}`}>{project.project_number}</Link> : "—" },
          { label: "الإجمالي", value: <Money value={inv.total} currency={inv.currency} /> },
          { label: "المدفوع", value: <Money value={netPaid} currency={inv.currency} /> },
          { label: "المتبقي", value: <Money value={inv.balance} currency={inv.currency} /> },
          { label: "الاستحقاق", value: formatDate(inv.due_date) },
        ]}
      />
      <Tabs
        tabs={tabs.map((t) => (t.key === "payment" ? { ...t, hidden: !payable } : t.key === "edit" ? { ...t, hidden: !editable } : t.key === "audit" ? { ...t, hidden: !can(bos, "audit.read") } : t))}
        active={tab}
        baseHref={`/admin/finance/invoices/${id}`}
      />

      {tab === "overview" ? (
        <div className="bos-grid main-side">
          <div>
            <Card title="البنود">
              <table className="bos-table responsive">
                <thead>
                  <tr>
                    <th><Tx>الوصف</Tx></th>
                    <th><Tx>الكمية</Tx></th>
                    <th><Tx>سعر الوحدة</Tx></th>
                    <th style={{ textAlign: "end" }}><Tx>الإجمالي</Tx></th>
                  </tr>
                </thead>
                <tbody>
                  {(items ?? []).map((it) => (
                    <tr key={it.id}>
                      <td className="cell-primary cell-primary-mobile" data-label="الوصف"><Tx>{it.description}</Tx></td>
                      <td data-label="الكمية"><Tx>{it.quantity}</Tx></td>
                      <td data-label="سعر الوحدة"><Money value={it.unit_price} currency={inv.currency} /></td>
                      <td data-label="الإجمالي" style={{ textAlign: "end" }}><Money value={it.line_total} currency={inv.currency} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="bos-divider" />
              <div className="bos-stack" style={{ alignItems: "flex-end", fontSize: 13 }}>
                <div><Tx>المجموع:</Tx> <Money value={inv.subtotal} currency={inv.currency} /></div>
                {Number(inv.discount_amount) > 0 ? <div><Tx>الخصم: -</Tx><Money value={inv.discount_amount} currency={inv.currency} /></div> : null}
                {Number(inv.tax_rate) > 0 ? <div><Tx vars={{ tax_rate: inv.tax_rate }}>{"الضريبة ({tax_rate}%):"}</Tx> <Money value={inv.tax_amount} currency={inv.currency} /></div> : null}
                <div style={{ fontSize: 15, fontWeight: 800 }}><Tx>الإجمالي:</Tx> <Money value={inv.total} currency={inv.currency} /></div>
              </div>
            </Card>
            <Card title="المدفوعات">
              {(payments ?? []).length ? (
                <table className="bos-table responsive">
                  <thead>
                    <tr>
                      <th><Tx>الدفعة</Tx></th>
                      <th><Tx>التاريخ</Tx></th>
                      <th><Tx>الطريقة</Tx></th>
                      <th><Tx>المبلغ</Tx></th>
                      <th><Tx>المسترد</Tx></th>
                      <th><Tx>الحالة</Tx></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(payments ?? []).map((p) => (
                      <tr key={p.id}>
                        <td className="cell-primary cell-primary-mobile" data-label="الدفعة"><Link href={`/admin/finance/payments/${p.id}`}>{p.payment_number}</Link>{p.reference ? <span className="cell-sub"><Tx>{p.reference}</Tx></span> : null}</td>
                        <td data-label="التاريخ">{formatDate(p.payment_date)}</td>
                        <td data-label="الطريقة">{statusLabel("payment_method", p.method)}</td>
                        <td data-label="المبلغ"><Money value={p.amount} currency={p.currency} /></td>
                        <td data-label="المسترد">{Number(p.refunded_amount) > 0 ? <Money value={p.refunded_amount} currency={p.currency} /> : "—"}</td>
                        <td data-label="الحالة"><StatusBadge map="payment_status" value={p.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="bos-faint" style={{ fontSize: 13 }}><Tx>لا توجد مدفوعات بعد.</Tx></div>
              )}
            </Card>
          </div>
          <div>
            <Card title="التفاصيل">
              <div className="bos-kv">
                <div className="bos-kv-item"><div className="bos-kv-label"><Tx>الإصدار</Tx></div><div className="bos-kv-value">{formatDate(inv.issue_date)}</div></div>
                <div className="bos-kv-item"><div className="bos-kv-label"><Tx>أُرسلت</Tx></div><div className="bos-kv-value">{formatDate(inv.sent_at)}</div></div>
                <div className="bos-kv-item"><div className="bos-kv-label"><Tx>سُددت</Tx></div><div className="bos-kv-value">{formatDate(inv.paid_at)}</div></div>
                <div className="bos-kv-item"><div className="bos-kv-label"><Tx>جدول الدفعات</Tx></div><div className="bos-kv-value">{schedule ? `${schedule.label} (${schedule.percent}%)` : "—"}</div></div>
              </div>
              {inv.payment_terms ? <><div className="bos-divider" /><div className="bos-kv-label"><Tx>شروط الدفع</Tx></div><div className="bos-prose"><Tx>{inv.payment_terms}</Tx></div></> : null}
              {inv.notes ? <><div className="bos-divider" /><div className="bos-kv-label"><Tx>ملاحظات</Tx></div><div className="bos-prose">{inv.notes}</div></> : null}
            </Card>
            <Card title="آخر الأحداث">
              <ActivityTimeline entityType="invoice" entityId={id} limit={8} />
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "payment" && payable ? (
        <PaymentForm
          currencies={currencies}
          today={todayIn(bos.employee.timezone)}
          initialClient={client ? { id: client.id, label: client.company_name ?? client.name } : null}
          preselectedInvoiceId={id}
          openInvoices={[{ id, number: inv.invoice_number, currency: inv.currency, balance: String(inv.balance), client_id: inv.client_id, deal_id: inv.deal_id, project_id: inv.project_id }]}
        />
      ) : null}

      {tab === "edit" && editable ? (
        <InvoiceForm
          action={updateInvoiceAction.bind(null, id)}
          currencies={currencies}
          initialClient={client ? { id: client.id, label: client.company_name ?? client.name } : null}
          initialDeal={deal ? { id: deal.id, label: deal.name, sub: deal.deal_number } : null}
          initialProject={project ? { id: project.id, label: project.name, sub: project.project_number } : null}
          initial={{
            currency: inv.currency,
            issue_date: inv.issue_date,
            due_date: inv.due_date,
            discount_amount: String(inv.discount_amount),
            tax_rate: String(inv.tax_rate),
            payment_terms: inv.payment_terms,
            notes: inv.notes,
            items: (items ?? []).map((it) => ({ description: it.description, product_id: it.product_id, quantity: String(it.quantity), unit_price: String(it.unit_price) })),
          }}
        />
      ) : null}

      {tab === "approvals" ? (
        <Card title="الموافقات">
          <ApprovalPanel entityType="invoice" entityId={id} bos={bos} />
        </Card>
      ) : null}
      {tab === "timeline" ? (
        <Card title="السجل الزمني">
          <ActivityTimeline entityType="invoice" entityId={id} limit={200} />
        </Card>
      ) : null}
      {tab === "audit" && can(bos, "audit.read") ? (
        <Card title="سجل التدقيق">
          <AuditLogPanel entityType="invoice" entityId={id} />
        </Card>
      ) : null}
      {tab === "overview" ? <RecordDocuments bos={bos} entityType="invoice" entityId={id} /> : null}
    </>
  );
}
