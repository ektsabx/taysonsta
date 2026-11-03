"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { setReviewPopup } from "@/services/yolias/popups";

// Popups (D-276). platform.manage only; audited.
export async function setReviewPopupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.setReviewPopup", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await setReviewPopup(bos, { enabled: formData.get("enabled") === "on", url: String(formData.get("url") ?? ""), trigger: String(formData.get("trigger") ?? "") });
    revalidatePath("/admin/platform/popups");
    return { ok: true };
  });
}
