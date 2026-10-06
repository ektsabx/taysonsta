"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { createAnnouncement, sendAnnouncement, setEmailEvent } from "@/services/yolias/emails";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function createAnnouncementAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("yolias.createAnnouncement", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await createAnnouncement(bos, {
      type: str(fd, "type"), title_en: str(fd, "title_en"), body_en: str(fd, "body_en"), title_ar: str(fd, "title_ar"), body_ar: str(fd, "body_ar"),
      cta_label_en: str(fd, "cta_label_en"), cta_label_ar: str(fd, "cta_label_ar"), cta_url: str(fd, "cta_url"), audience: str(fd, "audience"),
    });
    revalidatePath("/admin/platform/emails");
    return { ok: true };
  });
}

export async function sendAnnouncementAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("yolias.sendAnnouncement", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const id = str(fd, "id");
    if (/^[0-9a-f-]{36}$/.test(id)) await sendAnnouncement(bos, id);
    revalidatePath("/admin/platform/emails");
    return { ok: true };
  });
}

export async function setEmailEventAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("yolias.setEmailEvent", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await setEmailEvent(bos, str(fd, "kind"), fd.get("email") === "on", fd.get("in_app") === "on");
    revalidatePath("/admin/platform/emails");
    return { ok: true };
  });
}
