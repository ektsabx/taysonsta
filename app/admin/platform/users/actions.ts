"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { setUserSuspended } from "@/services/yolias/users";

export async function setSuspendedAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("yolias.setUserSuspended", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const id = String(fd.get("id") ?? "");
    if (!/^[0-9a-f-]{36}$/.test(id)) return { ok: false, error: "Invalid user" };
    await setUserSuspended(bos, id, fd.get("suspend") === "1", String(fd.get("reason") ?? ""));
    revalidatePath("/admin/platform/users");
    return { ok: true };
  });
}
