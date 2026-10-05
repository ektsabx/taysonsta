import "server-only";
import { db, type Tables } from "@/lib/bos/db";
import { can, type BosUser } from "@/lib/bos/auth";
import { audit, recordStatus } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { nowIso, nowMs } from "@/lib/bos/clock";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/bos/errors";
import type { Scope } from "@/lib/bos/permissions";

// Support platform (docs/bos/30 §10.1–10.4, doc 31 Phase 7): customer
// profiles, multi-channel conversations, unified inbox, teams + assignment,
// tickets linked to conversations. Channels: web widget (Phase 8), email
// (outbound via the hub, inbound via signed webhook), WhatsApp/SMS
// (Phase 9), client portal, phone/manual logs.

export type Conversation = Tables<"conversations">;
export type ConversationMessage = Tables<"conversation_messages">;
export type SupportCustomer = Tables<"support_customers">;
export type Channel = Conversation["channel"];
export type ConvStatus = Conversation["status"];

const transitions: Record<ConvStatus, ConvStatus[]> = {
  open: ["pending_customer", "pending_internal", "snoozed", "resolved", "closed"],
  pending_customer: ["open", "pending_internal", "snoozed", "resolved", "closed"],
  pending_internal: ["open", "pending_customer", "snoozed", "resolved", "closed"],
  snoozed: ["open", "pending_customer", "pending_internal", "resolved", "closed"],
  resolved: ["open", "closed"],
  closed: ["open"],
};

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export interface CustomerInput {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  company?: string | null;
  country?: string | null;
  source?: string | null;
  channel?: string | null;
  contact_id?: string | null;
  client_id?: string | null;
  // Channel identities (docs/bos/39 §5).
  messenger_id?: string | null;
  instagram_id?: string | null;
  telegram_id?: string | null;
}

const normEmail = (e?: string | null) => (e ?? "").trim().toLowerCase() || null;
const normPhone = (p?: string | null) => (p ?? "").replace(/[^0-9]/g, "") || null;

// Dedupe on email, then phone; links to an existing CRM contact by email.
export async function findOrCreateCustomer(input: CustomerInput, actorId: string | null = null): Promise<SupportCustomer> {
  const email = normEmail(input.email);
  const phone = normPhone(input.phone ?? input.whatsapp);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError("بريد إلكتروني غير صالح", { email: "غير صالح" });
  const c = db();
  let existing: SupportCustomer | null = null;
  for (const k of ["messenger_id", "instagram_id", "telegram_id"] as const) {
    if (!existing && input[k]) existing = (await c.from("support_customers").select("*").eq(k, input[k]!).is("merged_into", null).limit(1).maybeSingle()).data;
  }
  if (!existing && email) existing = (await c.from("support_customers").select("*").eq("normalized_email", email).is("merged_into", null).limit(1).maybeSingle()).data;
  if (!existing && phone && phone.length >= 7) existing = (await c.from("support_customers").select("*").eq("normalized_phone", phone).is("merged_into", null).limit(1).maybeSingle()).data;
  if (existing) {
    const patch: Partial<Pick<SupportCustomer, "last_seen_at" | "email" | "phone" | "whatsapp" | "company" | "country" | "messenger_id" | "instagram_id" | "telegram_id">> = { last_seen_at: nowIso() };
    if (!existing.email && email) patch.email = email;
    if (!existing.phone && input.phone) patch.phone = input.phone;
    if (!existing.whatsapp && input.whatsapp) patch.whatsapp = input.whatsapp;
    if (!existing.company && input.company) patch.company = input.company;
    if (!existing.country && input.country) patch.country = input.country;
    for (const k of ["messenger_id", "instagram_id", "telegram_id"] as const) if (!existing[k] && input[k]) patch[k] = input[k]!;
    await c.from("support_customers").update(patch).eq("id", existing.id);
    return { ...existing, ...patch } as SupportCustomer;
  }
  let contactId = input.contact_id ?? null;
  let clientId = input.client_id ?? null;
  if (!contactId && email) {
    const { data: ct } = await c.from("contacts").select("id, client_id").ilike("email", email).is("archived_at", null).limit(1).maybeSingle();
    if (ct) {
      contactId = ct.id;
      clientId = clientId ?? ct.client_id;
    }
  }
  const name = (input.name ?? "").trim() || email || input.phone || input.whatsapp || "—";
  const { data, error } = await c
    .from("support_customers")
    .insert({ name: name.slice(0, 200), email, phone: input.phone ?? null, whatsapp: input.whatsapp ?? null, company: input.company ?? null, country: input.country ?? null, source: input.source ?? input.channel ?? "manual", first_channel: input.channel ?? null, messenger_id: input.messenger_id ?? null, instagram_id: input.instagram_id ?? null, telegram_id: input.telegram_id ?? null, contact_id: contactId, client_id: clientId, last_seen_at: nowIso(), created_by: actorId })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateCustomer(bos: BosUser, id: string, patch: Partial<Pick<SupportCustomer, "name" | "email" | "phone" | "whatsapp" | "company" | "country" | "priority" | "tags" | "notes" | "owner_id">>) {
  if (!can(bos, "conversations.update")) throw new ForbiddenError();
  const { data: before } = await db().from("support_customers").select("*").eq("id", id).maybeSingle();
  if (!before) throw new NotFoundError();
  if (patch.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email.trim())) throw new ValidationError("بريد إلكتروني غير صالح", { email: "غير صالح" });
  if (patch.name !== undefined && !patch.name?.trim()) throw new ValidationError("الاسم مطلوب.", { name: "مطلوب" });
  await db().from("support_customers").update(patch).eq("id", id);
  await audit({ actorId: bos.userId, action: "support_customer.updated", entityType: "support_customer", entityId: id, oldValue: before, newValue: patch });
}

export async function linkCustomer(bos: BosUser, id: string, contactId: string | null, clientId: string | null) {
  if (!can(bos, "conversations.update")) throw new ForbiddenError();
  let client = clientId;
  if (contactId) {
    const { data: ct } = await db().from("contacts").select("client_id").eq("id", contactId).maybeSingle();
    if (!ct) throw new ValidationError("جهة الاتصال غير موجودة.");
    client = ct.client_id;
  }
  await db().from("support_customers").update({ contact_id: contactId, client_id: client }).eq("id", id);
  await db().from("conversations").update({ client_id: client }).eq("customer_id", id);
  await audit({ actorId: bos.userId, action: "support_customer.linked", entityType: "support_customer", entityId: id, newValue: { contact_id: contactId, client_id: client } });
}

// Safe merge: the source's conversations and tickets move to the target,
// tags are combined, the source is kept (marked merged) for history.
export async function mergeCustomers(bos: BosUser, sourceId: string, targetId: string) {
  if (!can(bos, "conversations.manage") && !can(bos, "conversations.update", "all")) throw new ForbiddenError();
  if (sourceId === targetId) throw new ValidationError("لا يمكن دمج العميل مع نفسه.");
  const c = db();
  const [{ data: s }, { data: t }] = await Promise.all([c.from("support_customers").select("*").eq("id", sourceId).maybeSingle(), c.from("support_customers").select("*").eq("id", targetId).maybeSingle()]);
  if (!s || !t) throw new NotFoundError();
  if (s.merged_into || t.merged_into) throw new ValidationError("أحد العميلين مدموج بالفعل.");
  const { count: convs } = await c.from("conversations").select("id", { count: "exact", head: true }).eq("customer_id", sourceId);
  await c.from("conversations").update({ customer_id: targetId }).eq("customer_id", sourceId);
  await c.from("tickets").update({ support_customer_id: targetId }).eq("support_customer_id", sourceId);
  await c.from("support_customers").update({
    tags: [...new Set([...t.tags, ...s.tags])],
    email: t.email ?? s.email,
    phone: t.phone ?? s.phone,
    whatsapp: t.whatsapp ?? s.whatsapp,
    company: t.company ?? s.company,
    contact_id: t.contact_id ?? s.contact_id,
    client_id: t.client_id ?? s.client_id,
    notes: [t.notes, s.notes].filter(Boolean).join("\n—\n") || null,
  }).eq("id", targetId);
  await c.from("support_customers").update({ merged_into: targetId, email: null, phone: null }).eq("id", sourceId);
  await audit({ actorId: bos.userId, action: "support_customer.merged", entityType: "support_customer", entityId: targetId, oldValue: s, newValue: { merged_from: sourceId, conversations: convs ?? 0 } });
  return convs ?? 0;
}

export async function duplicateCandidates(id: string) {
  const { data: me } = await db().from("support_customers").select("*").eq("id", id).maybeSingle();
  if (!me) return [];
  const ors = [me.normalized_email ? `normalized_email.eq.${me.normalized_email}` : null, me.normalized_phone ? `normalized_phone.eq.${me.normalized_phone}` : null, `name.ilike.${me.name.replace(/[,()%]/g, " ")}`].filter(Boolean).join(",");
  const { data } = await db().from("support_customers").select("id, name, email, phone, company").neq("id", id).is("merged_into", null).or(ors).limit(10);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Teams & assignment
// ---------------------------------------------------------------------------

export async function listTeams() {
  const { data } = await db().from("support_teams").select("*, support_team_members(user_id, role, max_open, is_available)").order("name");
  return data ?? [];
}

async function defaultTeamId(): Promise<string | null> {
  const { data } = await db().from("support_teams").select("id").eq("is_default", true).eq("is_active", true).maybeSingle();
  return data?.id ?? null;
}

// Least busy (fewest open conversations, under the member's limit) or
// round robin (least recently assigned) among available members.
export async function pickAgent(teamId: string): Promise<string | null> {
  const c = db();
  const { data: team } = await c.from("support_teams").select("assignment, is_active").eq("id", teamId).maybeSingle();
  if (!team?.is_active || team.assignment === "manual") return null;
  const { data: members } = await c.from("support_team_members").select("user_id, max_open, is_available, last_assigned_at").eq("team_id", teamId).eq("is_available", true);
  if (!members?.length) return null;
  const { data: staff } = await c.from("employees").select("user_id").in("user_id", members.map((m) => m.user_id)).in("lifecycle_status", ["active", "onboarding"]);
  const active = new Set((staff ?? []).map((s) => s.user_id));
  const pool = members.filter((m) => active.has(m.user_id));
  if (!pool.length) return null;
  const { data: open } = await c.from("conversations").select("assignee_id").in("assignee_id", pool.map((m) => m.user_id)).not("status", "in", "(resolved,closed)");
  const load = new Map(pool.map((m) => [m.user_id, 0]));
  for (const o of open ?? []) if (o.assignee_id) load.set(o.assignee_id, (load.get(o.assignee_id) ?? 0) + 1);
  const eligible = pool.filter((m) => (load.get(m.user_id) ?? 0) < m.max_open);
  if (!eligible.length) return null;
  const chosen =
    team.assignment === "round_robin"
      ? [...eligible].sort((a, b) => new Date(a.last_assigned_at ?? 0).getTime() - new Date(b.last_assigned_at ?? 0).getTime())[0]
      : [...eligible].sort((a, b) => (load.get(a.user_id) ?? 0) - (load.get(b.user_id) ?? 0) || new Date(a.last_assigned_at ?? 0).getTime() - new Date(b.last_assigned_at ?? 0).getTime())[0];
  await c.from("support_team_members").update({ last_assigned_at: nowIso() }).eq("team_id", teamId).eq("user_id", chosen.user_id);
  return chosen.user_id;
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

async function assertAccess(bos: BosUser, conv: Pick<Conversation, "assignee_id" | "team_id" | "client_id">) {
  const scope = bos.permissions.get("conversations.read");
  if (!scope) throw new ForbiddenError();
  if (scope === "all" || bos.isSuperAdmin) return;
  if (conv.assignee_id === bos.userId) return;
  if (conv.team_id) {
    const { data } = await db().from("support_team_members").select("user_id").eq("team_id", conv.team_id).eq("user_id", bos.userId).maybeSingle();
    if (data) return;
  }
  if (conv.client_id) {
    const { data } = await db().from("clients").select("account_manager_id").eq("id", conv.client_id).maybeSingle();
    if (data?.account_manager_id === bos.userId) return;
  }
  throw new ForbiddenError();
}

export interface InboxFilters {
  status?: string;
  channel?: string;
  who?: "me" | "unassigned" | "all";
  team?: string;
  priority?: string;
  q?: string;
  customer?: string;
  // Spam folder (docs/bos/37 §3): spam is hidden from every other view.
  spam?: boolean;
}

export async function listConversations(bos: BosUser, scope: Scope, f: InboxFilters, limit = 100) {
  let q = db().from("conversations").select("*, support_customers(id, name, email, phone, company, country)").order("last_message_at", { ascending: false }).limit(limit);
  q = f.spam ? q.not("spam_at", "is", null) : q.is("spam_at", null);
  if (f.spam) {
    if (f.status && f.status !== "all" && f.status !== "active") q = q.eq("status", f.status as ConvStatus);
  } else if (f.status === "active" || !f.status) q = q.in("status", ["open", "pending_customer", "pending_internal", "snoozed"]);
  else if (f.status !== "all") q = q.eq("status", f.status as ConvStatus);
  if (f.channel) q = q.eq("channel", f.channel as Channel);
  if (f.who === "me") q = q.eq("assignee_id", bos.userId);
  else if (f.who === "unassigned") q = q.is("assignee_id", null);
  if (f.team) q = q.eq("team_id", f.team);
  if (f.priority) q = q.eq("priority", f.priority as Conversation["priority"]);
  if (f.customer) q = q.eq("customer_id", f.customer);
  if (f.q?.trim()) {
    const term = f.q.trim().replace(/[,()%]/g, " ");
    const { data: custs } = await db().from("support_customers").select("id").or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,company.ilike.%${term}%`).limit(200);
    const ids = (custs ?? []).map((x) => x.id);
    q = q.or([`subject.ilike.%${term}%`, `number.ilike.%${term}%`, ids.length ? `customer_id.in.(${ids.join(",")})` : null].filter(Boolean).join(","));
  }
  if (scope !== "all" && !bos.isSuperAdmin) {
    const { data: teams } = await db().from("support_team_members").select("team_id").eq("user_id", bos.userId);
    const teamIds = (teams ?? []).map((t) => t.team_id);
    q = q.or([`assignee_id.eq.${bos.userId}`, teamIds.length ? `team_id.in.(${teamIds.join(",")})` : null].filter(Boolean).join(","));
  }
  const { data } = await q;
  return data ?? [];
}

export async function getConversation(bos: BosUser, id: string) {
  const { data: conv } = await db().from("conversations").select("*").eq("id", id).maybeSingle();
  if (!conv) throw new NotFoundError();
  await assertAccess(bos, conv);
  const c = db();
  const [{ data: messages }, { data: customer }, { data: ticket }] = await Promise.all([
    c.from("conversation_messages").select("*").eq("conversation_id", id).order("created_at"),
    c.from("support_customers").select("*").eq("id", conv.customer_id).single(),
    conv.ticket_id ? c.from("tickets").select("id, ticket_number, status, subject").eq("id", conv.ticket_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (conv.unread_for_agent && conv.assignee_id === bos.userId) await c.from("conversations").update({ unread_for_agent: 0 }).eq("id", id);
  return { conversation: conv, messages: messages ?? [], customer: customer!, ticket };
}

export async function addMessage(conv: Pick<Conversation, "id" | "channel">, m: { direction: ConversationMessage["direction"]; author_kind: ConversationMessage["author_kind"]; author_user_id?: string | null; body: string; external_id?: string | null; attachments?: unknown[]; delivery_status?: ConversationMessage["delivery_status"]; delivery_error?: string | null; ai_sources?: unknown }) {
  const { data, error } = await db()
    .from("conversation_messages")
    .insert({ conversation_id: conv.id, channel: conv.channel, direction: m.direction, author_kind: m.author_kind, author_user_id: m.author_user_id ?? null, body: m.body, external_id: m.external_id ?? null, attachments: (m.attachments ?? []) as never, delivery_status: m.delivery_status ?? null, delivery_error: m.delivery_error ?? null, ai_sources: (m.ai_sources ?? null) as never })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") return null; // same provider message twice → idempotent
    throw error;
  }
  return data;
}

export interface NewConversationInput {
  customer: CustomerInput;
  channel: Channel;
  subject: string | null;
  body: string;
  priority?: Conversation["priority"];
  team_id?: string | null;
  assignee_id?: string | null;
}

// Staff-created conversation (phone call log, email typed in, etc.).
export async function createConversation(bos: BosUser, input: NewConversationInput) {
  if (!can(bos, "conversations.create")) throw new ForbiddenError();
  if (!input.body.trim()) throw new ValidationError("نص الرسالة مطلوب.", { body: "مطلوب" });
  if (input.body.length > 20_000) throw new ValidationError("الرسالة طويلة جداً.", { body: "طويلة جداً" });
  if (!input.customer.email && !input.customer.phone && !input.customer.whatsapp && !input.customer.name) throw new ValidationError("أدخل اسم العميل أو بريده أو هاتفه.");
  const customer = await findOrCreateCustomer({ ...input.customer, channel: input.channel, source: input.customer.source ?? "manual" }, bos.userId);
  const conv = await openConversation({ customer, channel: input.channel, subject: input.subject, priority: input.priority ?? customer.priority as Conversation["priority"], team_id: input.team_id ?? null, assignee_id: input.assignee_id ?? null, actorId: bos.userId });
  await addMessage(conv, { direction: "inbound", author_kind: "customer", body: input.body.trim() });
  await db().from("conversations").update({ last_customer_message_at: nowIso(), last_message_at: nowIso() }).eq("id", conv.id);
  return conv;
}

// Options a channel can set when it opens a conversation (Phase 8 widget:
// its team, the AI agent answering first — then nobody is assigned until
// the agent hands off).
export interface OpenOptions { team_id?: string | null; widget_id?: string | null; ai_agent_id?: string | null; ai_active?: boolean }

async function openConversation(o: { customer: SupportCustomer; channel: Channel; subject: string | null; priority: Conversation["priority"]; team_id: string | null; assignee_id: string | null; external_thread_id?: string | null; actorId: string | null; extra?: OpenOptions }) {
  const teamId = o.team_id ?? o.extra?.team_id ?? (await defaultTeamId());
  const assignee = o.assignee_id ?? (teamId && !o.extra?.ai_active ? await pickAgent(teamId) : null);
  const { data: conv, error } = await db()
    .from("conversations")
    .insert({ customer_id: o.customer.id, channel: o.channel, subject: o.subject?.trim().slice(0, 300) || null, priority: o.priority, team_id: teamId, assignee_id: assignee, client_id: o.customer.client_id, external_thread_id: o.external_thread_id ?? null, created_by: o.actorId, unread_for_agent: 1, widget_id: o.extra?.widget_id ?? null, ai_agent_id: o.extra?.ai_active ? o.extra.ai_agent_id ?? null : null, ai_active: !!o.extra?.ai_active })
    .select("*")
    .single();
  if (error) throw error;
  await recordStatus("conversation", conv.id, null, "open", o.actorId);
  await emitEvent({ type: "conversation.created", entityType: "conversation", entityId: conv.id, summary: `Conversation ${conv.number}${conv.subject ? `: ${conv.subject}` : ""}`, actorId: o.actorId, actorType: o.actorId ? "user" : "system", payload: { title: conv.subject ?? o.customer.name, channel: o.channel, customer_id: o.customer.id, client_id: o.customer.client_id, assignee_user_id: assignee, team_id: teamId }, links: [{ type: "client", id: o.customer.client_id }] });
  if (assignee) await emitEvent({ type: "conversation.assigned", entityType: "conversation", entityId: conv.id, summary: `Conversation assigned: ${conv.number}`, actorId: o.actorId, payload: { title: conv.subject ?? o.customer.name, assignee_user_id: assignee } });
  return conv;
}

// Inbound from a channel (email webhook now; widget / WhatsApp later).
// Idempotent on the provider message id; threads by conversation number in
// the subject ([CV-000123]) or by the channel's thread id.
export async function receiveInbound(input: { channel: Channel; customer: CustomerInput; subject?: string | null; body: string; external_message_id?: string | null; external_thread_id?: string | null; attachments?: unknown[]; open?: OpenOptions; customer_id?: string | null; threadOnly?: boolean }) {
  const body = input.body.trim().slice(0, 50_000);
  if (!body) return null;
  const c = db();
  const known = input.customer_id ? (await c.from("support_customers").select("*").eq("id", input.customer_id).maybeSingle()).data : null;
  const customer = known ?? (await findOrCreateCustomer({ ...input.customer, channel: input.channel, source: input.channel }));
  let conv: Conversation | null = null;
  // threadOnly (web widget): a visitor only ever continues its own session's
  // thread — typing someone else's email must not reveal their conversations.
  const token = input.threadOnly ? undefined : /\[(CV-\d{6,})\]/.exec(input.subject ?? "")?.[1];
  if (token) conv = (await c.from("conversations").select("*").eq("number", token).maybeSingle()).data;
  if (conv && conv.customer_id !== customer.id) {
    // A reply from another address to a known thread: accept only if it links to the same CRM contact/client.
    const { data: owner } = await c.from("support_customers").select("client_id").eq("id", conv.customer_id).maybeSingle();
    if (!owner?.client_id || owner.client_id !== customer.client_id) conv = null;
  }
  if (!conv && input.external_thread_id) conv = (await c.from("conversations").select("*").eq("channel", input.channel).eq("external_thread_id", input.external_thread_id).not("status", "in", "(resolved,closed)").maybeSingle()).data;
  if (!conv && !input.threadOnly) {
    const { data: recent } = await c.from("conversations").select("*").eq("customer_id", customer.id).eq("channel", input.channel).not("status", "in", "(resolved,closed)").order("last_message_at", { ascending: false }).limit(1).maybeSingle();
    conv = recent;
  }
  const isNew = !conv;
  if (!conv) conv = await openConversation({ customer, channel: input.channel, subject: input.subject?.replace(/^(re|fwd?):\s*/i, "") ?? null, priority: customer.priority as Conversation["priority"], team_id: null, assignee_id: null, external_thread_id: input.external_thread_id ?? null, actorId: null, extra: input.open });
  const msg = await addMessage(conv, { direction: "inbound", author_kind: "customer", body, external_id: input.external_message_id ?? null, attachments: input.attachments });
  if (!msg) return { conversation: conv, duplicate: true, isNew: false };
  const reopen = ["resolved", "closed"].includes(conv.status);
  await c.from("conversations").update({ last_customer_message_at: nowIso(), last_message_at: nowIso(), unread_for_agent: (conv.unread_for_agent ?? 0) + (isNew ? 0 : 1), ...(reopen ? { status: "open" as const, reopened_count: conv.reopened_count + 1, resolved_at: null, closed_at: null } : conv.status === "pending_customer" || conv.status === "snoozed" ? { status: "open" as const, snoozed_until: null } : {}) }).eq("id", conv.id);
  if (reopen) await recordStatus("conversation", conv.id, conv.status, "open", null, "Customer replied");
  // A customer already marked as spam keeps landing in the spam folder, silently.
  let spam = !!conv.spam_at;
  if (isNew && !spam) {
    const { count } = await c.from("conversations").select("id", { count: "exact", head: true }).eq("customer_id", customer.id).not("spam_at", "is", null);
    if (count) {
      await c.from("conversations").update({ spam_at: nowIso(), spam_reason: "auto: customer previously marked as spam" }).eq("id", conv.id);
      spam = true;
    }
  }
  if (spam) return { conversation: conv, duplicate: false, isNew, spam: true };
  // AI agents on this channel (docs/bos/39 §5) — after the webhook has answered.
  if (conv.channel !== "web_widget") {
    const convId = conv.id;
    const run = async () => {
      const { routeInboundToAi } = await import("@/services/bos/ai-agents");
      await routeInboundToAi(convId, { isNew, reopened: reopen, text: body }).catch(async (e) => (await import("@/lib/bos/errors")).logServerError("ai:route", e));
    };
    try {
      const { after } = await import("next/server");
      after(run);
    } catch {
      await run(); // outside a request (tests, scripts)
    }
  }
  if (!isNew && !conv.ai_active) await emitEvent({ type: "conversation.customer_message", entityType: "conversation", entityId: conv.id, summary: `${customer.name}: ${body.slice(0, 120)}`, actorType: "client", payload: { title: conv.subject ?? customer.name, assignee_user_id: conv.assignee_id, channel: input.channel, customer_id: customer.id } });
  return { conversation: conv, duplicate: false, isNew };
}

export async function replyToConversation(bos: BosUser, id: string, body: string, opts: { internal: boolean }) {
  if (!can(bos, "conversations.update") && !can(bos, "conversations.create")) throw new ForbiddenError();
  const text = body.trim();
  if (!text) throw new ValidationError("الرد فارغ.", { body: "مطلوب" });
  if (text.length > 20_000) throw new ValidationError("الرد طويل جداً.", { body: "طويل جداً" });
  const { conversation: conv, customer } = await getConversation(bos, id);
  if (conv.status === "closed" && !opts.internal) throw new ValidationError("المحادثة مغلقة — أعد فتحها أولاً.");

  if (opts.internal) {
    await addMessage(conv, { direction: "internal", author_kind: "agent", author_user_id: bos.userId, body: text });
    await emitEvent({ type: "comment.added", entityType: "conversation", entityId: id, summary: `Internal note on ${conv.number}`, actorId: bos.userId, payload: { title: conv.subject ?? customer.name } });
    return { delivery: "internal" as const };
  }

  // Same channel the customer used (docs/bos/39 §5).
  const { deliverToCustomer } = await import("@/services/bos/channel-delivery");
  const d = await deliverToCustomer(conv, customer, text, bos.userId);
  const status = d.status;
  const error = d.error;
  const externalId = d.externalId;
  const msg = await addMessage(conv, { direction: "outbound", author_kind: "agent", author_user_id: bos.userId, body: text, external_id: externalId, delivery_status: status, delivery_error: error });
  // A staff reply ends AI handling so the two never answer over each other.
  if (conv.ai_active) await addMessage(conv, { direction: "system", author_kind: "system", author_user_id: bos.userId, body: "handoff:human" });
  const first = !conv.first_response_at;
  await db().from("conversations").update({ last_agent_message_at: nowIso(), last_message_at: nowIso(), ...(first ? { first_response_at: nowIso() } : {}), ...(conv.status === "open" || conv.status === "pending_internal" ? { status: "pending_customer" as const } : {}), ...(conv.assignee_id ? {} : { assignee_id: bos.userId }), unread_for_agent: 0, ...(conv.ai_active ? { ai_active: false, handed_off_at: nowIso(), handoff_reason: "human_reply" } : {}) }).eq("id", id);
  await audit({ actorId: bos.userId, action: "conversation.replied", entityType: "conversation", entityId: id, newValue: { message_id: msg?.id, channel: conv.channel, delivery: status } });
  return { delivery: status, error };
}

export async function setConversationStatus(bos: BosUser, id: string, to: ConvStatus, opts: { snoozeUntil?: string | null; reason?: string | null } = {}) {
  const { conversation: conv } = await getConversation(bos, id);
  if (!can(bos, "conversations.update")) throw new ForbiddenError();
  if (conv.status === to) return;
  if (!transitions[conv.status].includes(to)) throw new ValidationError("انتقال حالة غير مسموح.");
  if (to === "snoozed" && (!opts.snoozeUntil || new Date(opts.snoozeUntil).getTime() <= nowMs())) throw new ValidationError("حدد موعداً مستقبلياً للتأجيل.");
  const patch: Partial<Conversation> = { status: to, snoozed_until: to === "snoozed" ? opts.snoozeUntil! : null };
  if (to === "resolved") patch.resolved_at = nowIso();
  if (to === "closed") patch.closed_at = nowIso();
  if (to === "open" && ["resolved", "closed"].includes(conv.status)) {
    patch.reopened_count = conv.reopened_count + 1;
    patch.resolved_at = null;
    patch.closed_at = null;
  }
  await db().from("conversations").update(patch).eq("id", id);
  await recordStatus("conversation", id, conv.status, to, bos.userId, opts.reason ?? null);
  await addMessage(conv, { direction: "system", author_kind: "system", author_user_id: bos.userId, body: `status:${conv.status}→${to}` });
  if (to === "resolved") await emitEvent({ type: "conversation.resolved", entityType: "conversation", entityId: id, summary: `Resolved: ${conv.number}`, actorId: bos.userId, payload: { title: conv.subject ?? conv.number } });
}

export async function assignConversation(bos: BosUser, id: string, patch: { assignee_id?: string | null; team_id?: string | null }) {
  const { conversation: conv } = await getConversation(bos, id);
  const self = patch.assignee_id === bos.userId && patch.team_id === undefined;
  if (!self && !can(bos, "conversations.assign")) throw new ForbiddenError();
  const next: Partial<Conversation> = {};
  if (patch.team_id !== undefined) {
    next.team_id = patch.team_id;
    if (patch.assignee_id === undefined) next.assignee_id = patch.team_id ? await pickAgent(patch.team_id) : null;
  }
  if (patch.assignee_id !== undefined) {
    if (patch.assignee_id) {
      const { data: emp } = await db().from("employees").select("lifecycle_status").eq("user_id", patch.assignee_id).maybeSingle();
      if (!emp || !["active", "onboarding", "on_leave"].includes(emp.lifecycle_status)) throw new ValidationError("المسؤول يجب أن يكون موظفاً نشطاً.");
    }
    next.assignee_id = patch.assignee_id;
  }
  await db().from("conversations").update({ ...next, unread_for_agent: conv.unread_for_agent }).eq("id", id);
  await audit({ actorId: bos.userId, action: "conversation.assigned", entityType: "conversation", entityId: id, oldValue: { assignee_id: conv.assignee_id, team_id: conv.team_id }, newValue: next });
  await addMessage(conv, { direction: "system", author_kind: "system", author_user_id: bos.userId, body: `assigned:${next.assignee_id ?? conv.assignee_id ?? "-"}|team:${next.team_id ?? conv.team_id ?? "-"}` });
  if (next.assignee_id && next.assignee_id !== conv.assignee_id) await emitEvent({ type: "conversation.assigned", entityType: "conversation", entityId: id, summary: `Conversation assigned: ${conv.number}`, actorId: bos.userId, payload: { title: conv.subject ?? conv.number, assignee_user_id: next.assignee_id, previous_assignee_user_id: conv.assignee_id } });
}

// Spam folder (docs/bos/37 §3): a real flag on the conversation; restoring
// clears it and the conversation returns with its previous status.
export async function markConversationSpam(bos: BosUser, id: string, reason: string | null) {
  const { conversation: conv } = await getConversation(bos, id);
  if (!can(bos, "conversations.update")) throw new ForbiddenError();
  if (conv.spam_at) return;
  const clean = reason?.trim().slice(0, 500) || null;
  await db().from("conversations").update({ spam_at: nowIso(), spam_by: bos.userId, spam_reason: clean, unread_for_agent: 0 }).eq("id", id);
  await addMessage(conv, { direction: "system", author_kind: "system", author_user_id: bos.userId, body: "spam:marked" });
  await audit({ actorId: bos.userId, action: "conversation.marked_spam", entityType: "conversation", entityId: id, reason: clean ?? undefined });
}

export async function restoreConversationFromSpam(bos: BosUser, id: string) {
  const { conversation: conv } = await getConversation(bos, id);
  if (!can(bos, "conversations.update")) throw new ForbiddenError();
  if (!conv.spam_at) return;
  await db().from("conversations").update({ spam_at: null, spam_by: null, spam_reason: null }).eq("id", id);
  await addMessage(conv, { direction: "system", author_kind: "system", author_user_id: bos.userId, body: "spam:restored" });
  await audit({ actorId: bos.userId, action: "conversation.restored_from_spam", entityType: "conversation", entityId: id, oldValue: { spam_at: conv.spam_at, spam_reason: conv.spam_reason } });
}

// A staff member takes over from the AI agent: AI stops, context stays, the
// conversation is assigned to them (docs/bos/39 §5).
export async function takeOverConversation(bos: BosUser, id: string) {
  const { conversation: conv } = await getConversation(bos, id);
  if (!can(bos, "conversations.update")) throw new ForbiddenError();
  if (!conv.ai_active && conv.assignee_id === bos.userId) return;
  await db().from("conversations").update({ ai_active: false, handed_off_at: conv.ai_active ? nowIso() : conv.handed_off_at, handoff_reason: conv.ai_active ? "human_takeover" : conv.handoff_reason, assignee_id: bos.userId, status: conv.status === "pending_customer" ? conv.status : "open" }).eq("id", id);
  await addMessage(conv, { direction: "system", author_kind: "system", author_user_id: bos.userId, body: "handoff:human" });
  await audit({ actorId: bos.userId, action: "conversation.taken_over", entityType: "conversation", entityId: id, oldValue: { ai_active: conv.ai_active, assignee_id: conv.assignee_id } });
}

// Escalate: raise priority and alert the team leads (or admins).
export async function escalateConversation(bos: BosUser, id: string, reason: string) {
  const { conversation: conv } = await getConversation(bos, id);
  if (!can(bos, "conversations.update")) throw new ForbiddenError();
  if (!reason.trim()) throw new ValidationError("سبب التصعيد مطلوب.", { reason: "مطلوب" });
  const priority: Conversation["priority"] = conv.priority === "urgent" || conv.priority === "high" ? "urgent" : "high";
  await db().from("conversations").update({ priority, status: conv.status === "pending_customer" ? "open" : conv.status }).eq("id", id);
  const { data: leads } = conv.team_id ? await db().from("support_team_members").select("user_id").eq("team_id", conv.team_id).eq("role", "lead") : { data: [] as { user_id: string }[] };
  await addMessage(conv, { direction: "internal", author_kind: "agent", author_user_id: bos.userId, body: `⚠ ${reason.trim()}` });
  await audit({ actorId: bos.userId, action: "conversation.escalated", entityType: "conversation", entityId: id, newValue: { priority }, reason });
  await emitEvent({ type: "conversation.escalated", entityType: "conversation", entityId: id, summary: `Escalated ${conv.number}: ${reason.trim().slice(0, 120)}`, actorId: bos.userId, payload: { title: conv.subject ?? conv.number, reason, priority, notify_user_ids: (leads ?? []).map((l) => l.user_id), escalation_user_id: (leads ?? [])[0]?.user_id ?? null } });
}

export async function updateConversationMeta(bos: BosUser, id: string, patch: { priority?: Conversation["priority"]; tags?: string[]; subject?: string | null }) {
  const { conversation: conv } = await getConversation(bos, id);
  if (!can(bos, "conversations.update")) throw new ForbiddenError();
  const clean = { ...patch, ...(patch.tags ? { tags: [...new Set(patch.tags.map((t) => t.trim()).filter(Boolean))].slice(0, 20) } : {}) };
  await db().from("conversations").update(clean).eq("id", id);
  await audit({ actorId: bos.userId, action: "conversation.updated", entityType: "conversation", entityId: id, oldValue: { priority: conv.priority, tags: conv.tags, subject: conv.subject }, newValue: clean });
}

// Ticket from a conversation (existing tickets module; linked both ways).
export async function createTicketFromConversation(bos: BosUser, id: string, input: { subject?: string | null; category?: string | null; priority?: Conversation["priority"] }) {
  if (!can(bos, "tickets.create")) throw new ForbiddenError();
  const { conversation: conv, messages, customer } = await getConversation(bos, id);
  if (conv.ticket_id) throw new ValidationError("هذه المحادثة مرتبطة بتذكرة بالفعل.");
  const transcript = messages
    .filter((m) => m.direction !== "system")
    .slice(-15)
    .map((m) => `${m.direction === "inbound" ? customer.name : m.direction === "internal" ? "[ملاحظة داخلية]" : "Taysonsta"}: ${m.body}`)
    .join("\n\n");
  const { createTicket } = await import("@/services/bos/support");
  const priorityMap: Record<string, "low" | "medium" | "high" | "urgent"> = { low: "low", normal: "medium", high: "high", urgent: "urgent" };
  const ticket = await createTicket({ bos }, {
    client_id: customer.client_id,
    contact_id: customer.contact_id,
    category: input.category ?? "support",
    priority: priorityMap[input.priority ?? conv.priority] ?? "medium",
    subject: (input.subject ?? conv.subject ?? `${conv.number} — ${customer.name}`).slice(0, 300),
    description: `${transcript}\n\n— ${conv.number}`.slice(0, 20_000),
    assigned_to: conv.assignee_id,
    conversation_id: conv.id,
    support_customer_id: customer.id,
    team_id: conv.team_id,
  } as never, conv.channel === "email" ? "email" : "internal");
  await db().from("conversations").update({ ticket_id: ticket.id }).eq("id", id);
  await addMessage(conv, { direction: "system", author_kind: "system", author_user_id: bos.userId, body: `ticket:${ticket.ticket_number}` });
  return ticket;
}

// ---------------------------------------------------------------------------
// Analytics (docs/bos/30 §10.1)
// ---------------------------------------------------------------------------

// Period = last N days or an explicit From–To (YYYY-MM-DD, inclusive).
// Everything is computed from real conversations and tickets; spam excluded.
export async function supportAnalytics(period: number | { from: string; to: string } = 30) {
  const range = typeof period === "number"
    ? { since: new Date(nowMs() - period * 86400_000).toISOString(), until: new Date(nowMs() + 60_000).toISOString() }
    : { since: `${period.from}T00:00:00Z`, until: `${period.to}T23:59:59Z` };
  const c = db();
  const [{ data: convs }, { data: open }, { data: tickets }, { data: openTickets }, { count: spam }] = await Promise.all([
    c.from("conversations").select("channel, status, assignee_id, team_id, created_at, first_response_at, resolved_at, reopened_count, ai_agent_id, handed_off_at").is("spam_at", null).gte("created_at", range.since).lte("created_at", range.until).limit(20000),
    c.from("conversations").select("status, team_id, assignee_id, priority, last_customer_message_at, last_agent_message_at").is("spam_at", null).not("status", "in", "(resolved,closed)").limit(20000),
    c.from("tickets").select("status, created_at, first_responded_at, resolved_at, sla_breached_at, conversation_id").gte("created_at", range.since).lte("created_at", range.until).limit(20000),
    c.from("tickets").select("status, sla_breached_at").not("status", "in", "(resolved,closed)").limit(20000),
    c.from("conversations").select("id", { count: "exact", head: true }).not("spam_at", "is", null).gte("created_at", range.since).lte("created_at", range.until),
  ]);
  const rows = convs ?? [];
  const mins = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 60000;
  const frt = rows.filter((r) => r.first_response_at).map((r) => mins(r.created_at, r.first_response_at!));
  const res = rows.filter((r) => r.resolved_at).map((r) => mins(r.created_at, r.resolved_at!) / 60);
  const avg = (a: number[]) => (a.length ? Math.round((a.reduce((s, x) => s + x, 0) / a.length) * 10) / 10 : null);
  const tally = <K extends string>(list: K[]) => { const m = new Map<K, number>(); for (const k of list) m.set(k, (m.get(k) ?? 0) + 1); return m; };
  const byChannel = tally(rows.map((r) => r.channel));
  const byStatus = tally(rows.map((r) => r.status));
  const byTeam = tally(rows.map((r) => r.team_id ?? "none"));
  const byAgent = new Map<string, { handled: number; resolved: number; frt: number[] }>();
  for (const r of rows) {
    if (!r.assignee_id) continue;
    const a = byAgent.get(r.assignee_id) ?? { handled: 0, resolved: 0, frt: [] };
    a.handled++;
    if (r.resolved_at) a.resolved++;
    if (r.first_response_at) a.frt.push(mins(r.created_at, r.first_response_at));
    byAgent.set(r.assignee_id, a);
  }
  const ai = rows.filter((r) => r.ai_agent_id);
  // Daily trend (UTC days) of conversations and tickets created.
  const dayKeys: string[] = [];
  for (let t = new Date(range.since.slice(0, 10) + "T00:00:00Z").getTime(); t <= Math.min(new Date(range.until).getTime(), nowMs()) && dayKeys.length < 400; t += 86400_000) dayKeys.push(new Date(t).toISOString().slice(0, 10));
  const convDaily = tally(rows.map((r) => r.created_at.slice(0, 10)));
  const ticketDaily = tally((tickets ?? []).map((t) => t.created_at.slice(0, 10)));
  const waiting = (open ?? []).filter((o) => o.last_customer_message_at && (!o.last_agent_message_at || o.last_agent_message_at < o.last_customer_message_at)).length;
  const tRows = tickets ?? [];
  return {
    total: rows.length,
    resolved: res.length,
    reopened: rows.filter((r) => r.reopened_count > 0).length,
    avgFirstResponseMin: avg(frt),
    avgResolutionHours: avg(res),
    open: (open ?? []).length,
    unassigned: (open ?? []).filter((o) => !o.assignee_id).length,
    waitingOnUs: waiting,
    pending: (open ?? []).filter((o) => o.status === "pending_customer" || o.status === "pending_internal").length,
    snoozed: (open ?? []).filter((o) => o.status === "snoozed").length,
    closedInPeriod: rows.filter((r) => r.status === "resolved" || r.status === "closed").length,
    spam: spam ?? 0,
    byChannel: [...byChannel.entries()].map(([channel, n]) => ({ channel, n })).sort((a, b) => b.n - a.n),
    byStatus: [...byStatus.entries()].map(([status, n]) => ({ status, n })).sort((a, b) => b.n - a.n),
    byTeam: [...byTeam.entries()].map(([teamId, n]) => ({ teamId, n })).sort((a, b) => b.n - a.n),
    byAgent: [...byAgent.entries()].map(([userId, v]) => ({ userId, handled: v.handled, resolved: v.resolved, avgFirstResponseMin: avg(v.frt) })).sort((a, b) => b.handled - a.handled),
    ai: { total: ai.length, handedOff: ai.filter((r) => r.handed_off_at).length, resolvedByAi: ai.filter((r) => !r.handed_off_at && r.resolved_at).length },
    tickets: {
      created: tRows.length,
      resolved: tRows.filter((t) => t.resolved_at).length,
      fromConversations: tRows.filter((t) => t.conversation_id).length,
      avgFirstResponseMin: avg(tRows.filter((t) => t.first_responded_at).map((t) => mins(t.created_at, t.first_responded_at!))),
      open: (openTickets ?? []).length,
      breached: (openTickets ?? []).filter((t) => t.sla_breached_at).length,
    },
    daily: dayKeys.map((d) => ({ day: d, conversations: convDaily.get(d) ?? 0, tickets: ticketDaily.get(d) ?? 0 })),
  };
}
