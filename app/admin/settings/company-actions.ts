"use server";

import { revalidatePath } from "next/cache";
import { requireBosUserForAction, type BosUser } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { ForbiddenError, ValidationError } from "@/lib/bos/errors";
import { db } from "@/lib/bos/db";
import { getSetting, saveSetting } from "@/lib/bos/settings";
import { audit } from "@/lib/bos/audit";

// Company profile assets: logo and icon (docs/bos/30 §3.1).
function assertAdmin(bos: BosUser) {
  if (!(bos.isSuperAdmin || bos.permissions.get("settings.manage") === "all")) throw new ForbiddenError();
}

const BRAND_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };

async function createBrandUpload(kind: "logo" | "icon", mime: string, size: number) {
  const ext = BRAND_TYPES[mime];
  if (!ext) throw new ValidationError("الصيغ المسموحة: PNG, JPG, WEBP, SVG.");
  if (size <= 0 || size > 2 * 1024 * 1024) throw new ValidationError("الحد الأقصى 2MB.");
  const path = `company/${kind}-${crypto.randomUUID()}.${ext}`;
  const { data, error } = await db().storage.from("bos-files").createSignedUploadUrl(path);
  if (error || !data) throw error ?? new Error("Could not create upload URL");
  return { path, token: data.token };
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
