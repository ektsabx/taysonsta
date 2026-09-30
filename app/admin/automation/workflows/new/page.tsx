import { requirePermission } from "@/lib/bos/auth";
import { listActiveStaff, listRoles } from "@/services/bos/shared";
import { PageHeader } from "@/components/bos/ui";
import { WorkflowBuilder } from "../../WorkflowBuilder";

export default async function NewWorkflowPage() {
  await requirePermission("automation.manage");
  const [staff, roles] = await Promise.all([listActiveStaff(), listRoles()]);
  return (
    <>
      <PageHeader title="مسار عمل جديد" breadcrumbs={[{ label: "الأتمتة" }, { label: "مسارات العمل", href: "/admin/automation/workflows" }, { label: "جديد" }]} />
      <WorkflowBuilder
        canEdit
        staff={staff.map((s) => ({ value: s.userId, label: s.name }))}
        roles={roles.filter((r) => !r.is_client_role).map((r) => ({ value: r.key, label: r.name }))}
        initial={{ name: "", description: null, trigger_event: "deal.won", conditions: [], condition_logic: "all", actions: [{ type: "notify", params: { recipients: [{ kind: "relation", value: "assignee" }] } }], is_active: false, run_once_per_entity: false, priority: 0 }}
      />
    </>
  );
}
