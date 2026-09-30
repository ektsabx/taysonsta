"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { portalPermissionKeys } from "@/lib/bos/portal-auth";
import { saveDeployment, saveSupportPlan, setPortalPermissions } from "@/services/bos/portal-extra";

// Staff-side portal extensions (docs/bos/30 §23).
const uuid = /^[0-9a-f-]{36}$/i;

export async function portalPermissionsAction(clientId: string, portalUserId: string, perms: Record<string, boolean>): Promise<ActionState> {
  return handleAction("portalPermissions", async () => {
    const { bos } = await authorize("portal.manage");
    if (!uuid.test(portalUserId) || !uuid.test(clientId)) throw new ValidationError("قيمة غير صالحة.");
    await setPortalPermissions(bos, portalUserId, Object.fromEntries(portalPermissionKeys.map((k) => [k, perms[k] !== false])));
    revalidatePath(`/admin/clients/${clientId}`);
    return { ok: true, message: "تم حفظ صلاحيات البوابة" };
  });
}

const depSchema = z.object({
  id: zf.optionalUuid(), project_id: zf.uuid("المشروع"),
  environment: z.enum(["production", "staging", "testing", "other"]), version: zf.optionalText(80), url: zf.optionalUrl(),
  status: z.enum(["planned", "in_progress", "deployed", "failed", "rolled_back"]), scheduled_at: zf.optionalDateTime(), notes: zf.optionalText(2000), client_visible: zf.checkbox(),
});

export async function saveDeploymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveDeployment", async () => {
    const { bos } = await authorize("projects.update");
    const v = parseForm(depSchema, formData);
    await saveDeployment(bos, v.id ?? null, { project_id: v.project_id, environment: v.environment, version: v.version ?? null, url: v.url ?? null, status: v.status, scheduled_at: v.scheduled_at ? new Date(v.scheduled_at).toISOString() : null, notes: v.notes ?? null, client_visible: v.client_visible });
    revalidatePath(`/admin/projects/${v.project_id}`);
    return { ok: true, message: "تم حفظ حالة النشر" };
  });
}

const planSchema = z.object({
  id: zf.optionalUuid(), client_id: zf.uuid("الحساب"), project_id: zf.optionalUuid(), name: zf.required("الاسم", 150),
  status: z.enum(["active", "paused", "expired", "cancelled"]), starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح"), ends_on: zf.optionalDate(),
  monthly_hours: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().min(0).max(10000).nullable()),
  response_hours: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(1).max(720).nullable()),
  includes: zf.optionalText(3000), notes: zf.optionalText(3000),
});

export async function saveSupportPlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveSupportPlan", async () => {
    const { bos } = await authorize("clients.update");
    const v = parseForm(planSchema, formData);
    await saveSupportPlan(bos, v.id ?? null, { client_id: v.client_id, project_id: v.project_id, name: v.name, status: v.status, starts_on: v.starts_on, ends_on: v.ends_on, monthly_hours: v.monthly_hours, response_hours: v.response_hours, includes: v.includes ?? null, notes: v.notes ?? null });
    revalidatePath(`/admin/clients/${v.client_id}`);
    return { ok: true, message: "تم حفظ خطة الصيانة" };
  });
}
