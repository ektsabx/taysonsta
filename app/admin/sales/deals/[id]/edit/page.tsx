import { Tx } from "@/components/bos/I18n";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { NotFoundError } from "@/lib/bos/errors";
import { getDeal } from "@/services/bos/deals";
import { listActiveStaff, listCurrencies, listLeadSources } from "@/services/bos/shared";
import { PageHeader } from "@/components/bos/ui";
import { DealForm, type TermRow } from "../../DealForm";
import { updateDealAction } from "../../actions";

export default async function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("deals.update");
  const { id } = await params;
  if (!(await canAccessEntity(bos, "deal", id, "update"))) notFound();
  const deal = await getDeal(id).catch((e) => {
    if (e instanceof NotFoundError) return null;
    throw e;
  });
  if (!deal) notFound();
  const [sources, staff, currencies] = await Promise.all([listLeadSources(), listActiveStaff(), listCurrencies()]);
  const client = deal.clients as unknown as { id: string; name: string; company_name: string | null } | null;
  const contact = deal.contacts as unknown as { id: string; full_name: string } | null;

  return (
    <>
      <PageHeader title={<Tx vars={{ name: deal.name }}>{"تعديل: {name}"}</Tx>} />
      <DealForm
        action={updateDealAction.bind(null, id)}
        initialClient={client ? { id: client.id, label: client.company_name ?? client.name } : null}
        initialContact={contact ? { id: contact.id, label: contact.full_name } : null}
        initial={{
          name: deal.name,
          value: deal.value,
          currency: deal.currency,
          probability: deal.probability,
          expected_close_date: deal.expected_close_date,
          assigned_to: deal.assigned_to,
          source_id: deal.source_id,
          scope: deal.scope,
          notes: deal.notes,
          payment_terms: (deal.payment_terms as unknown as TermRow[]).map((t) => ({ ...t, percent: String(t.percent), due_offset_days: Number(t.due_offset_days ?? 0), trigger: t.trigger ?? "on_date" })),
        }}
        sources={sources.map((s) => ({ value: s.id, label: s.name }))}
        staff={staff.map((s) => ({ value: s.userId, label: s.name }))}
        currencies={currencies}
        canAssign={can(bos, "deals.assign")}
      />
    </>
  );
}
