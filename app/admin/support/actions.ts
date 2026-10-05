"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/bos/auth";
import { assertCanAccess } from "@/lib/bos/access";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { assignTicket, changeTicketStatus, createTicket, mergeTickets, replyToTicket, updateTicket, type TicketStatus } from "@/services/bos/support";

const priority = z.enum(["low", "medium", "high", "urgent"]).default("medium");

const ticketSchema = z.object({
  client_id: zf.uuid("الحساب"),
  contact_id: zf.optionalUuid(),
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
    const t = await createTicket({ bos }, { ...v, contact_id: v.contact_id, assigned_to: v.assigned_to });
    revalidatePath("/admin/support/tickets");
    redirect(`/admin/support/tickets/${t.id}`);
  }, "تعذر إنشاء التذكرة.");
}

export async function updateTicketAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("updateTicket", async () => {
    const { bos } = await authorize("tickets.update");
    await assertCanAccess(bos, "ticket", id, "update");
    const v = parseForm(z.object({ category: zf.required("التصنيف", 50), priority }), formData);
    await updateTicket(bos, id, { category: v.category, priority: v.priority });
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
