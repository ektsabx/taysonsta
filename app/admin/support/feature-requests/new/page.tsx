import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { listCurrencies } from "@/services/bos/shared";
import { PageHeader, Card } from "@/components/bos/ui";
import { FeatureForm } from "../../SupportControls";

export default async function NewFeaturePage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("feature_requests.create");
  const sp = await readParams(searchParams);
  const [currencies, client] = await Promise.all([listCurrencies(), sp.clientId ? db().from("clients").select("id, name, company_name").eq("id", sp.clientId).maybeSingle().then((r) => r.data) : Promise.resolve(null)]);
  return (
    <>
      <PageHeader title="طلب ميزة جديد" breadcrumbs={[{ label: "الدعم" }, { label: "طلبات الميزات", href: "/admin/support/feature-requests" }, { label: "جديد" }]} />
      <Card><FeatureForm currencies={currencies} clientInit={client ? { id: client.id, label: client.company_name ?? client.name } : null} /></Card>
    </>
  );
}
