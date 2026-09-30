import "server-only";
import { db } from "@/lib/bos/db";

// Project channels are created automatically (docs/bos/14) and their
// membership mirrors project_members.
export async function ensureProjectChannel(projectId: string, actorId: string | null): Promise<string | null> {
  const client = db();
  const { data: existing } = await client
    .from("channels")
    .select("id")
    .eq("project_id", projectId)
    .eq("kind", "project")
    .eq("client_visible", false)
    .maybeSingle();

  let channelId = existing?.id ?? null;

  if (!channelId) {
    const { data: project } = await client.from("projects").select("name, project_number, client_id").eq("id", projectId).maybeSingle();
    if (!project) return null;
    const { data: created, error } = await client
      .from("channels")
      .insert({
        kind: "project",
        name: `${project.project_number} · ${project.name}`,
        project_id: projectId,
        client_id: project.client_id,
        is_private: true,
        created_by: actorId,
      })
      .select("id")
      .single();
    if (error) {
      // Lost a race with a concurrent creation: reuse the winner.
      const { data: again } = await client.from("channels").select("id").eq("project_id", projectId).eq("kind", "project").eq("client_visible", false).maybeSingle();
      channelId = again?.id ?? null;
    } else {
      channelId = created.id;
    }
  }

  if (channelId) {
    await syncProjectChannelMembers(projectId, channelId);
  }
  return channelId;
}

export async function syncProjectChannelMembers(projectId: string, channelId: string): Promise<void> {
  const client = db();
  const { data: members } = await client.from("project_members").select("user_id").eq("project_id", projectId);
  const { data: project } = await client.from("projects").select("pm_id").eq("id", projectId).maybeSingle();
  const ids = new Set((members ?? []).map((m) => m.user_id));
  if (project?.pm_id) ids.add(project.pm_id);
  if (!ids.size) return;
  await client
    .from("channel_members")
    .upsert([...ids].map((user_id) => ({ channel_id: channelId, user_id })), { onConflict: "channel_id,user_id", ignoreDuplicates: true });
}

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
