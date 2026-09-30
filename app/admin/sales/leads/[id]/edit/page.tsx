import { Tx } from "@/components/bos/I18n";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { getLead } from "@/services/bos/leads";
import { listActiveStaff, listCurrencies, listLeadSources, listProducts, listTeams } from "@/services/bos/shared";
import { PageHeader } from "@/components/bos/ui";
import { NotFoundError } from "@/lib/bos/errors";
import { LeadForm } from "../../LeadForm";
import { updateLeadAction } from "../../actions";

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("leads.update");
  const { id } = await params;
  if (!(await canAccessEntity(bos, "lead", id, "update"))) notFound();
  const lead = await getLead(id).catch((error) => {
    if (error instanceof NotFoundError) return null;
    throw error;
  });
  if (!lead) notFound();
  const [sources, products, staff, teams, currencies] = await Promise.all([listLeadSources(), listProducts(), listActiveStaff(), listTeams(), listCurrencies()]);

  return (
    <>
      <PageHeader
        title={<Tx vars={{ name: lead.name }}>{"تعديل: {name}"}</Tx>}
       
      />
      <LeadForm
        action={updateLeadAction.bind(null, id)}
        initial={{ ...lead, estimated_budget: lead.estimated_budget ?? "" }}
        sources={sources.map((s) => ({ value: s.id, label: s.name }))}
        products={products.map((p) => ({ value: p.id, label: p.name }))}
        staff={staff.map((s) => ({ value: s.userId, label: s.name }))}
        teams={teams.map((t) => ({ value: t.id, label: t.name }))}
        currencies={currencies}
        canAssign={can(bos, "leads.assign")}
        canAllowDuplicate={false}
      />
    </>
  );
}
