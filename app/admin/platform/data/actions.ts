"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { addSuppression, removeSuppression, resolveDuplicate } from "@/services/yolias/data";

const uuid = /^[0-9a-f-]{36}$/;

export async function addSuppressionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("yolias.addSuppression", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await addSuppression(bos, String(fd.get("kind") ?? ""), String(fd.get("value") ?? ""), String(fd.get("reason") ?? ""));
    revalidatePath("/admin/platform/data");
    return { ok: true };
  });
}

export async function removeSuppressionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("yolias.removeSuppression", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const id = String(fd.get("id") ?? "");
    if (uuid.test(id)) await removeSuppression(bos, id);
    revalidatePath("/admin/platform/data");
    return { ok: true };
  });
}

export async function markDistinctAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("yolias.resolveDuplicate", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const id = String(fd.get("id") ?? "");
    if (uuid.test(id)) await resolveDuplicate(bos, id, "distinct");
    revalidatePath("/admin/platform/data");
    return { ok: true };
  });
}
