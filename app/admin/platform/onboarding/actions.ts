"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { setWelcomeVideo } from "@/services/yolias/onboarding";

// Welcome video (D-199). platform.manage only; audited.
export async function setWelcomeVideoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.setWelcomeVideo", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await setWelcomeVideo(bos, {
      enabled: formData.get("enabled") === "on",
      url: String(formData.get("url") ?? ""),
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
    });
    revalidatePath("/admin/platform/onboarding");
    return { ok: true };
  });
}
