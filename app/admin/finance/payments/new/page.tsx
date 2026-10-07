import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { listCurrencies } from "@/services/bos/shared";
import { todayIn } from "@/lib/bos/format";
import { PageHeader } from "@/components/bos/ui";
import { PaymentForm } from "../PaymentForm";

export default async function NewPaymentPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("payments.create");
  const sp = await readParams(searchParams);
  const [currencies, { data: open }] = await Promise.all([
    listCurrencies(),
    db().from("bos_invoices").select("id, invoice_number, currency, balance, client_id, deal_id").in("status", ["draft", "sent", "partially_paid", "overdue"]).gt("balance", 0).order("due_date").limit(500),
  ]);
  let initialClient = null;
  if (sp.clientId) {
    const { data } = await db().from("clients").select("id, name, company_name").eq("id", sp.clientId).maybeSingle();
    if (data) initialClient = { id: data.id, label: data.company_name ?? data.name };
  }
  return (
    <>
      <PageHeader title="تسجيل دفعة" />
      <PaymentForm
        currencies={currencies}
        today={todayIn(bos.employee.timezone)}
        initialClient={initialClient}
        preselectedInvoiceId={sp.invoiceId}
        openInvoices={(open ?? []).map((i) => ({ id: i.id, number: i.invoice_number, currency: i.currency, balance: String(i.balance), client_id: i.client_id, deal_id: i.deal_id }))}
      />
    </>
  );
}
