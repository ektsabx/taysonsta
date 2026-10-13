"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { addUpdate, createIncident, saveComponent, saveSettings } from "@/services/yolias/status";

// Status management (D-181): editing needs platform.manage, checked here on every action.
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function createIncidentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("yolias.status.create", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await createIncident(bos, { kind: s(fd, "kind") === "maintenance" ? "maintenance" : "incident", title: s(fd, "title"), impact: s(fd, "impact"), components: fd.getAll("components").map(String), body: s(fd, "body"), scheduledFor: s(fd, "scheduledFor") || null, scheduledUntil: s(fd, "scheduledUntil") || null });
    revalidatePath("/admin/platform/status");
    return { ok: true };
  });
}

export async function updateIncidentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("yolias.status.update", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await addUpdate(bos, s(fd, "id"), { status: s(fd, "status"), body: s(fd, "body"), impact: s(fd, "impact") || null });
    revalidatePath("/admin/platform/status");
    return { ok: true };
  });
}

export async function componentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("yolias.status.component", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await saveComponent(bos, s(fd, "id"), { name_en: s(fd, "name_en"), name_ar: s(fd, "name_ar"), description_en: s(fd, "description_en"), description_ar: s(fd, "description_ar"), is_public: fd.get("is_public") === "on", check_enabled: fd.get("check_enabled") === "on", sort: Number(s(fd, "sort")) });
    revalidatePath("/admin/platform/status");
    return { ok: true };
  });
}

export async function settingsAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("yolias.status.settings", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const n = (k: string) => Number(s(fd, k));
    await saveSettings(bos, { intervalMinutes: n("intervalMinutes"), failThreshold: n("failThreshold"), queueDegradedMinutes: n("queueDegradedMinutes"), queueOutageMinutes: n("queueOutageMinutes"), failureRateDegraded: n("failureRateDegraded") / 100, failureRateOutage: n("failureRateOutage") / 100, slowMs: n("slowMs") });
    revalidatePath("/admin/platform/status");
    return { ok: true };
  });
}
