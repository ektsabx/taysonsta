"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { normalizeDomains, rotateWidgetKey, saveWidget } from "@/services/bos/widgets";

// Website support widget admin actions (docs/bos/30 §10.5); managed from
// Settings → Integrations since docs/bos/37 §5.
const uuid = /^[0-9a-f-]{36}$/i;

const widgetSchema = z.object({
  id: zf.optionalUuid(),
  name: zf.required("الاسم", 120),
  is_active: zf.checkbox(),
  on_yolias: zf.checkbox(),
  allowed_domains: zf.optionalText(3000),
  title: zf.required("العنوان", 80),
  welcome_message: zf.required("رسالة الترحيب", 500),
  offline_message: zf.required("رسالة خارج الدوام", 500),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "لون غير صالح"),
  position: z.enum(["right", "left"]),
  bottom_offset: zf.int(0, 400),
  language: z.enum(["ar", "en"]),
  require_email: zf.checkbox(),
  hours_enabled: zf.checkbox(),
  hours_tz: zf.optionalText(60),
  hours_start: zf.optionalText(5),
  hours_end: zf.optionalText(5),
  hours_days: z.array(z.coerce.number().int().min(0).max(6)).optional(),
  ai_agent_id: zf.optionalUuid(),
  team_id: zf.optionalUuid(),
});

export async function saveWidgetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveWidget", async () => {
    const { bos } = await authorize("conversations.manage", "all");
    const v = parseForm(widgetSchema, formData);
    await saveWidget(bos, v.id ?? null, {
      name: v.name, is_active: v.is_active, on_yolias: v.on_yolias, allowed_domains: normalizeDomains(v.allowed_domains ?? ""), title: v.title, welcome_message: v.welcome_message, offline_message: v.offline_message,
      primary_color: v.primary_color, position: v.position, bottom_offset: v.bottom_offset, language: v.language, require_email: v.require_email,
      working_hours: v.hours_enabled ? { tz: v.hours_tz ?? "Africa/Cairo", start: v.hours_start ?? "", end: v.hours_end ?? "", days: v.hours_days ?? [] } : {},
      ai_agent_id: v.ai_agent_id, team_id: v.team_id,
    });
    revalidatePath("/admin/settings/integrations/widgets");
    return { ok: true, message: "تم حفظ الويدجت" };
  });
}

export async function rotateWidgetKeyAction(id: string): Promise<ActionState> {
  return handleAction("rotateWidgetKey", async () => {
    const { bos } = await authorize("conversations.manage", "all");
    if (!uuid.test(id)) throw new ValidationError("قيمة غير صالحة.");
    await rotateWidgetKey(bos, id);
    revalidatePath("/admin/settings/integrations/widgets");
    return { ok: true, message: "تم تغيير المفتاح — حدّث كود التضمين في موقعك" };
  });
}
