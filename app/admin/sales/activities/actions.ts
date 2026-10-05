"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { authorize, can, type BosUser } from "@/lib/bos/auth";
import { assertCanAccess, canAccessEntity } from "@/lib/bos/access";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { db } from "@/lib/bos/db";
import { archiveActivity, completeActivity, createActivity, setActivityStatus, communicationTypes, type ActivityInput } from "@/services/bos/activities";
import { changeLeadStage } from "@/services/bos/leads";
import { getPipeline } from "@/services/bos/shared";

const activitySchema = z.object({
  type: z.enum(["call", "email", "linkedin", "meeting", "follow_up", "task", "note", "internal", "client_communication"]),
  title: zf.required("العنوان", 300),
  description: zf.optionalText(10000),
  direction: z.preprocess((v) => (v === "" ? null : v), z.enum(["inbound", "outbound", "internal"]).nullable()),
  outcome: zf.optionalText(2000),
  lead_id: zf.optionalUuid(),
  deal_id: zf.optionalUuid(),
  client_id: zf.optionalUuid(),
  contact_id: zf.optionalUuid(),
  assigned_to: zf.optionalUuid(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).default("pending"),
  due_at: zf.optionalDateTime(),
  start_at: zf.optionalDateTime(),
  reminder_at: zf.optionalDateTime(),
});

const toIso = (v: string | null | undefined) => (v ? new Date(v).toISOString() : null);

// Forward-only lead stage progression from logged communications
// (docs/bos/05 workflow 2): outbound on "new" → contacted; inbound on
// new/contacted → replied.
async function progressLeadFromCommunication(bos: BosUser, leadId: string, direction: string | null) {
  const { data: lead } = await db().from("leads").select("stage_id, pipeline_stages!inner(key)").eq("id", leadId).maybeSingle();
  if (!lead) return;
  const current = (lead.pipeline_stages as unknown as { key: string }).key;
  const { stages } = await getPipeline("lead");
  const target =
    direction === "inbound" && ["new", "contacted"].includes(current)
      ? stages.find((s) => s.key === "replied")
      : direction === "outbound" && current === "new"
        ? stages.find((s) => s.key === "contacted")
        : null;
  if (!target) return;
  await changeLeadStage(bos, leadId, target.id, null);
}

export async function createActivityAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("createActivity", async () => {
    const { bos } = await authorize("activities.create");
    const v = parseForm(activitySchema, formData);
    const related: [string, string | null][] = [
      ["lead", v.lead_id],
      ["deal", v.deal_id],
      ["client", v.client_id],
      ["contact", v.contact_id],
    ];
    for (const [type, id] of related) if (id) await assertCanAccess(bos, type, id, "read");
    if (v.assigned_to && v.assigned_to !== bos.userId && !can(bos, "activities.assign") && !can(bos, "leads.assign")) {
      throw new ValidationError("لا يمكنك إسناد نشاط لموظف آخر.", { assigned_to: "غير مسموح" });
    }
    const input: ActivityInput = {
      type: v.type,
      title: v.title,
      description: v.description ?? null,
      direction: v.direction ?? (communicationTypes.includes(v.type) && v.type !== "note" ? "outbound" : null),
      outcome: v.outcome ?? null,
      lead_id: v.lead_id,
      deal_id: v.deal_id,
      client_id: v.client_id,
      contact_id: v.contact_id,
      assigned_to: v.assigned_to,
      priority: v.priority,
      status: v.status,
      due_at: toIso(v.due_at),
      start_at: toIso(v.start_at),
      reminder_at: toIso(v.reminder_at),
    };
    const activity = await createActivity(bos, input);
    if (activity.lead_id && activity.status === "completed" && ["call", "email", "linkedin", "client_communication"].includes(activity.type)) {
      await progressLeadFromCommunication(bos, activity.lead_id, activity.direction);
    }
    for (const [type, id] of related) if (id) revalidatePath(`/admin/${type === "lead" ? "sales/leads" : type === "deal" ? "sales/deals" : type === "client" ? "clients" : "contacts"}/${id}`);
    revalidatePath("/admin/sales/activities");
    return { ok: true, message: activity.status === "completed" ? "تم تسجيل النشاط" : "تمت جدولة النشاط" };
  }, "تعذر حفظ النشاط.");
}

async function loadOwned(id: string) {
  const { bos } = await authorize("activities.update");
  if (!(await canAccessEntity(bos, "activity", id, "update"))) {
    const { data } = await db().from("activities").select("lead_id, deal_id").eq("id", id).maybeSingle();
    const parent = data?.lead_id ? ["lead", data.lead_id] : data?.deal_id ? ["deal", data.deal_id] : null;
    if (!parent || !(await canAccessEntity(bos, parent[0], parent[1], "update"))) {
      throw new ValidationError("ليس لديك صلاحية تعديل هذا النشاط.");
    }
  }
  return bos;
}

export async function completeActivityAction(id: string, outcome?: string): Promise<ActionState> {
  return handleAction("completeActivity", async () => {
    const bos = await loadOwned(id);
    await completeActivity(bos, id, outcome?.trim() || null);
    revalidatePath("/admin", "layout");
    return { ok: true, message: "تم إكمال النشاط" };
  });
}

export async function setActivityStatusAction(id: string, status: "pending" | "in_progress" | "completed" | "cancelled"): Promise<ActionState> {
  return handleAction("setActivityStatus", async () => {
    const bos = await loadOwned(id);
    await setActivityStatus(bos, id, status);
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}

export async function archiveActivityAction(id: string): Promise<ActionState> {
  return handleAction("archiveActivity", async () => {
    const bos = await loadOwned(id);
    await archiveActivity(bos, id);
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}
