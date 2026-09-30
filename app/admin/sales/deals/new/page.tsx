import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { listActiveStaff, listCurrencies, listLeadSources, listProducts } from "@/services/bos/shared";
import { PageHeader } from "@/components/bos/ui";
import { DealForm } from "../DealForm";
import { createDealAction } from "../actions";

// Add Deal (§10). ?clientId= preselects an existing account (never create a
// duplicate — §100); ?fromProject= prepares an upsell deal (§85).
export default async function NewDealPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("deals.create");
  const sp = await readParams(searchParams);
  const [sources, products, staff, currencies] = await Promise.all([listLeadSources(), listProducts(), listActiveStaff(), listCurrencies()]);

  let initialClient = null;
  let hidden: Record<string, string | null> = {};
  let title = "صفقة جديدة";
  let initialName = "";
  let clientId = sp.clientId ?? null;

  if (sp.fromProject) {
    const { data: project } = await db().from("projects").select("id, name, client_id, deal_id").eq("id", sp.fromProject).maybeSingle();
    if (project) {
      clientId = project.client_id;
      hidden = { is_upsell: "on", previous_project_id: project.id, previous_deal_id: project.deal_id };
      title = "فرصة بيع إضافي";
      initialName = `${project.name} — Phase 2`;
    }
  }
  if (clientId) {
    const { data: client } = await db().from("clients").select("id, name, company_name").eq("id", clientId).maybeSingle();
    if (client) initialClient = { id: client.id, label: client.company_name ?? client.name };
  }

  return (
    <>
      <PageHeader title={title} breadcrumbs={[{ label: "المبيعات" }, { label: "الصفقات", href: "/admin/sales/deals" }, { label: "جديدة" }]} />
      <DealForm
        action={createDealAction}
        initialClient={initialClient}
        initial={{ name: initialName, currency: "USD", assigned_to: can(bos, "deals.assign") ? "" : bos.userId }}
        sources={sources.map((s) => ({ value: s.id, label: s.name }))}
        products={products.filter((p) => p.is_active).map((p) => ({ value: p.id, label: p.name, price: p.default_price ? String(p.default_price) : null, currency: p.currency }))}
        staff={staff.map((s) => ({ value: s.userId, label: s.name }))}
        currencies={currencies}
        canAssign={can(bos, "deals.assign")}
        submitLabel="إنشاء الصفقة"
        hidden={hidden}
      />
    </>
  );
}
