import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { listActiveStaff } from "@/services/bos/shared";
import { PageHeader } from "@/components/bos/ui";
import { TaskForm } from "../TaskForm";
import { createTaskAction } from "../../actions";

export default async function NewTaskPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("tasks.create");
  const sp = await readParams(searchParams);
  const staff = await listActiveStaff();
  let initialProject = null;
  let milestonesByProject: Record<string, { value: string; label: string }[]> = {};
  if (sp.projectId) {
    const { data } = await db().from("projects").select("id, name, project_number").eq("id", sp.projectId).maybeSingle();
    if (data) initialProject = { id: data.id, label: data.name, sub: data.project_number };
  }
  const { data: ms } = await db().from("milestones").select("id, name, project_id").neq("status", "completed").order("sort_order").limit(2000);
  for (const m of ms ?? []) (milestonesByProject[m.project_id] ??= []).push({ value: m.id, label: m.name });
  milestonesByProject = { ...milestonesByProject };
  return (
    <>
      <PageHeader title="مهمة جديدة" breadcrumbs={[{ label: "المهام", href: "/admin/projects/tasks" }, { label: "جديدة" }]} />
      <TaskForm
        action={createTaskAction}
        staff={staff.map((s) => ({ value: s.userId, label: s.name }))}
        milestonesByProject={milestonesByProject}
        initialProject={initialProject}
        initial={{ assigned_to: bos.userId }}
        hidden={{ parent_task_id: sp.parentId, deal_id: sp.dealId, lead_id: sp.leadId, client_id: sp.clientId }}
        canAssign={can(bos, "tasks.assign") || can(bos, "projects.assign")}
        submitLabel="إنشاء المهمة"
      />
    </>
  );
}
