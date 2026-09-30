import { requirePermission } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { listApps } from "@/services/bos/it-access";
import { peopleEmployeeIds } from "@/services/bos/team-scope";
import { PageHeader, Card } from "@/components/bos/ui";
import { AccessRequestForm } from "./AccessRequestForm";

// Request additional access (IT §8): employee for self, manager for reports.
export default async function NewAccessRequestPage() {
  const { bos } = await requirePermission("access.create");
  const ids = await peopleEmployeeIds(bos, "access.create");
  let q = db().from("employees").select("id, full_name").is("archived_at", null).not("lifecycle_status", "in", "(suspended,offboarding,archived)").order("full_name");
  if (ids) q = q.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const [{ data: emps }, apps] = await Promise.all([q, listApps(false)]);
  return (
    <>
      <PageHeader title="طلب وصول إضافي" />
      <Card>
        <AccessRequestForm employees={(emps ?? []).map((e) => ({ value: e.id, label: e.full_name }))} defaultEmployee={bos.employee.id} apps={apps.map((a) => ({ id: a.id, name: a.name, access_levels: a.access_levels, is_sensitive: a.is_sensitive }))} />
      </Card>
    </>
  );
}
