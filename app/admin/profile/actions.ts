"use server";

import { revalidatePath } from "next/cache";
import { requireBosUserForAction } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { syncBosMfaStatus } from "@/services/bos/it-access";

export async function syncMyMfaAction(): Promise<ActionState> {
  return handleAction("syncMyMfa", async () => {
    const bos = await requireBosUserForAction();
    const status = await syncBosMfaStatus(bos.employee.id);
    revalidatePath("/admin/profile");
    return { ok: true, message: status === "enabled" ? "تم تفعيل التحقق بخطوتين" : `الحالة: ${status}` };
  });
}
