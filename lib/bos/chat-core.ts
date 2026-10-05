import "server-only";
import { db } from "@/lib/bos/db";

export async function postSystemMessage(channelId: string, body: string, eventId: number | null = null): Promise<void> {
  await db().from("messages").insert({
    channel_id: channelId,
    body,
    is_system: true,
    event_id: eventId,
  });
}

// Sales team channel used for company-wide sales announcements.
export async function ensureTeamChannel(name: string): Promise<string> {
  const client = db();
  const { data: existing } = await client.from("channels").select("id").eq("kind", "team").eq("name", name).is("archived_at", null).maybeSingle();
  if (existing) return existing.id;
  const { data } = await client.from("channels").insert({ kind: "team", name, is_private: false }).select("id").single();
  return data!.id;
}
