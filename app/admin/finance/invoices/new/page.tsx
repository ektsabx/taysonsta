import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { listCurrencies } from "@/services/bos/shared";
import { getSetting } from "@/lib/bos/settings";
import { addDays, todayIn } from "@/lib/bos/format";
import { defaultCurrency } from "@/lib/bos/company-currency";
import { currencyForCountry, isCurrency } from "@/lib/bos/currency";
import { PageHeader } from "@/components/bos/ui";
import { InvoiceForm } from "../InvoiceForm";
import { createInvoiceAction } from "../../actions";

export default async function NewInvoicePage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("invoices.create");
  const sp = await readParams(searchParams);
  const [currencies, finance] = await Promise.all([listCurrencies(), getSetting("finance")]);
  const today = todayIn(bos.employee.timezone);

  let initialClient = null;
  let initialDeal = null;
  let currency = await defaultCurrency();
  if (sp.clientId) {
    const { data } = await db().from("clients").select("id, name, company_name, default_currency, country").eq("id", sp.clientId).maybeSingle();
    if (data) {
      initialClient = { id: data.id, label: data.company_name ?? data.name };
      currency = isCurrency(data.default_currency) ? data.default_currency : currencyForCountry(data.country);
    }
  }
  if (sp.dealId) {
    const { data } = await db().from("deals").select("id, name, deal_number, currency, client_id, clients(name, company_name)").eq("id", sp.dealId).maybeSingle();
    if (data) {
      initialDeal = { id: data.id, label: data.name, sub: data.deal_number };
      if (!initialClient) {
        const c = data.clients as unknown as { name: string; company_name: string | null };
        initialClient = { id: data.client_id, label: c.company_name ?? c.name };
      }
      if (isCurrency(data.currency)) currency = data.currency;
    }
  }

  return (
    <>
      <PageHeader title="فاتورة جديدة" />
      <InvoiceForm
        action={createInvoiceAction}
        currencies={currencies}
        initialClient={initialClient}
        initialDeal={initialDeal}
        initial={{ currency, issue_date: today, due_date: addDays(today, finance.default_payment_due_days) }}
        submitLabel="إنشاء الفاتورة (مسودة)"
      />
    </>
  );
}
