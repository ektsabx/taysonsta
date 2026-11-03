"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { addGeoPrompt, deleteGeoPrompt, setGeoPromptActive, startGeoRun } from "@/services/yolias/geo";

// GEO tracking (D-277). platform.manage only; audited.
const PATH = "/admin/platform/seo/geo";

export async function addGeoPromptAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.geo.addPrompt", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await addGeoPrompt(bos, { text: String(formData.get("text") ?? ""), lang: String(formData.get("lang") ?? "en"), topic: String(formData.get("topic") ?? "") });
    revalidatePath(PATH);
    return { ok: true };
  });
}

export async function toggleGeoPromptAction(formData: FormData): Promise<void> {
  const { bos } = await authorize("platform.manage", "all");
  await setGeoPromptActive(bos, String(formData.get("id")), formData.get("active") === "1");
  revalidatePath(PATH);
}

export async function deleteGeoPromptAction(formData: FormData): Promise<void> {
  const { bos } = await authorize("platform.manage", "all");
  await deleteGeoPrompt(bos, String(formData.get("id")));
  revalidatePath(PATH);
}

export async function startGeoRunAction(): Promise<ActionState> {
  return handleAction("yolias.geo.run", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await startGeoRun(bos);
    revalidatePath(PATH);
    return { ok: true };
  });
}
