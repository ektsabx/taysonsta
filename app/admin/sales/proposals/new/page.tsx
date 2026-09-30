import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { PageHeader } from "@/components/bos/ui";
import { NewBosProposalForm } from "./NewBosProposalForm";

export default async function NewProposalPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("proposals.create");
  const sp = await readParams(searchParams);
  let deal = null;
  let client = null;
  if (sp.dealId) {
    const { data } = await db().from("deals").select("id, name, deal_number").eq("id", sp.dealId).maybeSingle();
    if (data) deal = { id: data.id, label: data.name, sub: data.deal_number };
  }
  if (sp.clientId) {
    const { data } = await db().from("clients").select("id, name, company_name").eq("id", sp.clientId).maybeSingle();
    if (data) client = { id: data.id, label: data.company_name ?? data.name };
  }
  return (
    <>
      <PageHeader title="مقترح جديد" breadcrumbs={[{ label: "المقترحات", href: "/admin/sales/proposals" }, { label: "جديد" }]} />
      <NewBosProposalForm initialDeal={deal} initialClient={client} />
    </>
  );
}
