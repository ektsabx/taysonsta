import { requirePermission, can } from "@/lib/bos/auth";
import { listActiveStaff, listCurrencies, listLeadSources, listProducts, listTeams } from "@/services/bos/shared";
import { defaultCurrencyFor } from "@/lib/bos/branch";
import { PageHeader } from "@/components/bos/ui";
import { LeadForm } from "../LeadForm";
import { createLeadAction } from "../actions";

export default async function NewLeadPage() {
  const { bos } = await requirePermission("leads.create");
  const [sources, products, staff, teams, currencies] = await Promise.all([listLeadSources(), listProducts(), listActiveStaff(), listTeams(), listCurrencies()]);
  const currency = await defaultCurrencyFor(bos);

  return (
    <>
      <PageHeader title="عميل محتمل جديد" breadcrumbs={[{ label: "المبيعات" }, { label: "العملاء المحتملون", href: "/admin/sales/leads" }, { label: "جديد" }]} />
      <LeadForm
        action={createLeadAction}
        sources={sources.filter((s) => s.is_active).map((s) => ({ value: s.id, label: s.name }))}
        products={products.filter((p) => p.is_active).map((p) => ({ value: p.id, label: p.name }))}
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
