"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { setSwitch } from "@/services/yolias/switches";

// Platform switches (D-213). platform.manage (scope all) only; audited.
export async function setSwitchAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("yolias.switch", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await setSwitch(bos, String(fd.get("key") ?? ""), fd.get("on") === "1");
    revalidatePath("/admin/platform/switches");
    revalidatePath("/admin/platform/payments");
    return { ok: true };
  });
}
