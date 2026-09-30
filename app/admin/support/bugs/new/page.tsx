import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { staffWithRole } from "@/services/bos/shared";
import { PageHeader, Card } from "@/components/bos/ui";
import { BugForm } from "../../SupportControls";

export default async function NewBugPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("bugs.create");
  const sp = await readParams(searchParams);
  const [devs, project] = await Promise.all([staffWithRole("developer"), sp.projectId ? db().from("projects").select("id, name, project_number").eq("id", sp.projectId).maybeSingle().then((r) => r.data) : Promise.resolve(null)]);
  return (
    <>
      <PageHeader title="خطأ برمجي جديد" breadcrumbs={[{ label: "الدعم" }, { label: "الأخطاء البرمجية", href: "/admin/support/bugs" }, { label: "جديد" }]} />
      <Card><BugForm developers={devs.map((d) => ({ value: d.userId, label: d.name }))} projectInit={project ? { id: project.id, label: project.name, sub: project.project_number } : null} /></Card>
    </>
  );
}
