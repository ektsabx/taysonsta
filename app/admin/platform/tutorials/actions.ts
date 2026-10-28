"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { moveTutorial, removeTutorial, upsertTutorial } from "@/services/yolias/tutorials";

// Platform videos (owner, 2026-10-28). platform.manage only; audited.
export async function saveTutorialAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.saveTutorial", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const s = (k: string) => String(formData.get(k) ?? "");
    await upsertTutorial(bos, { id: s("id") || null, titleAr: s("title_ar"), titleEn: s("title_en"), descAr: s("desc_ar"), descEn: s("desc_en"), url: s("url"), published: formData.get("published") === "on" });
    revalidatePath("/admin/platform/tutorials");
    return { ok: true };
  });
}

export async function removeTutorialAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.removeTutorial", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await removeTutorial(bos, String(formData.get("id") ?? ""));
    revalidatePath("/admin/platform/tutorials");
    return { ok: true };
  });
}

export async function moveTutorialAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.moveTutorial", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await moveTutorial(bos, String(formData.get("id") ?? ""), formData.get("dir") === "up" ? -1 : 1);
    revalidatePath("/admin/platform/tutorials");
    return { ok: true };
  });
}
