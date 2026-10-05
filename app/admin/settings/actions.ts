"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import type { PermissionKey } from "@/lib/bos/permissions";
import { ValidationError } from "@/lib/bos/errors";
import { getSetting, settingSchemas, type SettingKey } from "@/lib/bos/settings";
import { configTables } from "@/lib/bos/config-tables";
import { sectionDelegates, settingKeySection, tableSection } from "@/lib/bos/settings-delegation";
import { ForbiddenError } from "@/lib/bos/errors";
import { requireBosUserForAction } from "@/lib/bos/auth";
import {
  addSubscription, archiveRole, cloneRole, deleteSubscription, removeConfigRow, saveConfigRow, savePipelineStages, saveRole,
  saveSettingSection, setRolePermission, setSubscriptionActive, setUserOverride, type StageInput,
} from "@/services/bos/settings-admin";

// settings.manage (all) or the section's delegate permission (all).
async function authorizeSection(section: string | undefined, fallback: PermissionKey = "settings.manage") {
  const bos = await requireBosUserForAction();
  const delegate = section ? sectionDelegates[section] : undefined;
  if (bos.permissions.get(fallback) === "all" || (delegate && bos.permissions.get(delegate) === "all")) return { bos };
  throw new ForbiddenError();
}

function refresh() {
  revalidatePath("/admin", "layout");
}

// Objects merge key by key; arrays and scalars replace.
function deepMerge(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch ?? {})) {
    const b = out[k];
    out[k] = v && typeof v === "object" && !Array.isArray(v) && b && typeof b === "object" && !Array.isArray(b) ? deepMerge(b as Record<string, unknown>, v as Record<string, unknown>) : v;
  }
  return out;
}

function parse(json: string) {
  try {
    return JSON.parse(json);
  } catch {
    throw new ValidationError("بيانات غير صالحة.");
  }
}

export async function saveSettingAction(key: string, json: string): Promise<ActionState> {
  return handleAction("saveSetting", async () => {
    if (!(key in settingSchemas)) throw new ValidationError("قسم إعدادات غير معروف.");
    const { bos } = await authorizeSection(settingKeySection[key]);
    const current = (await getSetting(key as SettingKey)) as unknown as Record<string, unknown>;
    await saveSettingSection(bos, key as SettingKey, deepMerge(current, parse(json)));
    refresh();
    return { ok: true, message: "تم حفظ الإعدادات" };
  }, "تعذر حفظ الإعدادات.");
}

export async function saveConfigRowAction(tableKey: string, id: string | null, json: string): Promise<ActionState> {
  return handleAction("saveConfigRow", async () => {
    if (!configTables[tableKey]) throw new ValidationError("جدول غير معروف.");
    const { bos } = await authorizeSection(tableSection[tableKey]);
    await saveConfigRow(bos, tableKey, id, parse(json));
    refresh();
    return { ok: true, message: "تم الحفظ" };
  }, "تعذر الحفظ.");
}

export async function removeConfigRowAction(tableKey: string, id: string): Promise<ActionState> {
  return handleAction("removeConfigRow", async () => {
    if (!configTables[tableKey]) throw new ValidationError("جدول غير معروف.");
    const { bos } = await authorizeSection(tableSection[tableKey]);
    const mode = await removeConfigRow(bos, tableKey, id);
    refresh();
    return { ok: true, message: mode === "deleted" ? "تم الحذف" : "السجل مستخدم — تم تعطيله/أرشفته بدلاً من الحذف" };
  });
}

export async function savePipelineStagesAction(pipelineId: string, json: string): Promise<ActionState> {
  return handleAction("savePipelineStages", async () => {
    const { bos } = await authorizeSection("pipeline");
    await savePipelineStages(bos, pipelineId, parse(json) as StageInput[]);
    refresh();
    return { ok: true, message: "تم حفظ المراحل" };
  }, "تعذر حفظ المراحل.");
}

export async function saveRoleAction(id: string | null, json: string): Promise<ActionState> {
  return handleAction("saveRole", async () => {
    const { bos } = await authorize("roles.manage", "all");
    const v = parse(json) as { key: string; name: string; description: string | null; sort_order: number };
    await saveRole(bos, id, { key: String(v.key ?? "").trim(), name: String(v.name ?? "").trim(), description: v.description || null, sort_order: Number(v.sort_order) || 0 });
    refresh();
    return { ok: true, message: "تم حفظ الدور" };
  }, "تعذر حفظ الدور.");
}

export async function cloneRoleAction(sourceId: string, key: string, name: string): Promise<ActionState> {
  return handleAction("cloneRole", async () => {
    const { bos } = await authorize("roles.manage", "all");
    await cloneRole(bos, sourceId, key.trim(), name.trim());
    refresh();
    return { ok: true, message: "تم نسخ الدور مع صلاحياته" };
  }, "تعذر نسخ الدور.");
}

export async function archiveRoleAction(id: string, archived: boolean): Promise<ActionState> {
  return handleAction("archiveRole", async () => {
    const { bos } = await authorize("roles.manage", "all");
    await archiveRole(bos, id, archived);
    refresh();
    return { ok: true, message: archived ? "تمت الأرشفة" : "تمت الاستعادة" };
  });
}

export async function setRolePermissionAction(roleId: string, permissionId: string, scope: string): Promise<ActionState> {
  return handleAction("setRolePermission", async () => {
    const { bos } = await authorize("roles.manage", "all");
    await setRolePermission(bos, roleId, permissionId, (scope || null) as "own" | null);
    revalidatePath("/admin/settings/permissions");
    return { ok: true };
  });
}

export async function setUserOverrideAction(userId: string, permissionId: string, effect: string, scope: string, reason: string): Promise<ActionState> {
  return handleAction("setUserOverride", async () => {
    const { bos } = await authorize("users.manage", "all");
    await setUserOverride(bos, userId, permissionId, (effect || null) as "grant" | null, (scope || null) as "own" | null, reason || null);
    revalidatePath("/admin/settings/permissions");
    return { ok: true, message: "تم الحفظ" };
  });
}

export async function addSubscriptionAction(json: string): Promise<ActionState> {
  return handleAction("addSubscription", async () => {
    const { bos } = await authorize("settings.manage", "all");
    await addSubscription(bos, parse(json));
    revalidatePath("/admin/settings/notifications");
    return { ok: true, message: "تمت إضافة الاشتراك" };
  }, "تعذر الإضافة.");
}

export async function toggleSubscriptionAction(id: string, active: boolean): Promise<ActionState> {
  return handleAction("toggleSubscription", async () => {
    const { bos } = await authorize("settings.manage", "all");
    await setSubscriptionActive(bos, id, active);
    revalidatePath("/admin/settings/notifications");
    return { ok: true };
  });
}

export async function deleteSubscriptionAction(id: string): Promise<ActionState> {
  return handleAction("deleteSubscription", async () => {
    const { bos } = await authorize("settings.manage", "all");
    await deleteSubscription(bos, id);
    revalidatePath("/admin/settings/notifications");
    return { ok: true };
  });
}

// "Test connection": verifies the provider configuration is present server-side
// (secrets live in environment variables, never in the database).
export async function testIntegrationAction(name: string): Promise<ActionState> {
  return handleAction("testIntegration", async () => {
    await authorize("settings.manage", "all");
    const env: Record<string, string[]> = {
      email: ["EMAIL_PROVIDER_API_KEY"],
      payment: ["PAYMENT_PROVIDER_SECRET"],
      esign: ["ESIGN_API_KEY"],
      whatsapp: ["WHATSAPP_API_TOKEN"],
      push: ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"],
      scheduler: ["CRON_SECRET"],
      calendar: ["GOOGLE_CALENDAR_CREDENTIALS"],
      storage: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    };
    const missing = (env[name] ?? []).filter((k) => !process.env[k]);
    return missing.length ? { ok: false, error: `غير مُعد: متغيرات البيئة الناقصة ${missing.join("، ")}` } : { ok: true, message: "الإعداد موجود على الخادم ✓" };
  });
}
