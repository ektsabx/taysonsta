"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { sendManualNotification } from "@/services/bos/manual-notifications";

const schema = z.object({
  target_kind: z.enum(["users", "team", "department", "branch", "role", "all"]),
  target_ids: z.array(z.string().uuid()).default([]),
  channels: z.array(z.enum(["in_app", "email"])).default(["in_app"]),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  title: zf.required("العنوان", 200),
  body: zf.optionalText(4000),
  link: zf.optionalText(300),
});

export async function sendManualNotificationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("manualNotification", async () => {
    const { bos } = await authorize("notifications.manage");
    const v = parseForm(schema, formData);
    await sendManualNotification(bos, { ...v, body: v.body ?? null, link: v.link ?? null });
    revalidatePath("/admin/communication/notifications");
    return { ok: true, message: "تم إرسال الإشعار" };
  });
}
