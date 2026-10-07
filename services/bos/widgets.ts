import "server-only";
import { ydb, yoliasConfigured } from "@/lib/yolias/db";
import { db, type Tables } from "@/lib/bos/db";
import { can, type BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { nowIso } from "@/lib/bos/clock";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/bos/errors";
import { findOrCreateCustomer, receiveInbound } from "@/services/bos/conversations";
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
  await db().from("support_widgets").update({ public_key: key }).eq("id", id);
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
  const { data: w } = await db().from("support_widgets").select("public_key").eq("on_yolias", true).eq("is_active", true).maybeSingle();
  const origin = (process.env.ADMIN_URL ?? "").replace(/\/+$/, "");
  const { error } = w && origin
    ? await ydb().from("site_settings").upsert({ key: "support_widget", value: { key: w.public_key, origin }, updated_at: new Date().toISOString() })
    : await ydb().from("site_settings").delete().eq("key", "support_widget");
  if (error) throw new ValidationError(`حُفظ الويدجت لكن تعذّر تحديثه في موقع يولياس: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Public side
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
  };
}

export async function startSession(w: Widget, meta: { origin: string | null; pageUrl?: string | null; userAgent?: string | null }) {
  const token = randomHex(32);
  const { error } = await db().from("widget_sessions").insert({ widget_id: w.id, token_hash: await sha256(token), origin: meta.origin, page_url: meta.pageUrl?.slice(0, 500) ?? null, user_agent: meta.userAgent?.slice(0, 300) ?? null });
  if (error) throw error;
  return token;
}

export async function sessionFor(w: Widget, token: string | null) {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const { data } = await db().from("widget_sessions").select("*").eq("widget_id", w.id).eq("token_hash", await sha256(token)).maybeSingle();
  return data;
}

export interface VisitorMessage { name?: string | null; email?: string | null; body: string }

// Visitor → inbox. Returns the conversation id and whether the AI agent
// should answer (the caller schedules agentRespond after the response).
export async function postVisitorMessage(w: Widget, s: WidgetSession, m: VisitorMessage) {
  const body = m.body.trim();
  if (!body) throw new ValidationError("الرسالة فارغة.");
  if (body.length > 4000) throw new ValidationError("الرسالة طويلة جداً.");
  const c = db();
  let customerId = s.customer_id;
  if (!customerId) {
    const email = m.email?.trim() || null;
    if (w.require_email && !email) throw new ValidationError("البريد الإلكتروني مطلوب.", { email: "مطلوب" });
    const customer = await findOrCreateCustomer({ name: m.name?.trim().slice(0, 120) || null, email, channel: "web_widget", source: "web_widget" });
    customerId = customer.id;
  }
  const { data: agent } = w.ai_agent_id ? await c.from("ai_agents").select("id, is_active").eq("id", w.ai_agent_id).maybeSingle() : { data: null };
  const res = await receiveInbound({
    channel: "web_widget",
    customer: {},
    customer_id: customerId,
    threadOnly: true,
    subject: s.conversation_id ? null : body.slice(0, 80),
    body,
    external_thread_id: `ws:${s.id}`,
    open: { team_id: w.team_id, widget_id: w.id, ai_agent_id: agent?.id ?? null, ai_active: !!agent?.is_active },
  });
  if (!res) throw new ValidationError("الرسالة فارغة.");
  await c.from("widget_sessions").update({ customer_id: customerId, conversation_id: res.conversation.id, last_seen_at: nowIso() }).eq("id", s.id);
  const { data: conv } = await c.from("bos_conversations").select("id, ai_active").eq("id", res.conversation.id).single();
  return { conversationId: conv!.id, aiShouldRespond: conv!.ai_active };
}

// What the visitor sees: customer + agent/AI messages (never internal notes).
export async function visitorMessages(s: WidgetSession, since?: string | null) {
  if (!s.conversation_id) return { messages: [], status: null as string | null, ai: false };
  const c = db();
  let q = c.from("conversation_messages").select("id, direction, author_kind, body, created_at").eq("conversation_id", s.conversation_id).in("direction", ["inbound", "outbound"]).order("created_at").limit(200);
  if (since && !Number.isNaN(Date.parse(since))) q = q.gt("created_at", since);
  const [{ data }, { data: conv }] = await Promise.all([q, c.from("bos_conversations").select("status, ai_active").eq("id", s.conversation_id).maybeSingle()]);
  await c.from("widget_sessions").update({ last_seen_at: nowIso() }).eq("id", s.id);
  return {
    messages: (data ?? []).map((m) => ({ id: m.id, from: m.direction === "inbound" ? "me" : m.author_kind === "ai" ? "ai" : "agent", body: m.body, at: m.created_at })),
    status: conv?.status ?? null,
    ai: !!conv?.ai_active,
  };
}
