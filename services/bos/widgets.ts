import "server-only";
import { ydb, yoliasConfigured } from "@/lib/yolias/db";
import { db, type Tables } from "@/lib/bos/db";
import { can, type BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { nowIso } from "@/lib/bos/clock";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/bos/errors";
import { addMessage, findOrCreateCustomer, receiveInbound } from "@/services/bos/conversations";
import { decryptSecrets, encryptSecrets, secretsConfigured } from "@/lib/bos/secrets";
import { hostAllowed, isWithinHours, type WorkingHours } from "@/lib/bos/ai-agent-prompt";

// Website support widget (docs/bos/30 §10.5, doc 31 Phase 8). A company
// embeds <script src="/widget.js?k=PUBLIC_KEY">; the script talks to
// /api/public/widget/<key>/… which only answers pages whose Origin is in the
// widget's allowed domains. Visitors get a random session token (only its
// SHA-256 is stored). Messages land in the unified inbox as web_widget
// conversations; the widget's AI agent (if any) answers first.

export type Widget = Tables<"support_widgets">;
export type WidgetSession = Tables<"widget_sessions">;

export interface WidgetInput {
  name: string;
  is_active: boolean;
  /** Shown on the Yolias website (at most one widget). */
  on_yolias: boolean;
  allowed_domains: string[];
  title: string;
  welcome_message: string;
  offline_message: string;
  primary_color: string;
  position: Widget["position"];
  bottom_offset: number;
  language: Widget["language"];
  require_email: boolean;
  working_hours: WorkingHours;
  ai_agent_id: string | null;
  team_id: string | null;
  ratings_enabled?: boolean;
  show_agent_photos?: boolean;
  help_enabled?: boolean;
}

function assertManage(bos: BosUser) {
  if (!can(bos, "conversations.manage") && !bos.isSuperAdmin) throw new ForbiddenError();
}

export async function listWidgets() {
  const { data } = await db().from("support_widgets").select("*, ai_agents(name), support_teams(name)").order("created_at");
  return data ?? [];
}

export async function getWidget(id: string) {
  const { data } = await db().from("support_widgets").select("*").eq("id", id).maybeSingle();
  if (!data) throw new NotFoundError();
  return data;
}

function validate(i: WidgetInput) {
  if (!i.name.trim()) throw new ValidationError("الاسم مطلوب.", { name: "مطلوب" });
  if (!/^#[0-9a-fA-F]{6}$/.test(i.primary_color)) throw new ValidationError("لون غير صالح.", { primary_color: "مثال: #6d28d9" });
  for (const d of i.allowed_domains) {
    if (!/^(\*\.)?[a-z0-9.-]+(:\d+)?$/i.test(d)) throw new ValidationError(`نطاق غير صالح: ${d}`, { allowed_domains: "مثال: example.com أو *.example.com" });
  }
  const h = i.working_hours;
  if (h.start || h.end) {
    if (!/^\d{2}:\d{2}$/.test(h.start ?? "") || !/^\d{2}:\d{2}$/.test(h.end ?? "")) throw new ValidationError("ساعات العمل بصيغة HH:MM.");
    try {
      new Intl.DateTimeFormat("en", { timeZone: h.tz || "UTC" });
    } catch {
      throw new ValidationError("المنطقة الزمنية غير صالحة.");
    }
  }
}

export function normalizeDomains(raw: string) {
  return [...new Set(raw.split(/[\s,]+/).map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")).filter(Boolean))].slice(0, 50);
}

export async function saveWidget(bos: BosUser, id: string | null, input: WidgetInput) {
  assertManage(bos);
  validate(input);
  const row = { ...input, name: input.name.trim(), working_hours: input.working_hours as never };
  // Only one widget is shown on the Yolias website.
  if (row.on_yolias) await db().from("support_widgets").update({ on_yolias: false }).eq("on_yolias", true).neq("id", id ?? "00000000-0000-0000-0000-000000000000");
  if (id) {
    const { error } = await db().from("support_widgets").update(row).eq("id", id);
    if (error) throw error;
    await audit({ actorId: bos.userId, action: "widget.updated", entityType: "support_widget", entityId: id, newValue: { name: row.name, is_active: row.is_active, on_yolias: row.on_yolias, allowed_domains: row.allowed_domains, ai_agent_id: row.ai_agent_id } });
    await syncYoliasWidget();
    return id;
  }
  const { data, error } = await db().from("support_widgets").insert({ ...row, created_by: bos.userId }).select("id").single();
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "widget.created", entityType: "support_widget", entityId: data.id, newValue: { name: row.name, on_yolias: row.on_yolias } });
  await syncYoliasWidget();
  return data.id;
}

// New public key: old embed codes stop working immediately.
export async function rotateWidgetKey(bos: BosUser, id: string) {
  assertManage(bos);
  const key = randomHex(12);
  // A new identity secret too: signed identities made with the old one stop working.
  await db().from("support_widgets").update({ public_key: key, identity_secret_enc: null }).eq("id", id);
  await db().from("widget_sessions").delete().eq("widget_id", id);
  await audit({ actorId: bos.userId, action: "widget.key_rotated", entityType: "support_widget", entityId: id });
  await syncYoliasWidget();
  return key;
}

/**
 * Tells Yolias which widget its website shows (D-134): the active widget
 * marked "on Yolias", and where Yolias's server reaches this Admin
 * (ADMIN_URL). Yolias serves it from its own domain through a proxy, so the
 * Admin domain never appears on the website. Nothing marked → removed.
 */
export async function syncYoliasWidget() {
  if (!yoliasConfigured()) return;
  const { data: w } = await db().from("support_widgets").select("id, public_key, identity_secret_enc").eq("on_yolias", true).eq("is_active", true).maybeSingle();
  const origin = (process.env.ADMIN_URL ?? "").replace(/\/+$/, "");
  const { error } = w && origin
    ? await ydb().from("site_settings").upsert({ key: "support_widget", value: { key: w.public_key, origin }, updated_at: new Date().toISOString() })
    : await ydb().from("site_settings").delete().eq("key", "support_widget");
  if (error) throw new ValidationError(`حُفظ الويدجت لكن تعذّر تحديثه في موقع يولياس: ${error.message}`);
  // The identity secret (D-180) lets Yolias's server vouch for its signed-in
  // user; it goes to Yolias's Vault like every other key (never site_settings,
  // which other sites on the shared project may read).
  if (!w || !origin) {
    await ydb().rpc("clear_integration_keys", { p_provider: "support_widget" });
    return;
  }
  const secret = await ensureIdentitySecret(w);
  if (secret) {
    const { error: e2 } = await ydb().rpc("set_integration_keys", { p_provider: "support_widget", p_config: {}, p_secrets: { identity_secret: secret }, p_by: "admin" });
    if (e2) throw new ValidationError(`تعذّر نقل مفتاح هوية الويدجت إلى يولياس: ${e2.message}`);
  }
}

/** The widget's identity secret, created on first use (needs BOS_SECRETS_KEY). */
async function ensureIdentitySecret(w: { id: string; identity_secret_enc: string | null }): Promise<string | null> {
  const existing = await widgetIdentitySecret(w);
  if (existing) return existing;
  if (!secretsConfigured()) return null;
  const secret = randomHex(32);
  await db().from("support_widgets").update({ identity_secret_enc: await encryptSecrets({ identity: secret }) }).eq("id", w.id);
  return secret;
}


// ---------------------------------------------------------------------------
// Public side (messenger: Home / Messages / Help, D-180)
// ---------------------------------------------------------------------------

function randomHex(bytes: number) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function widgetByKey(key: string) {
  if (!/^[0-9a-f]{16,64}$/.test(key)) return null;
  const { data } = await db().from("support_widgets").select("*").eq("public_key", key).eq("is_active", true).maybeSingle();
  return data;
}

export function originOk(w: Pick<Widget, "allowed_domains">, origin: string | null) {
  return hostAllowed(origin, w.allowed_domains);
}

export async function rateOk(key: string, windowSeconds: number, max: number) {
  const { data } = await db().rpc("bos_rate_limit_hit", { p_key: key, p_window_seconds: windowSeconds, p_max: max });
  return data !== false;
}

export function publicConfig(w: Widget) {
  return {
    title: w.title,
    welcome: w.welcome_message,
    offline: w.offline_message,
    color: w.primary_color,
    position: w.position,
    bottom: w.bottom_offset,
    language: w.language,
    requireEmail: w.require_email,
    online: isWithinHours(w.working_hours as WorkingHours),
    ai: !!w.ai_agent_id,
    ratings: w.ratings_enabled,
    help: w.help_enabled,
  };
}

// ── Visitor identity ──────────────────────────────────────────────────────
// A site can vouch for its signed-in user (Yolias does, from its own server):
// header x-widget-identity = base64url(JSON {u, e, n, t}) + "." + HMAC-SHA256
// of that part with the widget's identity secret. Valid for 5 minutes. The
// browser never sees the secret, so it can't claim to be someone else.

export interface VisitorIdentity { userId: string; email: string | null; name: string | null }

const b64urlDecode = (s: string) => {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(t + "=".repeat((4 - (t.length % 4)) % 4)), (ch) => ch.charCodeAt(0));
};

export async function widgetIdentitySecret(w: Pick<Widget, "identity_secret_enc">): Promise<string | null> {
  if (!w.identity_secret_enc) return null;
  try {
    return (await decryptSecrets(w.identity_secret_enc)).identity ?? null;
  } catch {
    return null;
  }
}

export async function verifyIdentity(w: Pick<Widget, "identity_secret_enc">, header: string | null, now = Date.now()): Promise<VisitorIdentity | null> {
  if (!header || header.length > 2000) return null;
  const [payload, sig] = header.split(".");
  if (!payload || !sig) return null;
  const secret = await widgetIdentitySecret(w);
  if (!secret) return null;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  let ok = false;
  try {
    ok = await crypto.subtle.verify("HMAC", key, b64urlDecode(sig), new TextEncoder().encode(payload));
  } catch {
    return null;
  }
  if (!ok) return null;
  try {
    const v = JSON.parse(new TextDecoder().decode(b64urlDecode(payload))) as { u?: unknown; e?: unknown; n?: unknown; t?: unknown };
    if (typeof v.u !== "string" || !/^[0-9a-f-]{36}$/i.test(v.u) || typeof v.t !== "number" || Math.abs(now / 1000 - v.t) > 300) return null;
    return { userId: v.u.toLowerCase(), email: typeof v.e === "string" ? v.e.slice(0, 200) : null, name: typeof v.n === "string" ? v.n.slice(0, 120) : null };
  } catch {
    return null;
  }
}

const visitorKey = (id: VisitorIdentity) => `yolias:${id.userId}`;
export const visitorOf = (s: Pick<WidgetSession, "id" | "visitor_key">) => s.visitor_key ?? `session:${s.id}`;

export async function startSession(w: Widget, meta: { origin: string | null; pageUrl?: string | null; userAgent?: string | null }, identity: VisitorIdentity | null = null) {
  const token = randomHex(32);
  let customerId: string | null = null;
  if (identity?.email) customerId = (await findOrCreateCustomer({ name: identity.name, email: identity.email, channel: "web_widget", source: "web_widget" })).id;
  const { error } = await db().from("widget_sessions").insert({
    widget_id: w.id, token_hash: await sha256(token), origin: meta.origin, page_url: meta.pageUrl?.slice(0, 500) ?? null, user_agent: meta.userAgent?.slice(0, 300) ?? null,
    visitor_key: identity ? visitorKey(identity) : null, customer_id: customerId,
  });
  if (error) throw error;
  return token;
}

export async function sessionFor(w: Widget, token: string | null) {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const { data } = await db().from("widget_sessions").select("*").eq("widget_id", w.id).eq("token_hash", await sha256(token)).maybeSingle();
  return data;
}

/**
 * Who the session's conversations belong to, given who is signed in now:
 *  - signed in, anonymous session → the session joins the user (its
 *    conversations move to the account, so they follow the user);
 *  - signed in as someone else, or signed out of an account session → the
 *    session is refused (401) and the widget starts a new one. A visitor
 *    never sees an account's conversations.
 */
export async function resolveSession(s: WidgetSession, identity: VisitorIdentity | null): Promise<WidgetSession | null> {
  if (identity && !s.visitor_key) {
    const key = visitorKey(identity);
    const c = db();
    const customerId = s.customer_id ?? (identity.email ? (await findOrCreateCustomer({ name: identity.name, email: identity.email, channel: "web_widget", source: "web_widget" })).id : null);
    await c.from("widget_sessions").update({ visitor_key: key, customer_id: customerId }).eq("id", s.id);
    await c.from("bos_conversations").update({ widget_visitor: key }).eq("widget_visitor", `session:${s.id}`);
    return { ...s, visitor_key: key, customer_id: customerId };
  }
  if (identity && s.visitor_key !== visitorKey(identity)) return null;
  if (!identity && s.visitor_key) return null;
  return s;
}

async function ownConversation(w: Widget, s: WidgetSession, id: string | null | undefined) {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db().from("bos_conversations").select("*").eq("id", id).eq("widget_id", w.id).eq("widget_visitor", visitorOf(s)).maybeSingle();
  return data;
}

export interface VisitorMessage { name?: string | null; email?: string | null; body: string; conversationId?: string | null }

// Visitor → inbox. A message either continues one of the visitor's own
// conversations (reopening it if it was resolved) or starts a new one.
// Returns the conversation and whether the AI agent should answer.
export async function postVisitorMessage(w: Widget, s: WidgetSession, m: VisitorMessage) {
  const body = m.body.trim();
  if (!body) throw new ValidationError("الرسالة فارغة.");
  if (body.length > 4000) throw new ValidationError("الرسالة طويلة جداً.");
  const c = db();
  const existing = m.conversationId ? await ownConversation(w, s, m.conversationId) : null;
  if (m.conversationId && !existing) throw new ValidationError("المحادثة غير موجودة.");
  let customerId = existing?.customer_id ?? s.customer_id;
  if (!customerId) {
    const email = m.email?.trim() || null;
    if (w.require_email && !email) throw new ValidationError("البريد الإلكتروني مطلوب.", { email: "مطلوب" });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError("بريد غير صالح.", { email: "بريد غير صالح" });
    const customer = await findOrCreateCustomer({ name: m.name?.trim().slice(0, 120) || null, email, channel: "web_widget", source: "web_widget" });
    customerId = customer.id;
  }
  const { data: agent } = w.ai_agent_id ? await c.from("ai_agents").select("id, is_active").eq("id", w.ai_agent_id).maybeSingle() : { data: null };
  const res = await receiveInbound({
    channel: "web_widget",
    customer: {},
    customer_id: customerId,
    threadOnly: true,
    conversation_id: existing?.id ?? null,
    subject: existing ? null : body.slice(0, 80),
    body,
    external_thread_id: existing?.external_thread_id ?? `ws:${s.id}:${randomHex(6)}`,
    open: { team_id: w.team_id, widget_id: w.id, ai_agent_id: agent?.id ?? null, ai_active: !!agent?.is_active },
  });
  if (!res) throw new ValidationError("الرسالة فارغة.");
  if (!existing) await c.from("bos_conversations").update({ widget_visitor: visitorOf(s) }).eq("id", res.conversation.id);
  await c.from("widget_sessions").update({ customer_id: customerId, conversation_id: res.conversation.id, last_seen_at: nowIso() }).eq("id", s.id);
  const { data: conv } = await c.from("bos_conversations").select("id, ai_active").eq("id", res.conversation.id).single();
  return { conversationId: conv!.id, aiShouldRespond: conv!.ai_active };
}

/** The visitor's conversations, newest first, with the last visible message. */
export async function visitorConversations(w: Widget, s: WidgetSession) {
  const c = db();
  const { data: convs } = await c.from("bos_conversations").select("id, number, subject, status, ai_active, handed_off_at, assignee_id, last_message_at, reopened_count")
    .eq("widget_id", w.id).eq("widget_visitor", visitorOf(s)).is("spam_at", null).order("last_message_at", { ascending: false }).limit(30);
  const ids = (convs ?? []).map((x) => x.id);
  if (!ids.length) return { conversations: [] };
  const { data: msgs } = await c.from("conversation_messages").select("conversation_id, direction, author_kind, body, created_at")
    .in("conversation_id", ids).in("direction", ["inbound", "outbound"]).order("created_at", { ascending: false }).limit(600);
  const last = new Map<string, { direction: string; author_kind: string; body: string; created_at: string }>();
  for (const msg of msgs ?? []) if (!last.has(msg.conversation_id)) last.set(msg.conversation_id, msg);
  return {
    conversations: (convs ?? []).map((x) => {
      const l = last.get(x.id);
      return {
        id: x.id,
        status: ["resolved", "closed"].includes(x.status) ? "resolved" : "open",
        preview: (l?.body ?? x.subject ?? "").slice(0, 140),
        from: !l ? null : l.direction === "inbound" ? "me" : l.author_kind === "ai" ? "ai" : "agent",
        at: l?.created_at ?? x.last_message_at,
      };
    }),
  };
}

type Author = { kind: "me" | "ai" | "agent"; name: string | null; photo: string | null };

/** Staff shown to customers: the name they chose (or their employee name) and a photo only if they allowed it. */
async function agentIdentities(w: Widget, userIds: string[]) {
  const ids = [...new Set(userIds)];
  if (!ids.length) return new Map<string, { name: string; photo: boolean }>();
  const c = db();
  const [{ data: emps }, { data: profiles }] = await Promise.all([
    c.from("employees").select("user_id, full_name, photo_path").in("user_id", ids),
    c.from("support_agent_profiles").select("user_id, display_name, show_photo").in("user_id", ids),
  ]);
  const prof = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  return new Map((emps ?? []).filter((e) => e.user_id).map((e) => {
    const p = prof.get(e.user_id!);
    // First name + last initial unless the agent chose a display name.
    const parts = e.full_name.trim().split(/\s+/);
    const short = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1].charAt(0)}.` : parts[0];
    return [e.user_id!, { name: p?.display_name?.trim() || short, photo: !!(w.show_agent_photos && p?.show_photo && e.photo_path) }];
  }));
}

// What the visitor sees of one of its conversations: customer, agent and AI
// messages (never internal notes or system lines), each with who wrote it,
// plus the state the messenger needs (AI answering, waiting for a person,
// resolved, rating).
export async function visitorMessages(w: Widget, s: WidgetSession, conversationId: string | null, since?: string | null) {
  await db().from("widget_sessions").update({ last_seen_at: nowIso() }).eq("id", s.id);
  const conv = conversationId ? await ownConversation(w, s, conversationId) : s.conversation_id ? await ownConversation(w, s, s.conversation_id) : null;
  if (!conv) return { conversation: null, messages: [], status: null as string | null, ai: false, waitingHuman: false, canRate: false, rated: null as number | null };
  const c = db();
  let q = c.from("conversation_messages").select("id, direction, author_kind, author_user_id, body, created_at").eq("conversation_id", conv.id).in("direction", ["inbound", "outbound"]).order("created_at").limit(300);
  if (since && !Number.isNaN(Date.parse(since))) q = q.gt("created_at", since);
  const [{ data }, { data: rating }, { count: humanReplies }] = await Promise.all([
    q,
    c.from("support_ratings").select("rating").eq("conversation_id", conv.id).eq("round", conv.reopened_count).maybeSingle(),
    conv.handed_off_at ? c.from("conversation_messages").select("id", { count: "exact", head: true }).eq("conversation_id", conv.id).eq("direction", "outbound").eq("author_kind", "agent").gt("created_at", conv.handed_off_at) : Promise.resolve({ count: 0 }),
  ]);
  const staff = await agentIdentities(w, (data ?? []).filter((m) => m.direction === "outbound" && m.author_kind === "agent" && m.author_user_id).map((m) => m.author_user_id!));
  const resolved = ["resolved", "closed"].includes(conv.status);
  return {
    conversation: conv.id,
    messages: (data ?? []).map((m) => {
      const author: Author = m.direction === "inbound"
        ? { kind: "me", name: null, photo: null }
        : m.author_kind === "ai"
          ? { kind: "ai", name: null, photo: null }
          : { kind: "agent", name: (m.author_user_id && staff.get(m.author_user_id)?.name) || null, photo: m.author_user_id && staff.get(m.author_user_id)?.photo ? `agent-photo?m=${m.id}` : null };
      return { id: m.id, from: author.kind, author, body: m.body, at: m.created_at };
    }),
    status: resolved ? "resolved" : "open",
    ai: !!conv.ai_active,
    // Handed to a person who hasn't answered yet.
    waitingHuman: !conv.ai_active && !!conv.handed_off_at && !humanReplies && !resolved,
    canRate: w.ratings_enabled && resolved && !rating,
    rated: rating?.rating ?? null,
  };
}

/** Rating after a resolved conversation: once per resolution (a reopened conversation can be rated again). */
export async function rateConversation(w: Widget, s: WidgetSession, conversationId: string, rating: number, comment: string | null) {
  if (!w.ratings_enabled) throw new ValidationError("التقييم غير مفعّل.");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ValidationError("التقييم من 1 إلى 5.");
  const conv = await ownConversation(w, s, conversationId);
  if (!conv) throw new ValidationError("المحادثة غير موجودة.");
  if (!["resolved", "closed"].includes(conv.status)) throw new ValidationError("يمكن التقييم بعد حل المحادثة.");
  const c = db();
  const { data: lastHuman } = await c.from("conversation_messages").select("author_user_id").eq("conversation_id", conv.id).eq("direction", "outbound").eq("author_kind", "agent").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const human = !!lastHuman || !!conv.handed_off_at;
  const { error } = await c.from("support_ratings").insert({
    conversation_id: conv.id, widget_id: w.id, round: conv.reopened_count, rating, comment: comment?.trim().slice(0, 2000) || null,
    responder_kind: human ? "human" : "ai", agent_user_id: human ? lastHuman?.author_user_id ?? conv.assignee_id : null, conversation_status: conv.status, visitor: visitorOf(s),
  });
  if (error?.code === "23505") return { ok: true, duplicate: true };
  if (error) throw error;
  await addMessage(conv, { direction: "system", author_kind: "system", body: `rating:${rating}` });
  return { ok: true, duplicate: false };
}

/** "Talk to a person": the AI hands the conversation to the team. */
export async function requestHuman(w: Widget, s: WidgetSession, conversationId: string) {
  const conv = await ownConversation(w, s, conversationId);
  if (!conv) throw new ValidationError("المحادثة غير موجودة.");
  if (!conv.ai_active) return { ok: true, already: true };
  const { handoffRequested } = await import("@/services/bos/ai-agents");
  await handoffRequested(conv.id);
  return { ok: true, already: false };
}

/** A staff photo for one message the visitor can see, only if the person allowed it. */
export async function agentPhoto(w: Widget, s: WidgetSession, messageId: string): Promise<{ bytes: ArrayBuffer; type: string } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(messageId) || !w.show_agent_photos) return null;
  const c = db();
  const { data: m } = await c.from("conversation_messages").select("conversation_id, direction, author_kind, author_user_id").eq("id", messageId).maybeSingle();
  if (!m || m.direction !== "outbound" || m.author_kind !== "agent" || !m.author_user_id) return null;
  if (!(await ownConversation(w, s, m.conversation_id))) return null;
  const [{ data: p }, { data: e }] = await Promise.all([
    c.from("support_agent_profiles").select("show_photo").eq("user_id", m.author_user_id).maybeSingle(),
    c.from("employees").select("photo_path").eq("user_id", m.author_user_id).maybeSingle(),
  ]);
  if (!p?.show_photo || !e?.photo_path) return null;
  const { data: file } = await c.storage.from("bos-files").download(e.photo_path);
  if (!file) return null;
  return { bytes: await file.arrayBuffer(), type: file.type || "image/jpeg" };
}

/** Help search for sites without their own help center: published public knowledge-base articles. */
export async function helpSearch(w: Widget, q: string) {
  const term = q.trim().slice(0, 100);
  if (!w.help_enabled || term.length < 2) return { results: [] };
  const safe = term.replace(/[%,()*\\]/g, " ");
  const { data } = await db().from("kb_articles").select("id, title, content").eq("status", "published").eq("audience", "public")
    .or(`title.ilike.%${safe}%,content.ilike.%${safe}%`).order("updated_at", { ascending: false }).limit(8);
  return { results: (data ?? []).map((a) => ({ id: a.id, title: a.title, summary: a.content.replace(/[#*_>`]/g, "").replace(/\s+/g, " ").trim().slice(0, 160), url: null as string | null, body: a.content.slice(0, 20_000) })) };
}
