import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { listCurrencies } from "@/services/bos/shared";
import { formatMoney } from "@/lib/bos/money";
import { defaultCurrencyFor } from "@/lib/bos/branch";
import { PageHeader } from "@/components/bos/ui";
import { ContractForm } from "../ContractForm";
import { createContractAction } from "../actions";

// New contract pre-filled from the deal (and accepted proposal): account,
// value, currency and payment terms — no re-entry (§3).
export default async function NewContractPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("contracts.create");
  const sp = await readParams(searchParams);
  const currencies = await listCurrencies();
  let initialClient = null;
  let initialDeal = null;
  let initial: { title?: string; value?: string; currency?: string; payment_terms?: string | null } = { currency: await defaultCurrencyFor(bos) };

  if (sp.dealId) {
    const { data: deal } = await db().from("deals").select("id, name, deal_number, value, currency, client_id, payment_terms, clients(id, name, company_name)").eq("id", sp.dealId).maybeSingle();
    if (deal) {
      const client = deal.clients as unknown as { id: string; name: string; company_name: string | null };
      initialClient = { id: client.id, label: client.company_name ?? client.name };
      initialDeal = { id: deal.id, label: deal.name, sub: deal.deal_number };
      const terms = (deal.payment_terms as unknown as { label: string; percent: number | string }[]) ?? [];
      initial = {
        title: `${deal.name} — Service Agreement`,
        value: String(deal.value),
        currency: deal.currency,
        payment_terms: terms.map((t) => `${t.label}: ${t.percent}%`).join("\n") || null,
      };
    }
  }
  if (sp.proposalId) {
    const { data: proposal } = await db().from("proposals").select("total_amount, currency, payment_schedule, title").eq("id", sp.proposalId).maybeSingle();
    if (proposal?.total_amount) {
      const schedule = (proposal.payment_schedule as unknown as { label: string; percent: string; amount: string }[]) ?? [];
      initial = {
        ...initial,
        value: String(proposal.total_amount),
        currency: proposal.currency ?? initial.currency,
        payment_terms: schedule.map((s) => `${s.label}: ${s.percent}% (${formatMoney(s.amount, proposal.currency)})`).join("\n") || initial.payment_terms,
      };
    }
  }

  return (
    <>
      <PageHeader title="عقد جديد" breadcrumbs={[{ label: "العقود", href: "/admin/sales/contracts" }, { label: "جديد" }]} />
      <ContractForm action={createContractAction} currencies={currencies} initial={initial} initialClient={initialClient} initialDeal={initialDeal} proposalId={sp.proposalId} submitLabel="إنشاء العقد" />
    </>
  );
}
