"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { adjustUsage, setPlanQuota } from "@/services/yolias/usage";

// Prospect quotas and per-workspace grants (docs/06, D-005). platform.manage only; audited.

export async function setPlanQuotaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.setPlanQuota", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const usd = String(formData.get("price_usd") ?? "").trim();
    await setPlanQuota(bos, String(formData.get("plan") ?? ""), Number(formData.get("prospects")), usd === "" ? undefined : Number(usd));
    revalidatePath("/admin/platform", "layout");
    return { ok: true };
  });
}

export async function adjustUsageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.adjustUsage", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const id = String(formData.get("workspace_id") ?? "");
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new ValidationError("مساحة عمل غير معروفة.");
    await adjustUsage(bos, id, Number(formData.get("prospects")), String(formData.get("reason") ?? ""));
    revalidatePath(`/admin/platform/workspaces/${id}`);
    return { ok: true };
  });
}
