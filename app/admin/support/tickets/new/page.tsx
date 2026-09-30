import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { listActiveStaff } from "@/services/bos/shared";
import { PageHeader, Card } from "@/components/bos/ui";
import { TicketForm } from "../../SupportControls";
import { createTicketAction } from "../../actions";

export default async function NewTicketPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("tickets.create");
  const sp = await readParams(searchParams);
  const [staff, client] = await Promise.all([listActiveStaff(), sp.clientId ? db().from("clients").select("id, name, company_name, email").eq("id", sp.clientId).maybeSingle().then((r) => r.data) : Promise.resolve(null)]);
  return (
    <>
      <PageHeader title="تذكرة جديدة" />
      <Card>
        <TicketForm action={createTicketAction} clientInit={client ? { id: client.id, label: client.company_name ?? client.name, sub: client.email } : null} staff={staff.map((s) => ({ value: s.userId, label: s.name }))} canAssign={can(bos, "tickets.assign")} />
      </Card>
    </>
  );
}
