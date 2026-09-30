"use server";
import { nowIso } from "@/lib/bos/clock";

import { revalidatePath } from "next/cache";
import { authorize, requireBosUserForAction } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { db } from "@/lib/bos/db";
import { audit } from "@/lib/bos/audit";
import { ValidationError } from "@/lib/bos/errors";
import { widgetByKey } from "@/lib/bos/widgets";

// Personal layout (own) or a role layout (settings.manage) — §79.
export async function saveDashboardLayoutAction(roleId: string | null, keys: string[]): Promise<ActionState> {
  return handleAction("saveDashboardLayout", async () => {
    const bos = roleId ? (await authorize("settings.manage", "all")).bos : await requireBosUserForAction();
    const clean = [...new Set(keys)].filter((k) => widgetByKey.has(k));
    if (!clean.length) throw new ValidationError("اختر عنصراً واحداً على الأقل.");
    // Personal layouts may only contain widgets the user is allowed to see.
    if (!roleId && clean.some((k) => !widgetByKey.get(k)!.perm.every((p) => bos.permissions.has(p)))) throw new ValidationError("بعض العناصر غير متاحة لصلاحياتك.");
    const widgets = clean.map((key) => ({ key }));
    const col = roleId ? "role_id" : "user_id";
    const id = roleId ?? bos.userId;
    const { data: existing } = await db().from("dashboard_layouts").select("id, widgets").eq(col, id).maybeSingle();
    if (existing) await db().from("dashboard_layouts").update({ widgets, updated_at: nowIso() }).eq("id", existing.id);
    else await db().from("dashboard_layouts").insert({ [col]: id, widgets } as never);
    await audit({ actorId: bos.userId, action: roleId ? "dashboard.role_layout_saved" : "dashboard.personal_layout_saved", entityType: roleId ? "role" : "user", entityId: id, oldValue: existing?.widgets ?? null, newValue: widgets });
    revalidatePath("/admin/dashboard");
    return { ok: true, message: "تم حفظ التخطيط" };
  });
}

export async function resetDashboardLayoutAction(roleId: string | null): Promise<ActionState> {
  return handleAction("resetDashboardLayout", async () => {
    const bos = roleId ? (await authorize("settings.manage", "all")).bos : await requireBosUserForAction();
    await db().from("dashboard_layouts").delete().eq(roleId ? "role_id" : "user_id", roleId ?? bos.userId);
    await audit({ actorId: bos.userId, action: "dashboard.layout_reset", entityType: roleId ? "role" : "user", entityId: roleId ?? bos.userId });
    revalidatePath("/admin/dashboard");
    return { ok: true, message: "تمت الاستعادة للتخطيط الافتراضي" };
  });
}
