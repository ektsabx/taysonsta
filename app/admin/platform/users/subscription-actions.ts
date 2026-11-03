"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { activateWithoutPayment, cancelSubscription, renewPeriod } from "@/services/yolias/subscriptions-admin";
import { adjustUsage } from "@/services/yolias/usage";

// A workspace's subscription from the user page (D-276). platform.manage only; audited.
export async function subscriptionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.subscription", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const ws = String(formData.get("workspace_id") ?? "");
    if (!/^[0-9a-f-]{36}$/.test(ws)) throw new ValidationError("مساحة عمل غير معروفة.");
    const kind = String(formData.get("kind") ?? "");
    const reason = String(formData.get("reason") ?? "");
    if (kind === "activate") await activateWithoutPayment(bos, ws, { plan: String(formData.get("plan") ?? ""), period: formData.get("period") === "annual" ? "annual" : "monthly", months: Number(formData.get("months")), reason });
    else if (kind === "renew") await renewPeriod(bos, ws, { months: formData.get("months") ? Number(formData.get("months")) : undefined, reason });
    else if (kind === "cancel_end" || kind === "cancel_now") await cancelSubscription(bos, ws, { when: kind === "cancel_now" ? "now" : "end", reason });
    else if (kind === "prospects") await adjustUsage(bos, ws, Number(formData.get("prospects")), reason);
    else throw new ValidationError("إجراء غير معروف.");
    revalidatePath("/admin/platform", "layout");
    return { ok: true };
  });
}
