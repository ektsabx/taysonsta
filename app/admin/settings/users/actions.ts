"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { getSetting, saveSetting } from "@/lib/bos/settings";
import { audit } from "@/lib/bos/audit";
import { headers } from "next/headers";
import { resendInvitation, revokeInvitation, sendStaffPasswordReset } from "@/services/bos/users";

// Users & access actions (docs/bos/30 §6, doc 31 Phase 3).

export async function invitationAction(id: string, op: "resend" | "revoke"): Promise<ActionState> {
  return handleAction("invitation", async () => {
    const { bos } = await authorize("users.manage");
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ValidationError("قيمة غير صالحة.");
    if (op === "resend") await resendInvitation(bos, id);
    else await revokeInvitation(bos, id);
    revalidatePath("/admin/settings/users");
    return { ok: true, message: op === "resend" ? "تم إرسال الدعوة مرة أخرى" : "تم إلغاء الدعوة" };
  });
}

const ruleSchema = z.object({
  prefix: z.string().trim().regex(/^\/admin\/[a-z0-9\-/]+$/, "المسار يبدأ بـ /admin/ وحروف إنجليزية صغيرة").transform((s) => s.replace(/\/+$/, "")),
  role_keys: z.array(z.string().regex(/^[a-z_]+$/)).min(1, "اختر دوراً واحداً على الأقل"),
  note: z.string().trim().max(200).default(""),
});

export async function savePageRuleAction(input: { prefix: string; role_keys: string[]; note?: string }): Promise<ActionState> {
  return handleAction("pageRule", async () => {
    const { bos } = await authorize("roles.manage", "all");
    const parsed = ruleSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "بيانات غير صالحة.");
    if (parsed.data.prefix === "/admin/settings/security" || parsed.data.prefix === "/admin/settings") throw new ValidationError("لا يمكن تقييد صفحات الإعدادات الأساسية لتجنب قفل النظام.");
    const current = await getSetting("page_access");
    const rules = [...current.rules.filter((r) => r.prefix !== parsed.data.prefix), parsed.data].sort((a, b) => a.prefix.localeCompare(b.prefix));
    await saveSetting("page_access", { rules }, bos.userId);
    await audit({ actorId: bos.userId, action: "settings.page_rule_saved", entityType: "setting", entityId: null, newValue: parsed.data });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "تم حفظ القيد" };
  });
}

export async function removePageRuleAction(prefix: string): Promise<ActionState> {
  return handleAction("pageRuleRemove", async () => {
    const { bos } = await authorize("roles.manage", "all");
    const current = await getSetting("page_access");
    await saveSetting("page_access", { rules: current.rules.filter((r) => r.prefix !== prefix) }, bos.userId);
    await audit({ actorId: bos.userId, action: "settings.page_rule_removed", entityType: "setting", entityId: null, newValue: { prefix } });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "تم حذف القيد" };
  });
}

export async function sendPasswordResetAction(employeeId: string): Promise<ActionState> {
  return handleAction("sendPasswordReset", async () => {
    const { bos } = await authorize("users.manage", "all");
    if (!/^[0-9a-f-]{36}$/i.test(employeeId)) throw new ValidationError("قيمة غير صالحة.");
    const h = await headers();
    const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
    await sendStaffPasswordReset(bos, employeeId, origin);
    return { ok: true, message: "تم إرسال رابط إعادة تعيين كلمة المرور إلى بريد المستخدم" };
  });
}
