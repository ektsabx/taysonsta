"use server";

import { revalidatePath } from "next/cache";
import { requireBosUserForAction, can } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { ValidationError, ForbiddenError } from "@/lib/bos/errors";
import { getSetting, saveSetting } from "@/lib/bos/settings";
import { deleteMyLocations, locationStatus, recordLocation, setLocationConsent } from "@/services/bos/location";

// Employee location actions (docs/bos/30 §28).
export async function consentAction(grant: boolean, scope: "attendance" | "attendance_tasks"): Promise<ActionState> {
  return handleAction("locationConsent", async () => {
    const bos = await requireBosUserForAction();
    await setLocationConsent(bos, grant, scope === "attendance_tasks" ? "attendance_tasks" : "attendance");
    revalidatePath("/admin/team/locations");
    return { ok: true, message: grant ? "تم تسجيل موافقتك" : "تم سحب الموافقة — لن يُسجّل موقعك بعد الآن" };
  });
}

export async function deleteMyLocationsAction(): Promise<ActionState> {
  return handleAction("deleteMyLocations", async () => {
    const bos = await requireBosUserForAction();
    const n = await deleteMyLocations(bos);
    revalidatePath("/admin/team/locations");
    return { ok: true, message: `حُذف ${n} سجل` };
  });
}

// Whether the clock widget should ask the browser for a position after a work event.
export async function shouldShareLocationAction(): Promise<boolean> {
  try {
    const bos = await requireBosUserForAction();
    const s = await locationStatus(bos);
    return s.enabled && s.consented;
  } catch {
    return false;
  }
}

export async function recordLocationAction(event: "clock_in" | "clock_out" | "task_checkin", latitude: number, longitude: number, accuracy: number | null): Promise<ActionState> {
  return handleAction("recordLocation", async () => {
    const bos = await requireBosUserForAction();
    if (!["clock_in", "clock_out", "task_checkin"].includes(event)) throw new ValidationError("حدث غير صالح.");
    const r = await recordLocation(bos, { event, latitude: Number(latitude), longitude: Number(longitude), accuracy: accuracy == null ? null : Number(accuracy) });
    return { ok: true, message: r.recorded ? "تم تسجيل الموقع" : "لم يُسجّل الموقع" };
  });
}

export async function locationSettingsAction(input: { enabled: boolean; purpose_text: string; retention_days: number; allow_task_checkins: boolean }): Promise<ActionState> {
  return handleAction("locationSettings", async () => {
    const bos = await requireBosUserForAction();
    if (!can(bos, "location.manage")) throw new ForbiddenError();
    const cur = await getSetting("location");
    const text = String(input.purpose_text ?? "").trim();
    if (text.length < 20) throw new ValidationError("اكتب غرض جمع الموقع بوضوح (20 حرفاً على الأقل).");
    // A new purpose text requires fresh consent from everyone.
    const version = text !== cur.purpose_text ? cur.purpose_version + 1 : cur.purpose_version;
    await saveSetting("location", { enabled: !!input.enabled, purpose_text: text, purpose_version: version, retention_days: Number(input.retention_days) || 90, allow_task_checkins: !!input.allow_task_checkins }, bos.userId);
    revalidatePath("/admin/team/locations");
    return { ok: true, message: version !== cur.purpose_version ? "تم الحفظ — نص الغرض تغيّر وسيُطلب من الموظفين الموافقة مجدداً" : "تم الحفظ" };
  });
}
