"use server";

import { revalidatePath } from "next/cache";
import { requireBosUserForAction } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { db } from "@/lib/bos/db";
import { ValidationError } from "@/lib/bos/errors";
import { audit } from "@/lib/bos/audit";
import { syncBosMfaStatus } from "@/services/bos/it-access";

// Own notification preferences: only for channels the subscription marks
// user-configurable (critical ones stay on — docs/bos/24).
export async function savePreferencesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("savePreferences", async () => {
    const bos = await requireBosUserForAction();
    const { data: subs } = await db().from("notification_subscriptions").select("event_type, channels, user_configurable").eq("is_active", true);
    const configurable = new Map<string, Set<string>>();
    for (const s of subs ?? []) {
      if (!s.user_configurable) continue;
      const set = configurable.get(s.event_type) ?? new Set<string>();
      for (const ch of s.channels) set.add(ch);
      configurable.set(s.event_type, set);
    }
    const rows = [...configurable.entries()].map(([event_type, channels]) => ({
      user_id: bos.userId,
      event_type,
      in_app: channels.has("in_app") ? formData.get(`${event_type}:in_app`) === "on" : true,
      email: channels.has("email") ? formData.get(`${event_type}:email`) === "on" : false,
      push: channels.has("push") ? formData.get(`${event_type}:push`) === "on" : false,
    }));
    if (!rows.length) throw new ValidationError("لا توجد تفضيلات قابلة للتعديل.");
    const { error } = await db().from("notification_preferences").upsert(rows, { onConflict: "user_id,event_type" });
    if (error) throw error;
    await audit({ actorId: bos.userId, action: "notification_preferences.updated", entityType: "employee", entityId: bos.employee.id, newValue: { count: rows.length } });
    revalidatePath("/admin/profile");
    return { ok: true, message: "تم حفظ التفضيلات" };
  });
}

export async function syncMyMfaAction(): Promise<ActionState> {
  return handleAction("syncMyMfa", async () => {
    const bos = await requireBosUserForAction();
    const status = await syncBosMfaStatus(bos.employee.id);
    revalidatePath("/admin/profile");
    return { ok: true, message: status === "enabled" ? "تم تفعيل التحقق بخطوتين" : `الحالة: ${status}` };
  });
}
