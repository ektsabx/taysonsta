"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { retryFailedJob } from "@/services/yolias/jobs";

export async function retryJobAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.retryJob", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await retryFailedJob(bos, Number(formData.get("id")));
    revalidatePath("/admin/platform/jobs");
    return { ok: true };
  });
}
