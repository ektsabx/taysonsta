"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { setMessageStatus, setNotifyAddress } from "@/services/yolias/support-messages";

export async function setStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("yolias.supportMessage.status", async () => {
    const { bos } = await authorize("conversations.update");
    const id = String(fd.get("id") ?? "");
    if (!/^[0-9a-f-]{36}$/.test(id)) return { ok: false, error: "Invalid message" };
    await setMessageStatus(bos, id, String(fd.get("status") ?? ""));
    revalidatePath("/admin/support/messages");
    revalidatePath(`/admin/support/messages/${id}`);
    return { ok: true };
  });
}

export async function setNotifyAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("yolias.supportMessage.notify", async () => {
    const { bos } = await authorize("conversations.manage", "all");
    await setNotifyAddress(bos, String(fd.get("email") ?? ""));
    revalidatePath("/admin/support/messages");
    return { ok: true };
  });
}
