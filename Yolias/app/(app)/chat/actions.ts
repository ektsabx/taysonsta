"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { titleFrom } from "@/lib/discovery/launch";

// Yolias AI conversations (final spec phase 7). Members start personal or
// workspace chats and rate replies with their own client (RLS); campaign
// conversations are created by the server with their search.

export async function startConversation(scope: "user" | "workspace"): Promise<void> {
  const session = await requireSession();
  const db = await createClient();
  const { data } = await db.from("conversations").insert({ workspace_id: session.workspace.id, user_id: session.userId, scope }).select("id").single();
  revalidatePath("/chat");
  redirect(data ? `/chat/${data.id}` : "/chat");
}

/** Like (1), dislike (-1) or clear (null) an assistant reply. */
export async function rateReply(messageId: number, rating: 1 | -1 | null): Promise<{ ok: boolean }> {
  const session = await requireSession();
  if (!Number.isInteger(messageId) || messageId <= 0) return { ok: false };
  const db = await createClient();
  const { error } = rating === null
    ? await db.from("agent_feedback").delete().eq("message_id", messageId).eq("user_id", session.userId)
    : await db.from("agent_feedback").upsert({ message_id: messageId, user_id: session.userId, rating }, { onConflict: "message_id,user_id" });
  return { ok: !error };
}

export async function renameConversation(id: string, title: string): Promise<{ ok: boolean }> {
  await requireSession();
  const clean = titleFrom(title);
  if (!clean) return { ok: false };
  const db = await createClient();
  const { error } = await db.from("conversations").update({ title: clean }).eq("id", id);
  revalidatePath("/chat", "layout");
  return { ok: !error };
}

export async function archiveConversation(id: string): Promise<void> {
  await requireSession();
  const db = await createClient();
  await db.from("conversations").update({ archived_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/chat", "layout");
  redirect("/chat");
}
