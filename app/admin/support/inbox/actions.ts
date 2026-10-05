"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { authorize, requireBosUserForAction } from "@/lib/bos/auth";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { db } from "@/lib/bos/db";
import { audit } from "@/lib/bos/audit";
import {
  assignConversation, createConversation, createTicketFromConversation, escalateConversation, linkCustomer, mergeCustomers,
  markConversationSpam, replyToConversation, restoreConversationFromSpam, setConversationStatus, updateConversationMeta, updateCustomer, type ConvStatus,
} from "@/services/bos/conversations";

// Support inbox actions (docs/bos/30 §10.2–10.4).
const uuid = /^[0-9a-f-]{36}$/i;
const refresh = () => {
  revalidatePath("/admin/support/inbox");
  revalidatePath("/admin/support");
  revalidatePath("/admin/support/spam");
};

export async function replyAction(id: string, body: string, internal: boolean): Promise<ActionState<{ delivery: string | null; error?: string | null }>> {
  return handleAction("conversationReply", async () => {
    const bos = await requireBosUserForAction();
    if (!uuid.test(id)) throw new ValidationError("قيمة غير صالحة.");
    const r = await replyToConversation(bos, id, body, { internal });
    refresh();
    if (r.delivery === "failed") return { ok: false, error: `لم يُرسل الرد: ${r.error}` };
    return { ok: true, data: r, message: r.delivery === "skipped" ? "حُفظ الرد ولم يُرسل — القناة غير متصلة" : internal ? "تمت إضافة الملاحظة الداخلية" : "تم إرسال الرد" };
  });
}

export async function statusAction(id: string, to: ConvStatus, snoozeUntil?: string | null): Promise<ActionState> {
  return handleAction("conversationStatus", async () => {
    const bos = await requireBosUserForAction();
    if (!uuid.test(id)) throw new ValidationError("قيمة غير صالحة.");
    await setConversationStatus(bos, id, to, { snoozeUntil: snoozeUntil ?? null });
    refresh();
    return { ok: true, message: "تم تحديث الحالة" };
  });
}

export async function assignAction(id: string, patch: { assignee_id?: string | null; team_id?: string | null }): Promise<ActionState> {
  return handleAction("conversationAssign", async () => {
    const bos = await requireBosUserForAction();
    if (!uuid.test(id)) throw new ValidationError("قيمة غير صالحة.");
    await assignConversation(bos, id, patch);
    refresh();
    return { ok: true, message: "تم الإسناد" };
  });
}

export async function escalateAction(id: string, reason?: string): Promise<ActionState> {
  return handleAction("conversationEscalate", async () => {
    const bos = await requireBosUserForAction();
    await escalateConversation(bos, id, reason ?? "");
    refresh();
    return { ok: true, message: "تم التصعيد وإبلاغ قادة الفريق" };
  });
}

export async function metaAction(id: string, patch: { priority?: "low" | "normal" | "high" | "urgent"; tags?: string[] }): Promise<ActionState> {
  return handleAction("conversationMeta", async () => {
    const bos = await requireBosUserForAction();
    await updateConversationMeta(bos, id, patch);
    refresh();
    return { ok: true, message: "تم الحفظ" };
  });
}

export async function ticketFromConversationAction(id: string): Promise<ActionState<{ id: string; number: string }>> {
  return handleAction("conversationTicket", async () => {
    const { bos } = await authorize("tickets.create");
    const t = await createTicketFromConversation(bos, id, {});
    refresh();
    return { ok: true, data: { id: t.id, number: t.ticket_number }, message: "تم إنشاء التذكرة وربطها بالمحادثة" };
  });
}

const newSchema = z.object({
  channel: z.enum(["email", "manual"]),
  name: zf.optionalText(200),
  email: zf.optionalEmail(),
  phone: zf.optionalText(40),
  company: zf.optionalText(200),
  subject: zf.optionalText(300),
  body: zf.required("الرسالة", 20000),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  team_id: zf.optionalUuid(),
});

export async function newConversationAction(_prev: ActionState, formData: FormData): Promise<ActionState<{ id: string }>> {
  return handleAction("newConversation", async () => {
    const { bos } = await authorize("conversations.create");
    const v = parseForm(newSchema, formData);
    const conv = await createConversation(bos, { customer: { name: v.name ?? null, email: v.email ?? null, phone: v.phone ?? null, company: v.company ?? null, source: "manual" }, channel: v.channel, subject: v.subject ?? null, body: v.body, priority: v.priority, team_id: v.team_id ?? null });
    refresh();
    return { ok: true, data: { id: conv.id }, message: "تم إنشاء المحادثة" };
  });
}

const customerSchema = z.object({
  id: zf.uuid(),
  name: zf.required("الاسم", 200),
  email: zf.optionalEmail(),
  phone: zf.optionalText(40),
  whatsapp: zf.optionalText(40),
  company: zf.optionalText(200),
  country: zf.optionalText(100),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  tags: zf.optionalText(500),
  notes: zf.optionalText(5000),
  owner_id: zf.optionalUuid(),
});

export async function saveCustomerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveSupportCustomer", async () => {
    const bos = await requireBosUserForAction();
    const v = parseForm(customerSchema, formData);
    await updateCustomer(bos, v.id, { name: v.name, email: v.email ?? null, phone: v.phone ?? null, whatsapp: v.whatsapp ?? null, company: v.company ?? null, country: v.country ?? null, priority: v.priority, tags: (v.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean), notes: v.notes ?? null, owner_id: v.owner_id ?? null });
    revalidatePath(`/admin/support/customers/${v.id}`);
    return { ok: true, message: "تم حفظ بيانات العميل" };
  });
}

export async function linkCustomerAction(id: string, contactId: string | null, clientId: string | null): Promise<ActionState> {
  return handleAction("linkSupportCustomer", async () => {
    const bos = await requireBosUserForAction();
    await linkCustomer(bos, id, contactId, clientId);
    revalidatePath(`/admin/support/customers/${id}`);
    return { ok: true, message: "تم الربط" };
  });
}

export async function mergeCustomerAction(sourceId: string, targetId: string): Promise<ActionState> {
  return handleAction("mergeSupportCustomer", async () => {
    const bos = await requireBosUserForAction();
    const n = await mergeCustomers(bos, sourceId, targetId);
    revalidatePath(`/admin/support/customers/${targetId}`);
    return { ok: true, message: n ? "تم الدمج ونقل المحادثات" : "تم الدمج" };
  });
}

// Teams
const teamSchema = z.object({ id: zf.optionalUuid(), name: zf.required("الاسم", 100), description: zf.optionalText(500), assignment: z.enum(["least_busy", "round_robin", "manual"]), is_active: zf.checkbox() });

export async function saveTeamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveSupportTeam", async () => {
    const { bos } = await authorize("conversations.manage", "all");
    const v = parseForm(teamSchema, formData);
    const row = { name: v.name, description: v.description ?? null, assignment: v.assignment, is_active: v.is_active };
    const { error } = v.id ? await db().from("support_teams").update(row).eq("id", v.id) : await db().from("support_teams").insert(row);
    if (error) throw error.code === "23505" ? new ValidationError("اسم الفريق مستخدم.", { name: "مكرر" }) : error;
    await audit({ actorId: bos.userId, action: v.id ? "support_team.updated" : "support_team.created", entityType: "support_team", entityId: v.id ?? null, newValue: row });
    revalidatePath("/admin/support/teams");
    return { ok: true, message: "تم حفظ الفريق" };
  });
}

export async function teamMemberAction(teamId: string, userId: string, op: "add" | "remove" | "lead" | "agent" | "available" | "away", maxOpen?: number): Promise<ActionState> {
  return handleAction("supportTeamMember", async () => {
    const { bos } = await authorize("conversations.manage", "all");
    if (!uuid.test(teamId) || !uuid.test(userId)) throw new ValidationError("قيمة غير صالحة.");
    const c = db();
    if (op === "add") await c.from("support_team_members").upsert({ team_id: teamId, user_id: userId, max_open: maxOpen ?? 20 }, { onConflict: "team_id,user_id" });
    else if (op === "remove") await c.from("support_team_members").delete().eq("team_id", teamId).eq("user_id", userId);
    else if (op === "lead" || op === "agent") await c.from("support_team_members").update({ role: op }).eq("team_id", teamId).eq("user_id", userId);
    else await c.from("support_team_members").update({ is_available: op === "available" }).eq("team_id", teamId).eq("user_id", userId);
    await audit({ actorId: bos.userId, action: `support_team.member_${op}`, entityType: "support_team", entityId: teamId, newValue: { user_id: userId } });
    revalidatePath("/admin/support/teams");
    return { ok: true, message: "تم" };
  });
}

// An agent sets their own availability (all teams).
export async function myAvailabilityAction(available: boolean): Promise<ActionState> {
  return handleAction("supportAvailability", async () => {
    const bos = await requireBosUserForAction();
    await db().from("support_team_members").update({ is_available: available }).eq("user_id", bos.userId);
    revalidatePath("/admin/support/inbox");
    return { ok: true, message: available ? "أنت متاح لاستقبال المحادثات" : "لن تُسند إليك محادثات جديدة" };
  });
}

// Spam folder (docs/bos/37 §3) — permission checked in the service.
export async function spamAction(id: string, op: "mark" | "restore", reason?: string): Promise<ActionState> {
  return handleAction("conversationSpam", async () => {
    const bos = await requireBosUserForAction();
    if (!uuid.test(id)) throw new ValidationError("قيمة غير صالحة.");
    if (op === "mark") await markConversationSpam(bos, id, reason ?? null);
    else await restoreConversationFromSpam(bos, id);
    refresh();
    return { ok: true, message: op === "mark" ? "نُقلت المحادثة إلى الرسائل المزعجة" : "أُعيدت المحادثة إلى صندوق الوارد" };
  });
}
