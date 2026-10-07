import { nowIso } from "@/lib/bos/clock";
import "server-only";
import { db, type Tables } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { audit } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/bos/errors";

// Internal chat (§40): channels & DMs linked to business records, mentions,
// threads, attachments (files with entity_type "message"), search limited to
// channels the user can access, and system messages for events.

export type Channel = Tables<"channels">;
export type Message = Tables<"messages">;

export const channelKindLabels: Record<string, string> = { direct: "رسائل مباشرة", team: "الفرق", entity: "سجلات مرتبطة" };

// Public team channels are open to all staff; everything else is members-only.
export async function canReadChannel(bos: BosUser, channel: Pick<Channel, "id" | "kind" | "is_private" | "archived_at">) {
  if (!channel.is_private && channel.kind === "team") return true;
  const { data } = await db().from("channel_members").select("user_id").eq("channel_id", channel.id).eq("user_id", bos.userId).maybeSingle();
  if (data) return true;
  return bos.isSuperAdmin && channel.kind !== "direct";
}

export async function getChannel(bos: BosUser, id: string) {
  const { data } = await db().from("channels").select("*").eq("id", id).maybeSingle();
  if (!data) throw new NotFoundError();
  if (!(await canReadChannel(bos, data))) throw new ForbiddenError();
  return data;
}

export async function listChannels(bos: BosUser) {
  const c = db();
  const [{ data: memberships }, { data: publicTeams }] = await Promise.all([
    c.from("channel_members").select("channel_id, last_read_at, muted, channels!inner(*)").eq("user_id", bos.userId).is("channels.archived_at", null),
    c.from("channels").select("*").eq("kind", "team").eq("is_private", false).is("archived_at", null),
  ]);
  const byId = new Map<string, { channel: Channel; lastReadAt: string | null; muted: boolean; member: boolean }>();
  for (const m of memberships ?? []) byId.set(m.channel_id, { channel: m.channels as unknown as Channel, lastReadAt: m.last_read_at, muted: m.muted, member: true });
  for (const t of publicTeams ?? []) if (!byId.has(t.id)) byId.set(t.id, { channel: t, lastReadAt: null, muted: false, member: false });
  const list = [...byId.values()];
  const ids = list.map((x) => x.channel.id);

  // Latest message + unread count per channel.
  const { data: recent } = ids.length ? await c.from("messages").select("channel_id, created_at, author_user_id, body, is_system").in("channel_id", ids).is("deleted_at", null).is("parent_id", null).order("created_at", { ascending: false }).limit(1000) : { data: [] };
  const last = new Map<string, { created_at: string; body: string; is_system: boolean }>();
  const unread = new Map<string, number>();
  for (const m of recent ?? []) {
    if (!last.has(m.channel_id)) last.set(m.channel_id, m);
    const entry = byId.get(m.channel_id)!;
    if (m.author_user_id !== bos.userId && (!entry.lastReadAt || m.created_at > entry.lastReadAt) && entry.member) unread.set(m.channel_id, (unread.get(m.channel_id) ?? 0) + 1);
  }

  // DM display names: the other participant.
  const dmIds = list.filter((x) => x.channel.kind === "direct").map((x) => x.channel.id);
  const { data: dmMembers } = dmIds.length ? await c.from("channel_members").select("channel_id, user_id").in("channel_id", dmIds).neq("user_id", bos.userId) : { data: [] };
  const { data: emps } = await c.from("employees").select("user_id, full_name").not("user_id", "is", null);
  const nameOf = new Map((emps ?? []).map((e) => [e.user_id as string, e.full_name]));

  return list
    .map((x) => ({
      ...x,
      displayName: x.channel.kind === "direct" ? (dmMembers ?? []).filter((m) => m.channel_id === x.channel.id).map((m) => nameOf.get(m.user_id) ?? "—").join("، ") || "أنا" : x.channel.name,
      lastMessage: last.get(x.channel.id) ?? null,
      unread: unread.get(x.channel.id) ?? 0,
    }))
    .sort((a, b) => (b.lastMessage?.created_at ?? b.channel.created_at).localeCompare(a.lastMessage?.created_at ?? a.channel.created_at));
}

export async function getOrCreateDirect(bos: BosUser, otherUserId: string) {
  if (otherUserId === bos.userId) throw new ValidationError("لا يمكن مراسلة نفسك.");
  const { data: other } = await db().from("employees").select("user_id, full_name, lifecycle_status").eq("user_id", otherUserId).maybeSingle();
  if (!other) throw new ValidationError("المستخدم غير موجود.");
  const key = [bos.userId, otherUserId].sort().join(":");
  const { data: existing } = await db().from("channels").select("id").eq("direct_key", key).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await db().from("channels").insert({ kind: "direct", name: "DM", direct_key: key, is_private: true, created_by: bos.userId }).select("id").single();
  if (error) {
    // Unique pair race: reuse the winner.
    const { data: again } = await db().from("channels").select("id").eq("direct_key", key).single();
    return again!.id;
  }
  await db().from("channel_members").insert([{ channel_id: data.id, user_id: bos.userId }, { channel_id: data.id, user_id: otherUserId }]);
  return data.id;
}

export async function createChannel(bos: BosUser, input: { name: string; description: string | null; is_private: boolean; team_id: string | null; members: string[] }) {
  const { data, error } = await db().from("channels").insert({ kind: "team", name: input.name.trim(), description: input.description, is_private: input.is_private, team_id: input.team_id, created_by: bos.userId }).select("*").single();
  if (error) throw error;
  const members = [...new Set([bos.userId, ...input.members])];
  await db().from("channel_members").insert(members.map((user_id) => ({ channel_id: data.id, user_id })));
  await audit({ actorId: bos.userId, action: "channel.created", entityType: "channel", entityId: data.id, newValue: { name: input.name, is_private: input.is_private, members } });
  return data;
}

// "Discuss" on a client / deal / lead: one internal channel per record.
export async function getOrCreateEntityChannel(bos: BosUser, entityType: "client" | "deal" | "lead", entityId: string) {
  if (!(await canAccessEntity(bos, entityType, entityId))) throw new ForbiddenError();
  const col = entityType === "client" ? "client_id" : entityType === "deal" ? "deal_id" : null;
  let existing: { id: string } | null = null;
  if (col) {
    const { data } = await db().from("channels").select("id").eq("kind", "entity").eq(col, entityId).eq("client_visible", false).is("archived_at", null).maybeSingle();
    existing = data;
  } else {
    const { data } = await db().from("channels").select("id").eq("kind", "entity").eq("direct_key", `lead:${entityId}`).maybeSingle();
    existing = data;
  }
  let id = existing?.id;
  if (!id) {
    const label = await entityLabel(entityType, entityId);
    const { data, error } = await db()
      .from("channels")
      .insert({ kind: "entity", name: label, is_private: true, created_by: bos.userId, ...(col ? { [col]: entityId } : { direct_key: `lead:${entityId}` }) })
      .select("id")
      .single();
    if (error) throw error;
    id = data.id;
  }
  await db().from("channel_members").upsert({ channel_id: id, user_id: bos.userId }, { onConflict: "channel_id,user_id", ignoreDuplicates: true });
  return id;
}

async function entityLabel(type: string, id: string) {
  const c = db();
  if (type === "client") return (await c.from("clients").select("company_name, name").eq("id", id).single()).data?.company_name ?? "Client";
  if (type === "deal") return `Deal · ${(await c.from("deals").select("name").eq("id", id).single()).data?.name ?? ""}`;
  if (type === "lead") return `Lead · ${(await c.from("leads").select("name").eq("id", id).single()).data?.name ?? ""}`;
  return type;
}

export async function addMembers(bos: BosUser, channelId: string, userIds: string[]) {
  const channel = await getChannel(bos, channelId);
  if (channel.kind === "direct") throw new ValidationError("لا يمكن إضافة أعضاء لمحادثة مباشرة.");
  await db().from("channel_members").upsert(userIds.map((user_id) => ({ channel_id: channelId, user_id })), { onConflict: "channel_id,user_id", ignoreDuplicates: true });
  await audit({ actorId: bos.userId, action: "channel.members_added", entityType: "channel", entityId: channelId, newValue: { users: userIds } });
}

export async function leaveChannel(bos: BosUser, channelId: string) {
  const channel = await getChannel(bos, channelId);
  if (channel.kind === "direct") throw new ValidationError("لا يمكن مغادرة هذا النوع من القنوات.");
  await db().from("channel_members").delete().eq("channel_id", channelId).eq("user_id", bos.userId);
}

export async function listMessages(bos: BosUser, channelId: string, opts: { before?: string; after?: string; parentId?: string | null; limit?: number } = {}) {
  await getChannel(bos, channelId);
  let q = db().from("messages").select("*").eq("channel_id", channelId).order("created_at", { ascending: false }).limit(Math.min(opts.limit ?? 50, 200));
  q = opts.parentId ? q.eq("parent_id", opts.parentId) : q.is("parent_id", null);
  if (opts.before) q = q.lt("created_at", opts.before);
  if (opts.after) q = q.gt("created_at", opts.after);
  const { data } = await q;
  const messages = (data ?? []).reverse();
  const ids = messages.map((m) => m.id);
  const [{ data: replies }, { data: files }] = ids.length
    ? await Promise.all([
        db().from("messages").select("parent_id, created_at").in("parent_id", ids).is("deleted_at", null),
        db().from("files").select("id, name, mime_type, size_bytes, entity_id").eq("entity_type", "message").in("entity_id", ids).is("deleted_at", null),
      ])
    : [{ data: [] }, { data: [] }];
  return messages.map((m) => ({
    ...m,
    body: m.deleted_at ? "" : m.body,
    replyCount: (replies ?? []).filter((r) => r.parent_id === m.id).length,
    lastReplyAt: (replies ?? []).filter((r) => r.parent_id === m.id).map((r) => r.created_at).sort().pop() ?? null,
    files: (files ?? []).filter((f) => f.entity_id === m.id),
  }));
}

// "@Full Name" or "@first" mentions resolved against channel-accessible staff.
async function resolveMentions(body: string, channel: Channel): Promise<string[]> {
  if (!body.includes("@")) return [];
  const { data: emps } = await db().from("employees").select("user_id, full_name").not("user_id", "is", null).is("archived_at", null);
  const lower = body.toLowerCase();
  const out = new Set<string>();
  for (const e of emps ?? []) {
    const full = e.full_name.toLowerCase();
    const first = full.split(" ")[0];
    if (lower.includes(`@${full}`) || new RegExp(`@${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "u").test(lower)) out.add(e.user_id as string);
  }
  if (channel.kind === "team" && !channel.is_private) return [...out];
  const { data: members } = await db().from("channel_members").select("user_id").eq("channel_id", channel.id);
  const memberSet = new Set((members ?? []).map((m) => m.user_id));
  return [...out].filter((u) => memberSet.has(u));
}

export async function postMessage(bos: BosUser, channelId: string, input: { body: string; parentId: string | null; linkedEntityType: string | null; linkedEntityId: string | null }) {
  const channel = await getChannel(bos, channelId);
  if (channel.archived_at) throw new ValidationError("القناة مؤرشفة.");
  const body = input.body.trim();
  if (!body || body.length > 10000) throw new ValidationError("الرسالة يجب أن تكون بين 1 و10000 حرف.", { body: "طول غير صالح" });
  if (input.parentId) {
    const { data: parent } = await db().from("messages").select("channel_id, parent_id").eq("id", input.parentId).maybeSingle();
    if (!parent || parent.channel_id !== channelId) throw new ValidationError("الرسالة الأصلية غير موجودة.");
    if (parent.parent_id) input.parentId = parent.parent_id; // single-level threads
  }
  if (input.linkedEntityType && input.linkedEntityId && !(await canAccessEntity(bos, input.linkedEntityType, input.linkedEntityId))) throw new ForbiddenError();
  // Joining a public team channel on first post.
  if (channel.kind === "team" && !channel.is_private) await db().from("channel_members").upsert({ channel_id: channelId, user_id: bos.userId }, { onConflict: "channel_id,user_id", ignoreDuplicates: true });

  const { data: msg, error } = await db()
    .from("messages")
    .insert({ channel_id: channelId, author_user_id: bos.userId, body, parent_id: input.parentId, linked_entity_type: input.linkedEntityType, linked_entity_id: input.linkedEntityId })
    .select("*")
    .single();
  if (error) throw error;
  await db().from("channel_members").update({ last_read_at: msg.created_at }).eq("channel_id", channelId).eq("user_id", bos.userId);

  const mentions = (await resolveMentions(body, channel)).filter((u) => u !== bos.userId);
  if (mentions.length) await db().from("message_mentions").insert(mentions.map((user_id) => ({ message_id: msg.id, user_id })));
  const link = `/admin/communication/chat/${channelId}${input.parentId ? `?thread=${input.parentId}` : ""}`;
  for (const userId of mentions) {
    await emitEvent({ type: "chat.mentioned", entityType: "channel", entityId: channelId, summary: `${bos.employee.full_name} mentioned you: ${body.slice(0, 120)}`, actorId: bos.userId, payload: { message_id: msg.id, assignee_user_id: userId, link }, dedupeKey: `chat.mentioned:${msg.id}:${userId}` });
  }
  // DM + reply notifications (direct_message / reply_to_my_message).
  const { insertNotifications } = await import("@/lib/bos/notify");
  const drafts: Parameters<typeof insertNotifications>[0] = [];
  if (channel.kind === "direct") {
    const { data: others } = await db().from("channel_members").select("user_id, muted").eq("channel_id", channelId).neq("user_id", bos.userId);
    for (const o of others ?? []) if (!o.muted && !mentions.includes(o.user_id)) drafts.push({ userId: o.user_id, eventId: null, channels: ["in_app"], eventType: "chat.direct_message", title: `رسالة من ${bos.employee.full_name}`, body: body.slice(0, 200), link, entityType: "channel", entityId: channelId });
  }
  if (input.parentId) {
    const { data: parent } = await db().from("messages").select("author_user_id").eq("id", input.parentId).single();
    if (parent?.author_user_id && parent.author_user_id !== bos.userId && !mentions.includes(parent.author_user_id)) drafts.push({ userId: parent.author_user_id, eventId: null, channels: ["in_app"], eventType: "chat.reply", title: `${bos.employee.full_name} ردّ على رسالتك`, body: body.slice(0, 200), link, entityType: "channel", entityId: channelId });
  }
  if (drafts.length) await insertNotifications(drafts);
  return msg;
}

export async function editMessage(bos: BosUser, messageId: string, body: string) {
  const { data: msg } = await db().from("messages").select("*").eq("id", messageId).maybeSingle();
  if (!msg || msg.deleted_at) throw new NotFoundError();
  if (msg.author_user_id !== bos.userId) throw new ForbiddenError("يمكنك تعديل رسائلك فقط.");
  const text = body.trim();
  if (!text || text.length > 10000) throw new ValidationError("طول الرسالة غير صالح.");
  await db().from("messages").update({ body: text, edited_at: nowIso() }).eq("id", messageId);
  await audit({ actorId: bos.userId, action: "message.edited", entityType: "channel", entityId: msg.channel_id, oldValue: { body: msg.body }, newValue: { body: text }, metadata: { message_id: messageId } });
}

// Soft delete: placeholder remains, admins keep the audit trail (edge case).
export async function deleteMessage(bos: BosUser, messageId: string) {
  const { data: msg } = await db().from("messages").select("*").eq("id", messageId).maybeSingle();
  if (!msg || msg.deleted_at) throw new NotFoundError();
  if (msg.author_user_id !== bos.userId && !bos.permissions.get("chat.manage")) throw new ForbiddenError();
  await db().from("messages").update({ deleted_at: nowIso() }).eq("id", messageId);
  await audit({ actorId: bos.userId, action: "message.deleted", entityType: "channel", entityId: msg.channel_id, oldValue: { body: msg.body, author: msg.author_user_id }, metadata: { message_id: messageId } });
}

export async function markRead(bos: BosUser, channelId: string) {
  await db().from("channel_members").update({ last_read_at: nowIso() }).eq("channel_id", channelId).eq("user_id", bos.userId);
  await db().from("bos_notifications").update({ read_at: nowIso() }).eq("user_id", bos.userId).eq("entity_type", "channel").eq("entity_id", channelId).is("read_at", null);
}

export async function searchMessages(bos: BosUser, q: string) {
  const text = q.trim();
  if (text.length < 2) return [];
  const channels = await listChannels(bos);
  const ids = channels.map((c) => c.channel.id);
  if (!ids.length) return [];
  const { data } = await db().from("messages").select("id, channel_id, body, created_at, author_user_id, parent_id").in("channel_id", ids).is("deleted_at", null).ilike("body", `%${text.replace(/[%_]/g, " ")}%`).order("created_at", { ascending: false }).limit(50);
  const nameOf = new Map(channels.map((c) => [c.channel.id, c.displayName]));
  return (data ?? []).map((m) => ({ ...m, channelName: nameOf.get(m.channel_id) ?? "" }));
}

export async function totalUnread(bos: BosUser) {
  return (await listChannels(bos)).reduce((s, c) => s + c.unread, 0);
}
