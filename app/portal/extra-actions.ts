"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { requirePortalSectionForAction } from "@/lib/bos/portal-auth";
import { portalCreateUpload, portalFinalizeUpload, portalSendSupportMessage } from "@/services/bos/portal-extra";

// Portal extension actions (docs/bos/30 §23). Client id always from the session.
const uuid = /^[0-9a-f-]{36}$/i;

export async function portalStartUploadAction(input: { projectId: string; name: string; size: number; mime: string | null }): Promise<ActionState<{ fileId: string; path: string; token: string }>> {
  return handleAction("portalStartUpload", async () => {
    const p = await requirePortalSectionForAction("upload");
    if (!uuid.test(input.projectId)) throw new ValidationError("اختر المشروع.");
    return { ok: true, data: await portalCreateUpload(p, { projectId: input.projectId, name: String(input.name ?? ""), size: Number(input.size), mime: input.mime ? String(input.mime).slice(0, 200) : null }) };
  });
}

export async function portalFinishUploadAction(fileId: string): Promise<ActionState> {
  return handleAction("portalFinishUpload", async () => {
    const p = await requirePortalSectionForAction("upload");
    if (!uuid.test(fileId)) throw new ValidationError("قيمة غير صالحة.");
    await portalFinalizeUpload(p, fileId);
    revalidatePath("/portal/files");
    return { ok: true, message: "تم رفع الملف" };
  });
}

export async function portalSupportMessageAction(conversationId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  let newId: string | null = null;
  const res = await handleAction("portalSupportMessage", async () => {
    const p = await requirePortalSectionForAction("support");
    if (conversationId && !uuid.test(conversationId)) throw new ValidationError("قيمة غير صالحة.");
    const id = await portalSendSupportMessage(p, { conversationId, subject: String(formData.get("subject") ?? "") || null, body: String(formData.get("body") ?? "") });
    if (!conversationId) newId = id;
    revalidatePath("/portal/support/chat", "layout");
    return { ok: true, message: "تم الإرسال" };
  });
  if (newId) redirect(`/portal/support/chat/${newId}`);
  return res;
}
