import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { listActiveStaff, listCurrencies, listLeadSources } from "@/services/bos/shared";
import { PageHeader } from "@/components/bos/ui";
import { DealForm } from "../DealForm";
import { createDealAction } from "../actions";

// Add Deal (§10). ?clientId= preselects an existing account (never create a
// duplicate — §100); ?fromDeal= prepares an upsell deal from a won deal (§85).
export default async function NewDealPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("deals.create");
  const sp = await readParams(searchParams);
  const [sources, staff, currencies] = await Promise.all([listLeadSources(), listActiveStaff(), listCurrencies()]);

  let initialClient = null;
  let hidden: Record<string, string | null> = {};
  let title = "صفقة جديدة";
  let initialName = "";
  let clientId = sp.clientId ?? null;

  if (sp.fromDeal) {
    const { data: deal } = await db().from("deals").select("id, name, client_id").eq("id", sp.fromDeal).not("won_at", "is", null).maybeSingle();
    if (deal) {
      clientId = deal.client_id;
      hidden = { is_upsell: "on", previous_deal_id: deal.id };
      title = "فرصة بيع إضافي";
      initialName = `${deal.name} — Phase 2`;
    }
  }
  if (clientId) {
    const { data: client } = await db().from("clients").select("id, name, company_name").eq("id", clientId).maybeSingle();
    if (client) initialClient = { id: client.id, label: client.company_name ?? client.name };
  }

  return (
    <>
      <PageHeader title={title} />
      <DealForm
        action={createDealAction}
        initialClient={initialClient}
        initial={{ name: initialName, currency: "USD", assigned_to: can(bos, "deals.assign") ? "" : bos.userId }}
        sources={sources.map((s) => ({ value: s.id, label: s.name }))}
        staff={staff.map((s) => ({ value: s.userId, label: s.name }))}
        currencies={currencies}
        canAssign={can(bos, "deals.assign")}
        submitLabel="إنشاء الصفقة"
        hidden={hidden}
      />
    </>
  );
}
