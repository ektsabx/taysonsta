"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { saveAgentProfile } from "@/services/bos/support-ratings";

export async function agentProfileAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("support.agentProfile", async () => {
    const { bos } = await authorize("conversations.read");
    await saveAgentProfile(bos, { displayName: String(fd.get("displayName") ?? ""), showPhoto: fd.get("showPhoto") === "on" });
    revalidatePath("/admin/support/profile");
    return { ok: true };
  });
}
