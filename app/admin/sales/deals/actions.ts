"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorize, can } from "@/lib/bos/auth";
import { assertCanAccess } from "@/lib/bos/access";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { db } from "@/lib/bos/db";
import { archiveDeal, changeDealStage, createDeal, markDealLost, markDealWon, updateDeal, type DealInput } from "@/services/bos/deals";

const termSchema = z.object({
  label: z.string().trim().min(1).max(120),
  percent: z.string().regex(/^\d+(\.\d{1,2})?$/),
  trigger: z.enum(["on_signing", "on_date"]).default("on_date"),
  due_offset_days: z.coerce.number().int().min(0).max(3650).default(0),
});

const jsonArray = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => {
    if (typeof v !== "string" || !v.trim()) return [];
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }, z.array(schema, { message: "بيانات غير صالحة" }));

const dealSchema = z.object({
  name: zf.required("اسم الصفقة", 200),
  client_id: zf.uuid("الحساب"),
  contact_id: zf.optionalUuid(),
  lead_id: zf.optionalUuid(),
  source_id: zf.optionalUuid(),
  value: zf.money("قيمة الصفقة"),
  currency: zf.currency(),
  probability: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^\d{1,3}(\.\d{1,2})?$/).refine((v) => Number(v) <= 100, "0–100").nullable()),
  expected_close_date: zf.optionalDate(),
  assigned_to: zf.optionalUuid(),
  scope: zf.optionalText(20000),
  notes: zf.optionalText(10000),
  payment_terms_json: jsonArray(termSchema),
  is_upsell: zf.checkbox().optional(),
  previous_deal_id: zf.optionalUuid().optional(),
});

function toInput(v: z.infer<typeof dealSchema>): DealInput {
  return {
    name: v.name,
    client_id: v.client_id,
    contact_id: v.contact_id,
    lead_id: v.lead_id,
    source_id: v.source_id,
    value: v.value,
    currency: v.currency,
    probability: v.probability,
    expected_close_date: v.expected_close_date,
    assigned_to: v.assigned_to,
    scope: v.scope ?? null,
    notes: v.notes ?? null,
    payment_terms: v.payment_terms_json,
    is_upsell: v.is_upsell ?? false,
    previous_deal_id: v.previous_deal_id ?? null,
  };
}

export async function createDealAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id: string | null = null;
  const result = await handleAction("createDeal", async () => {
    const { bos } = await authorize("deals.create");
    const v = parseForm(dealSchema, formData);
    await assertCanAccess(bos, "client", v.client_id, "read");
    if (v.assigned_to && v.assigned_to !== bos.userId && !can(bos, "deals.assign")) {
      throw new ValidationError("لا يمكنك إسناد صفقة لموظف آخر.", { assigned_to: "غير مسموح" });
    }
    const deal = await createDeal(bos, toInput(v));
    id = deal.id;
    revalidatePath("/admin/sales/deals");
    return { ok: true };
  }, "تعذر إنشاء الصفقة.");
  if (result.ok && id) redirect(`/admin/sales/deals/${id}`);
  return result;
}

export async function updateDealAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("updateDeal", async () => {
    const { bos } = await authorize("deals.update");
    await assertCanAccess(bos, "deal", id, "update");
    const v = parseForm(dealSchema, formData);
    const input = toInput(v);
    if (!can(bos, "deals.assign")) {
      const { data } = await db().from("deals").select("assigned_to").eq("id", id).single();
      input.assigned_to = data?.assigned_to ?? bos.userId;
    }
    await updateDeal(bos, id, input);
    revalidatePath(`/admin/sales/deals/${id}`);
    revalidatePath("/admin/sales/deals");
    return { ok: true, message: "تم حفظ التغييرات" };
  }, "تعذر حفظ التغييرات.");
}

export async function changeDealStageAction(id: string, stageId: string, reason?: string): Promise<ActionState> {
  return handleAction("changeDealStage", async () => {
    const { bos } = await authorize("deals.update");
    await assertCanAccess(bos, "deal", id, "update");
    await changeDealStage(bos, id, stageId, { reason: reason ?? null, allowReopen: can(bos, "deals.approve") || can(bos, "deals.manage") });
    revalidatePath(`/admin/sales/deals/${id}`);
    revalidatePath("/admin/sales/deals");
    revalidatePath("/admin/sales/pipeline");
    return { ok: true, message: "تم تحديث المرحلة" };
  });
}

export async function markDealWonAction(id: string): Promise<ActionState> {
  return handleAction("markDealWon", async () => {
    const { bos } = await authorize("deals.update");
    await assertCanAccess(bos, "deal", id, "update");
    await markDealWon(bos, id);
    revalidatePath(`/admin/sales/deals/${id}`);
    revalidatePath("/admin/sales/pipeline");
    return { ok: true, message: "تم كسب الصفقة وإنشاء جدول الدفعات والفاتورة الأولى" };
  }, "تعذر تسجيل كسب الصفقة.");
}

export async function markDealLostAction(id: string, reason?: string): Promise<ActionState> {
  return handleAction("markDealLost", async () => {
    const { bos } = await authorize("deals.update");
    await assertCanAccess(bos, "deal", id, "update");
    await markDealLost(bos, id, reason ?? "");
    revalidatePath(`/admin/sales/deals/${id}`);
    revalidatePath("/admin/sales/pipeline");
    return { ok: true, message: "تم تسجيل الخسارة" };
  });
}

export async function archiveDealAction(id: string): Promise<ActionState> {
  return handleAction("archiveDeal", async () => {
    const { bos } = await authorize("deals.delete");
    await assertCanAccess(bos, "deal", id, "update");
    await archiveDeal(bos, id);
    revalidatePath("/admin/sales/deals");
    return { ok: true, message: "تمت الأرشفة" };
  });
}

export async function bulkAssignDealsAction(ids: string[], userId?: string): Promise<ActionState> {
  return handleAction("bulkAssignDeals", async () => {
    const { bos } = await authorize("deals.assign");
    if (!userId) throw new ValidationError("اختر المسؤول.");
    for (const id of ids) {
      await assertCanAccess(bos, "deal", id, "read");
      const { data: before } = await db().from("deals").select("assigned_to").eq("id", id).single();
      await db().from("deals").update({ assigned_to: userId }).eq("id", id);
      const { audit } = await import("@/lib/bos/audit");
      await audit({ actorId: bos.userId, action: "deal.reassigned", entityType: "deal", entityId: id, oldValue: { assigned_to: before?.assigned_to }, newValue: { assigned_to: userId } });
      const { emitEvent } = await import("@/lib/bos/events");
      await emitEvent({ type: "deal.updated", entityType: "deal", entityId: id, summary: "Deal reassigned", payload: { owner_user_id: userId }, actorId: bos.userId });
    }
    revalidatePath("/admin/sales/deals");
    return { ok: true, message: `تم تعيين ${ids.length} صفقة` };
  });
}
