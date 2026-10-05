import { requirePermission, can } from "@/lib/bos/auth";
import { listActiveStaff, listCurrencies, listLeadSources, listTeams } from "@/services/bos/shared";
import { defaultCurrency } from "@/lib/bos/company-currency";
import { PageHeader } from "@/components/bos/ui";
import { LeadForm } from "../LeadForm";
import { createLeadAction } from "../actions";

export default async function NewLeadPage() {
  const { bos } = await requirePermission("leads.create");
  const [sources, staff, teams, currencies] = await Promise.all([listLeadSources(), listActiveStaff(), listTeams(), listCurrencies()]);
  const currency = await defaultCurrency();

  return (
    <>
      <PageHeader title="عميل محتمل جديد" />
      <LeadForm
        action={createLeadAction}
        sources={sources.filter((s) => s.is_active).map((s) => ({ value: s.id, label: s.name }))}
        staff={staff.map((s) => ({ value: s.userId, label: s.name }))}
        teams={teams.map((t) => ({ value: t.id, label: t.name }))}
        currencies={currencies}
        canAssign={can(bos, "leads.assign")}
        canAllowDuplicate={can(bos, "leads.manage")}
        initial={{ assigned_to: can(bos, "leads.assign") ? "" : bos.userId, budget_currency: currency }}
        submitLabel="إنشاء العميل المحتمل"
      />
    </>
  );
}
