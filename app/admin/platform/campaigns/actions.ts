"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { pauseCampaign } from "@/services/yolias/campaign-ops";

// Campaign operations (audit 2026-11-03): pause a running campaign. platform.manage only; audited.
export async function pauseCampaignAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.campaign.pause", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await pauseCampaign(bos, String(formData.get("id") ?? ""), String(formData.get("reason") ?? ""));
    revalidatePath("/admin/platform/campaigns");
    return { ok: true };
  });
}
