"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/bos/auth";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { addMembers, createChannel, deleteMessage, editMessage, getOrCreateDirect, getOrCreateEntityChannel, leaveChannel, listMessages, markRead, postMessage } from "@/services/bos/chat";

export async function fetchMessagesAction(channelId: string, opts: { after?: string; before?: string; parentId?: string | null } = {}) {
  const { bos } = await authorize("chat.read");
  return listMessages(bos, channelId, { ...opts, limit: opts.before ? 50 : 100 });
}

export async function postMessageAction(channelId: string, body: string, parentId: string | null = null, link: { type: string; id: string } | null = null): Promise<ActionState<{ id: string }>> {
  return handleAction("postMessage", async () => {
    const { bos } = await authorize("chat.create");
    const msg = await postMessage(bos, channelId, { body, parentId, linkedEntityType: link?.type ?? null, linkedEntityId: link?.id ?? null });
    return { ok: true, data: { id: msg.id } };
  }, "تعذر إرسال الرسالة.");
}

export async function editMessageAction(messageId: string, body: string): Promise<ActionState> {
  return handleAction("editMessage", async () => {
    const { bos } = await authorize("chat.create");
    await editMessage(bos, messageId, body);
    return { ok: true };
  });
}

export async function deleteMessageAction(messageId: string): Promise<ActionState> {
  return handleAction("deleteMessage", async () => {
    const { bos } = await authorize("chat.read");
    await deleteMessage(bos, messageId);
    return { ok: true };
  });
}

export async function markChannelReadAction(channelId: string): Promise<void> {
  const { bos } = await authorize("chat.read");
  await markRead(bos, channelId);
}

export async function startDirectAction(userId: string): Promise<ActionState> {
  return handleAction("startDirect", async () => {
    const { bos } = await authorize("chat.create");
    const id = await getOrCreateDirect(bos, userId);
    redirect(`/admin/communication/chat/${id}`);
  });
}

export async function discussAction(entityType: "client" | "deal" | "lead", entityId: string): Promise<ActionState> {
  return handleAction("discuss", async () => {
    const { bos } = await authorize("chat.create");
    const id = await getOrCreateEntityChannel(bos, entityType, entityId);
    redirect(`/admin/communication/chat/${id}`);
  });
}

const channelSchema = z.object({
  name: zf.required("اسم القناة", 80),
  description: zf.optionalText(500),
  is_private: zf.checkbox().optional(),
  team_id: zf.optionalUuid(),
  members: z.array(z.string().uuid()).optional(),
});

export async function createChannelAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("createChannel", async () => {
    const { bos } = await authorize("chat.manage");
    const v = parseForm(channelSchema, formData);
    const ch = await createChannel(bos, { name: v.name, description: v.description ?? null, is_private: Boolean(v.is_private), team_id: v.team_id, members: v.members ?? [] });
    redirect(`/admin/communication/chat/${ch.id}`);
  }, "تعذر إنشاء القناة.");
}

export async function addMembersAction(channelId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("addMembers", async () => {
    const { bos } = await authorize("chat.create");
    const v = parseForm(z.object({ members: z.array(z.string().uuid()).min(1, "اختر عضواً واحداً على الأقل") }), formData);
    await addMembers(bos, channelId, v.members);
    revalidatePath(`/admin/communication/chat/${channelId}`);
    return { ok: true, message: "تمت الإضافة" };
  });
}

export async function leaveChannelAction(channelId: string): Promise<ActionState> {
  return handleAction("leaveChannel", async () => {
    const { bos } = await authorize("chat.read");
    await leaveChannel(bos, channelId);
    redirect("/admin/communication/chat");
  });
}
