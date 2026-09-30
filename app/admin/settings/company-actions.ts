"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireBosUserForAction, type BosUser } from "@/lib/bos/auth";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { ForbiddenError, ValidationError } from "@/lib/bos/errors";
import { db } from "@/lib/bos/db";
import { getSetting, saveSetting } from "@/lib/bos/settings";
import { audit } from "@/lib/bos/audit";
import { createBrandUpload, grantBranchAccess, removeBranch, saveBranch, setEmployeeBranch, setHeadOffice } from "@/services/bos/branches";

// Company profile assets and branches (docs/bos/30 §3.1–3.2).
function assertAdmin(bos: BosUser) {
  if (!(bos.isSuperAdmin || bos.permissions.get("settings.manage") === "all" || bos.permissions.get("branches.manage") === "all")) throw new ForbiddenError();
}

const branchSchema = z.object({
  id: zf.optionalUuid(),
  code: zf.required("الكود", 20),
  name: zf.required("الاسم", 150),
  name_en: zf.optionalText(150),
  status: z.enum(["active", "inactive"]).default("active"),
  address: zf.optionalText(500),
  country: zf.optionalText(100),
  region: zf.optionalText(100),
  city: zf.optionalText(100),
  postal_code: zf.optionalText(20),
  timezone: zf.required("المنطقة الزمنية", 64),
  currency: z.preprocess((v) => (v === "" ? null : v), zf.currency().nullable()),
  phone: zf.optionalText(50),
  email: zf.optionalEmail(),
  manager_employee_id: zf.optionalUuid(),
  work_schedule_id: zf.optionalUuid(),
  notes: zf.optionalText(2000),
});

export async function saveBranchAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveBranch", async () => {
    const bos = await requireBosUserForAction();
    assertAdmin(bos);
    const v = parseForm(branchSchema, formData);
    await saveBranch(bos, v.id, { code: v.code, name: v.name, name_en: v.name_en ?? null, status: v.status, address: v.address ?? null, country: v.country ?? null, region: v.region ?? null, city: v.city ?? null, postal_code: v.postal_code ?? null, timezone: v.timezone, currency: v.currency, phone: v.phone ?? null, email: v.email ?? null, manager_employee_id: v.manager_employee_id, work_schedule_id: v.work_schedule_id, notes: v.notes ?? null });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "تم حفظ الفرع" };
  }, "تعذر حفظ الفرع.");
}

export async function branchStepAction(id: string, step: "head_office" | "remove"): Promise<ActionState> {
  return handleAction("branchStep", async () => {
    const bos = await requireBosUserForAction();
    assertAdmin(bos);
    if (step === "head_office") {
      await setHeadOffice(bos, id);
      revalidatePath("/admin", "layout");
      return { ok: true, message: "أصبح المقر الرئيسي" };
    }
    const r = await removeBranch(bos, id);
    revalidatePath("/admin", "layout");
    return { ok: true, message: r === "deleted" ? "تم حذف الفرع" : "الفرع مستخدم — تم تعطيله للحفاظ على السجلات" };
  });
}

export async function branchAccessAction(userId: string, branchId: string, grant: boolean): Promise<ActionState> {
  return handleAction("branchAccess", async () => {
    const bos = await requireBosUserForAction();
    assertAdmin(bos);
    await grantBranchAccess(bos, userId, branchId, grant);
    revalidatePath("/admin/settings/branches");
    return { ok: true, message: grant ? "تم منح الوصول" : "تم سحب الوصول" };
  });
}

export async function setEmployeeBranchAction(employeeId: string, branchId: string): Promise<ActionState> {
  return handleAction("setEmployeeBranch", async () => {
    const bos = await requireBosUserForAction();
    if (!(bos.isSuperAdmin || bos.permissions.get("employees.update") === "all")) throw new ForbiddenError();
    await setEmployeeBranch(bos, employeeId, branchId);
    revalidatePath(`/admin/team/employees/${employeeId}`);
    return { ok: true, message: "تم نقل الموظف للفرع" };
  });
}

export async function createBrandUploadAction(kind: "logo" | "icon", mime: string, size: number): Promise<ActionState<{ path: string; token: string }>> {
  return handleAction("createBrandUpload", async () => {
    const bos = await requireBosUserForAction();
    assertAdmin(bos);
    return { ok: true, data: await createBrandUpload(kind, mime, size) };
  }, "تعذر بدء الرفع.");
}

export async function finalizeBrandAction(kind: "logo" | "icon", path: string | null): Promise<ActionState> {
  return handleAction("finalizeBrand", async () => {
    const bos = await requireBosUserForAction();
    assertAdmin(bos);
    if (path !== null) {
      if (!path.startsWith(`company/${kind}-`)) throw new ValidationError("مسار غير صالح.");
      const name = path.split("/").pop()!;
      const { data: objects } = await db().storage.from("bos-files").list("company", { search: name });
      if (!objects?.some((o) => o.name === name)) throw new ValidationError("لم يكتمل الرفع.");
    }
    const company = await getSetting("company");
    const key = kind === "logo" ? "logo_path" : "icon_path";
    const old = company[key];
    await saveSetting("company", { ...company, [key]: path }, bos.userId);
    if (old && old !== path) await db().storage.from("bos-files").remove([old]);
    await audit({ actorId: bos.userId, action: `company.${kind}_updated`, entityType: "setting", entityId: null, newValue: { [key]: path } });
    revalidatePath("/admin", "layout");
    return { ok: true, message: path ? "تم تحديث الصورة" : "تمت الإزالة" };
  });
}
