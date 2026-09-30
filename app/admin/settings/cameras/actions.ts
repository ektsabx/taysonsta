"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { checkCamera, saveCamera } from "@/services/bos/cameras";

// Camera registry actions (docs/bos/30 §29).
const schema = z.object({
  id: zf.optionalUuid(), name: zf.required("الاسم", 120), branch_id: zf.optionalUuid(), location_label: zf.optionalText(200),
  connection_type: z.enum(["hls", "mjpeg", "rtsp", "onvif", "vendor_cloud", "other"]), vendor: zf.optionalText(100), model: zf.optionalText(100), serial_number: zf.optionalText(100),
  viewer_url: zf.optionalText(1000), status: z.enum(["active", "disabled", "maintenance"]), allowed_role_ids: z.array(z.string().uuid()).optional(), notice_displayed: zf.checkbox(), notes: zf.optionalText(2000),
});

export async function saveCameraAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveCamera", async () => {
    const { bos } = await authorize("cameras.manage");
    const v = parseForm(schema, formData);
    await saveCamera(bos, v.id ?? null, { name: v.name, branch_id: v.branch_id, location_label: v.location_label ?? null, connection_type: v.connection_type, vendor: v.vendor ?? null, model: v.model ?? null, serial_number: v.serial_number ?? null, viewer_url: v.viewer_url ?? null, status: v.status, allowed_role_ids: v.allowed_role_ids ?? [], notice_displayed: v.notice_displayed, notes: v.notes ?? null });
    revalidatePath("/admin/settings/cameras", "layout");
    return { ok: true, message: "تم حفظ الكاميرا" };
  });
}

export async function checkCameraAction(id: string): Promise<ActionState> {
  return handleAction("checkCamera", async () => {
    const { bos } = await authorize("cameras.manage");
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ValidationError("قيمة غير صالحة.");
    const r = await checkCamera(bos, id);
    revalidatePath("/admin/settings/cameras", "layout");
    return { ok: true, message: r.status };
  });
}
