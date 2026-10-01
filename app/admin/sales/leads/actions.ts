"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorize, can } from "@/lib/bos/auth";
import { assertCanAccess } from "@/lib/bos/access";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import {
  archiveLead,
  assignLeads,
  changeLeadStage,
  convertLeadToDeal,
  createLead,
  updateLead,
  type LeadInput,
} from "@/services/bos/leads";

const score = zf.int(0, 25).default(0);

const leadSchema = z
  .object({
    name: zf.required("اسم العميل المحتمل", 200),
    company_name: zf.optionalText(200),
    contact_name: zf.optionalText(200),
    email: zf.optionalEmail(),
    phone: zf.optionalText(50),
    website: zf.optionalUrl(),
    country: zf.optionalText(100),
    city: zf.optionalText(100),
    industry: zf.optionalText(100),
    source_id: zf.optionalUuid(),
    estimated_budget: zf.optionalMoney(),
    budget_currency: z.preprocess((v) => (v === "" ? null : v), zf.currency().nullable()),
    product_interest_id: zf.optionalUuid(),
    business_stage: zf.optionalText(100),
    timeline: zf.optionalText(200),
    decision_maker: zf.optionalText(200),
    current_solution: zf.optionalText(2000),
    problem: zf.optionalText(5000),
    notes: zf.optionalText(10000),
    assigned_to: zf.optionalUuid(),
    team_id: zf.optionalUuid(),
    priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
    budget_score: score,
    fit_score: score,
    intent_score: score,
    engagement_score: score,
    allow_duplicate: zf.checkbox().optional(),
  })
  .refine((v) => v.email || v.phone, { message: "أدخل البريد الإلكتروني أو رقم الهاتف على الأقل", path: ["email"] });

function toInput(v: z.infer<typeof leadSchema>): LeadInput {
  return {
    name: v.name,
    company_name: v.company_name ?? null,
    contact_name: v.contact_name ?? null,
    email: v.email ?? null,
    phone: v.phone ?? null,
    website: v.website ?? null,
    country: v.country ?? null,
    city: v.city ?? null,
    industry: v.industry ?? null,
    source_id: v.source_id,
    estimated_budget: v.estimated_budget ?? null,
    budget_currency: v.budget_currency ?? null,
    product_interest_id: v.product_interest_id,
    business_stage: v.business_stage ?? null,
    timeline: v.timeline ?? null,
    decision_maker: v.decision_maker ?? null,
    current_solution: v.current_solution ?? null,
    problem: v.problem ?? null,
    notes: v.notes ?? null,
    assigned_to: v.assigned_to,
    team_id: v.team_id,
    priority: v.priority,
    budget_score: v.budget_score,
    fit_score: v.fit_score,
    intent_score: v.intent_score,
    engagement_score: v.engagement_score,
  };
}

export async function createLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState<{ id: string }>> {
  return handleAction("createLead", async () => {
    const { bos } = await authorize("leads.create");
    const values = parseForm(leadSchema, formData);
    if (values.assigned_to && values.assigned_to !== bos.userId && !can(bos, "leads.assign")) {
      throw new ValidationError("ليس لديك صلاحية تعيين العملاء المحتملين لموظفين آخرين.", { assigned_to: "غير مسموح" });
    }
    const input = toInput(values);
    if (!input.assigned_to && !can(bos, "leads.assign")) input.assigned_to = bos.userId;
    const lead = await createLead(bos, input, { allowDuplicate: Boolean(values.allow_duplicate) && can(bos, "leads.manage") });
    revalidatePath("/admin/sales/leads");
    redirect(`/admin/sales/leads/${lead.id}`);
  }, "تعذر إنشاء العميل المحتمل.");
}

export async function updateLeadAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("updateLead", async () => {
    const { bos } = await authorize("leads.update");
    await assertCanAccess(bos, "lead", id, "update");
    const values = parseForm(leadSchema, formData);
    const input = toInput(values);
    if (!can(bos, "leads.assign")) {
      const { db } = await import("@/lib/bos/db");
      const { data } = await db().from("leads").select("assigned_to").eq("id", id).single();
      input.assigned_to = data?.assigned_to ?? bos.userId;
    }
    await updateLead(bos, id, input);
    revalidatePath(`/admin/sales/leads/${id}`);
    revalidatePath("/admin/sales/leads");
    return { ok: true, message: "تم حفظ التغييرات" };
  }, "تعذر حفظ التغييرات.");
}

export async function changeLeadStageAction(id: string, stageId: string, reason?: string): Promise<ActionState> {
  return handleAction("changeLeadStage", async () => {
    const { bos } = await authorize("leads.update");
    await assertCanAccess(bos, "lead", id, "update");
    await changeLeadStage(bos, id, stageId, reason ?? null, { allowReopen: can(bos, "leads.manage") });
    revalidatePath(`/admin/sales/leads/${id}`);
    revalidatePath("/admin/sales/leads");
    revalidatePath("/admin/sales/pipeline");
    return { ok: true, message: "تم تحديث المرحلة" };
  });
}

export async function bulkAssignLeadsAction(ids: string[], userId?: string): Promise<ActionState> {
  return handleAction("bulkAssignLeads", async () => {
    const { bos } = await authorize("leads.assign");
    if (!ids.length) throw new ValidationError("لم يتم تحديد أي عنصر.");
    for (const id of ids) await assertCanAccess(bos, "lead", id, "read");
    await assignLeads(bos, ids, userId && userId !== "none" ? userId : null);
    revalidatePath("/admin/sales/leads");
    return { ok: true, message: `تم تعيين ${ids.length} عميل محتمل` };
  });
}

export async function bulkStageLeadsAction(ids: string[], stageId?: string): Promise<ActionState> {
  return handleAction("bulkStageLeads", async () => {
    const { bos } = await authorize("leads.update");
    if (!stageId) throw new ValidationError("اختر المرحلة.");
    let failed = 0;
    for (const id of ids) {
      try {
        await assertCanAccess(bos, "lead", id, "update");
        await changeLeadStage(bos, id, stageId, null, { allowReopen: can(bos, "leads.manage") });
      } catch {
        failed++;
      }
    }
    revalidatePath("/admin/sales/leads");
    return failed
      ? { ok: false, error: `تم تحديث ${ids.length - failed} وفشل ${failed} (مرحلة مغلقة أو تتطلب سبباً أو نقاط تأهيل).` }
      : { ok: true, message: `تم تحديث ${ids.length} عميل محتمل` };
  });
}

export async function bulkArchiveLeadsAction(ids: string[]): Promise<ActionState> {
  return handleAction("bulkArchiveLeads", async () => {
    const { bos } = await authorize("leads.delete");
    for (const id of ids) {
      await assertCanAccess(bos, "lead", id, "update");
      await archiveLead(bos, id, true);
    }
    revalidatePath("/admin/sales/leads");
    return { ok: true, message: `تمت أرشفة ${ids.length} عميل محتمل` };
  });
}

export async function archiveLeadAction(id: string, archived: boolean): Promise<ActionState> {
  return handleAction("archiveLead", async () => {
    const { bos } = await authorize("leads.delete");
    await assertCanAccess(bos, "lead", id, "update");
    await archiveLead(bos, id, archived);
    revalidatePath(`/admin/sales/leads/${id}`);
    revalidatePath("/admin/sales/leads");
    return { ok: true, message: archived ? "تمت الأرشفة" : "تمت الاستعادة" };
  });
}

const convertSchema = z
  .object({
    clientId: zf.optionalUuid(),
    newClientName: zf.optionalText(200),
    newClientEmail: zf.optionalEmail(),
    contactId: zf.optionalUuid(),
    dealName: zf.required("اسم الصفقة", 200),
    value: zf.money("قيمة الصفقة"),
    currency: zf.currency(),
    expectedCloseDate: zf.optionalDate(),
    productId: zf.optionalUuid(),
  })
  .refine((v) => v.clientId || v.newClientEmail, { message: "اختر حساباً موجوداً أو أدخل بريد حساب جديد", path: ["clientId"] });

export async function convertLeadAction(leadId: string, _prev: ActionState, formData: FormData): Promise<ActionState<{ dealId: string }>> {
  return handleAction("convertLead", async () => {
    const { bos } = await authorize("deals.create");
    await assertCanAccess(bos, "lead", leadId, "update");
    const v = parseForm(convertSchema, formData);
    const dealId = await convertLeadToDeal(bos, leadId, {
      clientId: v.clientId,
      newClientName: v.newClientName ?? null,
      newClientEmail: v.newClientEmail ?? null,
      contactId: v.contactId,
      dealName: v.dealName,
      value: v.value,
      currency: v.currency,
      expectedCloseDate: v.expectedCloseDate,
      productId: v.productId,
    });
    revalidatePath(`/admin/sales/leads/${leadId}`);
    return { ok: true, data: { dealId }, message: "تم إنشاء الصفقة" };
  }, "تعذر تحويل العميل المحتمل إلى صفقة.");
}

