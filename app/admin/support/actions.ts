"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/bos/auth";
import { assertCanAccess } from "@/lib/bos/access";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import {
  advanceBug, assignTicket, changeFeatureStatus, changeTicketStatus, convertTicketToBug, createBug, createFeatureRequest, createTicket,
  createUpsellDealFromFeatureRequest, mergeTickets, replyToTicket, setQaStatus, updateBug, updateFeatureRequest, updateTicket,
  type BugStatus, type FeatureStatus, type TicketStatus,
} from "@/services/bos/support";

const priority = z.enum(["low", "medium", "high", "urgent"]).default("medium");

const ticketSchema = z.object({
  client_id: zf.uuid("الحساب"),
  contact_id: zf.optionalUuid(),
  project_id: zf.optionalUuid(),
  category: zf.required("التصنيف", 50),
  priority,
  subject: zf.required("الموضوع", 300),
  description: zf.required("الوصف", 20000),
  assigned_to: zf.optionalUuid(),
});

export async function createTicketAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("createTicket", async () => {
    const { bos } = await authorize("tickets.create");
    const v = parseForm(ticketSchema, formData);
    await assertCanAccess(bos, "client", v.client_id);
    const t = await createTicket({ bos }, { ...v, contact_id: v.contact_id, project_id: v.project_id, assigned_to: v.assigned_to });
    revalidatePath("/admin/support/tickets");
    redirect(`/admin/support/tickets/${t.id}`);
  }, "تعذر إنشاء التذكرة.");
}

export async function updateTicketAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("updateTicket", async () => {
    const { bos } = await authorize("tickets.update");
    await assertCanAccess(bos, "ticket", id, "update");
    const v = parseForm(z.object({ category: zf.required("التصنيف", 50), priority, project_id: zf.optionalUuid() }), formData);
    await updateTicket(bos, id, { category: v.category, priority: v.priority, project_id: v.project_id });
    revalidatePath(`/admin/support/tickets/${id}`);
    return { ok: true, message: "تم الحفظ" };
  });
}

export async function assignTicketAction(id: string, userId?: string): Promise<ActionState> {
  return handleAction("assignTicket", async () => {
    const { bos } = await authorize("tickets.assign");
    await assertCanAccess(bos, "ticket", id);
    await assignTicket(bos, id, userId && userId !== "none" ? userId : null);
    revalidatePath(`/admin/support/tickets/${id}`);
    revalidatePath("/admin/support/tickets");
    return { ok: true, message: "تم التعيين" };
  });
}

export async function bulkAssignTicketsAction(ids: string[], userId?: string): Promise<ActionState> {
  return handleAction("bulkAssignTickets", async () => {
    const { bos } = await authorize("tickets.assign");
    if (!ids.length) throw new ValidationError("لم يتم تحديد أي تذكرة.");
    for (const id of ids) {
      await assertCanAccess(bos, "ticket", id);
      await assignTicket(bos, id, userId && userId !== "none" ? userId : null);
    }
    revalidatePath("/admin/support/tickets");
    return { ok: true, message: `تم تعيين ${ids.length} تذكرة` };
  });
}

export async function ticketStatusAction(id: string, to: string, reason?: string): Promise<ActionState> {
  return handleAction("ticketStatus", async () => {
    const { bos } = await authorize("tickets.update");
    await assertCanAccess(bos, "ticket", id, "update");
    await changeTicketStatus({ bos }, id, to as TicketStatus, reason ?? null);
    revalidatePath(`/admin/support/tickets/${id}`);
    return { ok: true, message: "تم تحديث الحالة" };
  });
}

export async function replyTicketAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("replyTicket", async () => {
    const { bos } = await authorize("tickets.update");
    await assertCanAccess(bos, "ticket", id);
    const v = parseForm(z.object({ body: zf.required("الرد", 20000), internal: zf.checkbox().optional() }), formData);
    await replyToTicket({ bos }, id, v.body, Boolean(v.internal));
    revalidatePath(`/admin/support/tickets/${id}`);
    return { ok: true, message: v.internal ? "تمت إضافة الملاحظة الداخلية" : "تم إرسال الرد للعميل" };
  }, "تعذر إرسال الرد.");
}

export async function convertToBugAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("convertToBug", async () => {
    const { bos } = await authorize("bugs.create");
    await assertCanAccess(bos, "ticket", id);
    const v = parseForm(z.object({ title: zf.required("العنوان", 300), severity: z.enum(["critical", "major", "minor", "trivial"]), environment: z.enum(["production", "staging", "development"]), steps_to_reproduce: zf.optionalText(10000), assigned_to: zf.optionalUuid() }), formData);
    const bug = await convertTicketToBug(bos, id, { ...v, steps_to_reproduce: v.steps_to_reproduce ?? null });
    redirect(`/admin/support/bugs/${bug.id}`);
  }, "تعذر إنشاء الخطأ البرمجي.");
}

export async function mergeTicketAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("mergeTicket", async () => {
    const { bos } = await authorize("tickets.update");
    const v = parseForm(z.object({ target: zf.uuid("التذكرة الهدف") }), formData);
    await assertCanAccess(bos, "ticket", id, "update");
    await assertCanAccess(bos, "ticket", v.target, "update");
    await mergeTickets(bos, id, v.target);
    redirect(`/admin/support/tickets/${v.target}`);
  }, "تعذر الدمج.");
}

const bugSchema = z.object({
  project_id: zf.optionalUuid(),
  title: zf.required("العنوان", 300),
  environment: z.enum(["production", "staging", "development"]).default("production"),
  severity: z.enum(["critical", "major", "minor", "trivial"]).default("minor"),
  priority,
  description: zf.optionalText(20000),
  steps_to_reproduce: zf.optionalText(10000),
  expected_behavior: zf.optionalText(5000),
  actual_behavior: zf.optionalText(5000),
  assigned_to: zf.optionalUuid(),
});

export async function saveBugAction(id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveBug", async () => {
    const { bos } = await authorize(id ? "bugs.update" : "bugs.create");
    const v = parseForm(bugSchema, formData);
    const input = { title: v.title, environment: v.environment, severity: v.severity, priority: v.priority, description: v.description ?? null, steps_to_reproduce: v.steps_to_reproduce ?? null, expected_behavior: v.expected_behavior ?? null, actual_behavior: v.actual_behavior ?? null, assigned_to: v.assigned_to };
    if (id) {
      await assertCanAccess(bos, "bug", id, "update");
      await updateBug(bos, id, input);
      revalidatePath(`/admin/support/bugs/${id}`);
      return { ok: true, message: "تم الحفظ" };
    }
    if (!v.project_id) throw new ValidationError("المشروع مطلوب.", { project_id: "مطلوب" });
    await assertCanAccess(bos, "project", v.project_id);
    const bug = await createBug(bos, { ...input, project_id: v.project_id, ticket_id: null });
    revalidatePath("/admin/support/bugs");
    redirect(`/admin/support/bugs/${bug.id}`);
  }, "تعذر حفظ الخطأ البرمجي.");
}

export async function bugStatusAction(id: string, to: string, reason?: string): Promise<ActionState> {
  return handleAction("bugStatus", async () => {
    const { bos } = await authorize("bugs.update");
    await assertCanAccess(bos, "bug", id, "update");
    await advanceBug(bos, id, to as BugStatus, reason ?? null);
    revalidatePath(`/admin/support/bugs/${id}`);
    revalidatePath("/admin/support/bugs");
    return { ok: true };
  });
}

export async function bugQaAction(id: string, qa: "passed" | "failed", note?: string): Promise<ActionState> {
  return handleAction("bugQa", async () => {
    const { bos } = await authorize("bugs.update");
    await assertCanAccess(bos, "bug", id);
    await setQaStatus(bos, id, qa, note ?? null);
    revalidatePath(`/admin/support/bugs/${id}`);
    revalidatePath("/admin/support/bugs");
    return { ok: true, message: qa === "passed" ? "نجح الاختبار — تم الإصلاح" : "فشل الاختبار — أُعيد للتطوير" };
  });
}

const featureSchema = z.object({
  client_id: zf.optionalUuid(),
  project_id: zf.optionalUuid(),
  title: zf.required("العنوان", 300),
  description: zf.optionalText(20000),
  business_value: zf.optionalText(5000),
  priority,
  estimated_effort_hours: zf.optionalMoney(),
  cost: zf.optionalMoney(),
  currency: z.preprocess((v) => (v === "" ? null : v), zf.currency().nullable()),
});

export async function saveFeatureAction(id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveFeature", async () => {
    const { bos } = await authorize(id ? "feature_requests.update" : "feature_requests.create");
    const v = parseForm(featureSchema, formData);
    const input = { client_id: v.client_id, project_id: v.project_id, title: v.title, description: v.description ?? null, business_value: v.business_value ?? null, priority: v.priority, estimated_effort_hours: v.estimated_effort_hours ?? null, cost: v.cost ?? null, currency: v.cost ? v.currency ?? null : null };
    if (id) {
      await assertCanAccess(bos, "feature_request", id, "update");
      await updateFeatureRequest(bos, id, input);
      revalidatePath(`/admin/support/feature-requests/${id}`);
      return { ok: true, message: "تم الحفظ" };
    }
    if (input.client_id) await assertCanAccess(bos, "client", input.client_id);
    const fr = await createFeatureRequest({ bos }, input);
    redirect(`/admin/support/feature-requests/${fr.id}`);
  }, "تعذر حفظ طلب الميزة.");
}

export async function featureStatusAction(id: string, to: string, reason?: string): Promise<ActionState> {
  return handleAction("featureStatus", async () => {
    const { bos } = await authorize("feature_requests.update");
    await assertCanAccess(bos, "feature_request", id, "update");
    await changeFeatureStatus(bos, id, to as FeatureStatus, reason?.trim() || null);
    revalidatePath(`/admin/support/feature-requests/${id}`);
    return { ok: true };
  });
}

export async function featureUpsellAction(id: string): Promise<ActionState> {
  return handleAction("featureUpsell", async () => {
    const { bos } = await authorize("deals.create");
    await assertCanAccess(bos, "feature_request", id);
    const deal = await createUpsellDealFromFeatureRequest(bos, id);
    redirect(`/admin/sales/deals/${deal.id}`);
  }, "تعذر إنشاء صفقة البيع الإضافي.");
}
