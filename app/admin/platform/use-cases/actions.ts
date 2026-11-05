"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { saveUseCase } from "@/services/yolias/use-cases";

export async function saveUseCaseAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("yolias.use_case", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await saveUseCase(bos, { slug: String(fd.get("slug") ?? "").trim(), status: String(fd.get("status") ?? "draft"), doc: JSON.parse(String(fd.get("doc") ?? "{}")), meta: JSON.parse(String(fd.get("meta") ?? "{}")) });
    revalidatePath("/admin/platform/use-cases");
  });
}
