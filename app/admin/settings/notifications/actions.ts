"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { db } from "@/lib/bos/db";
import { audit } from "@/lib/bos/audit";
import { eventMap } from "@/lib/bos/event-types";
import { retryDelivery } from "@/services/bos/notification-delivery";

// Notification management (docs/bos/30 §9.2): templates per event and
// language, subscription conditions, delivery retry.

const tplSchema = z.object({
  event_type: z.string().regex(/^[a-z_]+\.[a-z_]+$/),
  language: z.enum(["ar", "en"]),
  title: zf.required("العنوان", 200),
  body: zf.optionalText(1000),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  is_active: zf.checkbox(),
});

export async function saveNotificationTemplateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveNotificationTemplate", async () => {
    const { bos } = await authorize("settings.manage", "all");
    const v = parseForm(tplSchema, formData);
    if (!eventMap.has(v.event_type)) throw new ValidationError("حدث غير معروف.");
    const row = { ...v, body: v.body ?? null, updated_by: bos.userId };
    const { error } = await db().from("notification_templates").upsert(row, { onConflict: "event_type,language" });
    if (error) throw error;
    await audit({ actorId: bos.userId, action: "notification.template_saved", entityType: "notification_template", entityId: null, newValue: row });
    revalidatePath("/admin/settings/notifications");
    return { ok: true, message: "تم حفظ القالب" };
  });
}

const condSchema = z.array(z.object({ field: z.string().min(1).max(100), op: z.string().min(1).max(30), value: z.unknown().optional() })).max(10);

export async function saveSubscriptionConditionsAction(id: string, json: string): Promise<ActionState> {
  return handleAction("subscriptionConditions", async () => {
    const { bos } = await authorize("settings.manage", "all");
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ValidationError("قيمة غير صالحة.");
    let parsed: unknown;
    try {
      parsed = json.trim() ? JSON.parse(json) : [];
    } catch {
      throw new ValidationError("JSON غير صالح");
    }
    const conds = condSchema.safeParse(parsed);
    if (!conds.success) throw new ValidationError("صيغة الشروط غير صحيحة: [{\"field\":\"entity.priority\",\"op\":\"eq\",\"value\":\"urgent\"}]");
    await db().from("notification_subscriptions").update({ conditions: conds.data as never }).eq("id", id);
    await audit({ actorId: bos.userId, action: "notification.subscription_conditions", entityType: "notification_subscription", entityId: id, newValue: conds.data });
    revalidatePath("/admin/settings/notifications");
    return { ok: true, message: "تم حفظ الشروط" };
  });
}

export async function retryDeliveryAction(id: string): Promise<ActionState> {
  return handleAction("retryDelivery", async () => {
    const { bos } = await authorize("settings.manage", "all");
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ValidationError("قيمة غير صالحة.");
    const r = await retryDelivery(bos, id);
    revalidatePath("/admin/settings/notifications");
    return { ok: true, message: r.sent ? "تم الإرسال" : r.failed ? "فشل مرة أخرى — راجع السبب" : "تمت المحاولة" };
  });
}
