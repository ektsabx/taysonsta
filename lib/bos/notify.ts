import { nowIso } from "@/lib/bos/clock";
import "server-only";
import { db, type Tables } from "@/lib/bos/db";
import { entityHref } from "@/lib/bos/links";
import { logServerError } from "@/lib/bos/errors";

export type ActivityEvent = Tables<"activity_events">;
type Payload = Record<string, unknown>;

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

// Where does a relation (assignee, pm, …) point for this event?
// Payload values win; otherwise we look at the entity row.
async function resolveRelation(relation: string, event: ActivityEvent): Promise<string[]> {
  const p = (event.payload ?? {}) as Payload;
  const client = db();

  const entityColumn = async (column: string): Promise<string | null> => {
    const tableByType: Record<string, string> = {
      lead: "leads", deal: "deals", task: "tasks", activity: "activities", project: "projects", ticket: "tickets",
      meeting: "meetings", change_request: "change_requests", issue: "issues", invoice: "invoices",
    };
    const table = tableByType[event.entity_type];
    if (!table) return null;
    const { data } = await client.from(table as "leads").select(column).eq("id", event.entity_id).maybeSingle();
    return data ? str((data as unknown as Record<string, unknown>)[column]) : null;
  };

  const managerOf = async (userId: string | null): Promise<string[]> => {
    if (!userId) return [];
    const { data } = await client.from("employees").select("manager_id").eq("user_id", userId).maybeSingle();
    if (!data?.manager_id) return [];
    const { data: mgr } = await client.from("employees").select("user_id").eq("id", data.manager_id).maybeSingle();
    return mgr?.user_id ? [mgr.user_id] : [];
  };

  const assignee = async () =>
    str(p.assignee_user_id) ??
    str(p.assigned_to) ??
    (["meeting"].includes(event.entity_type) ? await entityColumn("organizer_id") : await entityColumn("assigned_to"));

  switch (relation) {
    case "assignee": {
      const a = await assignee();
      return a ? [a] : [];
    }
    case "previous_assignee": {
      const a = str(p.previous_assignee_user_id);
      return a ? [a] : [];
    }
    case "owner": {
      const o = str(p.owner_user_id) ?? (await entityColumn("assigned_to"));
      return o ? [o] : [];
    }
    case "creator": {
      const c = str(p.creator_user_id) ?? str(p.requested_by) ?? (await entityColumn("created_by"));
      return c ? [c] : [];
    }
    case "employee": {
      const e = str(p.employee_user_id);
      if (e) return [e];
      if (event.entity_type === "employee") {
        const { data } = await client.from("employees").select("user_id").eq("id", event.entity_id).maybeSingle();
        return data?.user_id ? [data.user_id] : [];
      }
      return [];
    }
    case "bd": {
      const dealId = str(p.deal_id) ?? (event.entity_type === "deal" ? event.entity_id : null);
      if (!dealId) return [];
      const { data } = await client.from("deals").select("assigned_to").eq("id", dealId).maybeSingle();
      return data?.assigned_to ? [data.assigned_to] : [];
    }
    case "account_manager": {
      const clientId = str(p.client_id) ?? (event.entity_type === "client" ? event.entity_id : null);
      if (!clientId) return [];
      const { data } = await client.from("clients").select("account_manager_id").eq("id", clientId).maybeSingle();
      return data?.account_manager_id ? [data.account_manager_id] : [];
    }
    case "manager_of_actor":
      return managerOf(event.actor_user_id);
    case "manager_of_assignee":
      return managerOf((await assignee()) ?? str(p.employee_user_id));
    case "escalation": {
      const e = str(p.escalation_user_id);
      return e ? [e] : [];
    }
    case "approver": {
      const direct = str(p.approver_user_id);
      if (direct) return [direct];
      const roleId = str(p.approver_role_id);
      if (!roleId) return [];
      const { data } = await client.from("user_roles").select("user_id").eq("role_id", roleId);
      return (data ?? []).map((r) => r.user_id);
    }
    default:
      return [];
  }
}

async function activeStaffWithRole(roleId: string): Promise<string[]> {
  const { data } = await db().from("user_roles").select("user_id").eq("role_id", roleId);
  const ids = (data ?? []).map((r) => r.user_id);
  if (!ids.length) return [];
  const { data: active } = await db()
    .from("employees")
    .select("user_id")
    .in("user_id", ids)
    .in("lifecycle_status", ["active", "onboarding", "on_leave", "offboarding", "pending_onboarding"]);
  return (active ?? []).map((e) => e.user_id!).filter(Boolean);
}

export interface NotificationDraft {
  userId: string;
  eventId: number | null;
  eventType: string;
  title: string;
  body?: string | null;
  link?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  channels: string[];
  // Locked notifications ignore user preferences (e.g. approvals, overdue work).
  locked?: boolean;
  priority?: "low" | "normal" | "high" | "urgent";
}

export async function insertNotifications(drafts: NotificationDraft[]): Promise<void> {
  if (!drafts.length) return;
  const client = db();

  const userIds = [...new Set(drafts.map((d) => d.userId))];
  const eventTypes = [...new Set(drafts.map((d) => d.eventType))];
  const { data: prefs } = await client
    .from("notification_preferences")
    .select("*")
    .in("user_id", userIds)
    .in("event_type", eventTypes);
  const prefByKey = new Map((prefs ?? []).map((p) => [`${p.user_id}:${p.event_type}`, p]));

  for (const draft of drafts) {
    const pref = prefByKey.get(`${draft.userId}:${draft.eventType}`);
    const configurable = !draft.locked;
    const wantInApp = !configurable || !pref || pref.in_app;
    const wantEmail = draft.channels.includes("email") && (!configurable || !pref || pref.email);
    const wantPush = draft.channels.includes("push") && (!configurable || (pref?.push ?? false));
    // WhatsApp / SMS need the messaging integration + recipient consent (Phase 9):
    // recorded as deliveries so they are visible, never silently dropped.
    const extra = draft.channels.filter((c) => c === "whatsapp" || c === "sms");

    if (!wantInApp && !wantEmail && !wantPush && !extra.length) continue;

    const { data: inserted, error } = await client
      .from("notifications")
      .insert({
        user_id: draft.userId,
        event_id: draft.eventId,
        event_type: draft.eventType,
        title: draft.title,
        body: draft.body ?? null,
        link: draft.link ?? null,
        entity_type: draft.entityType ?? null,
        entity_id: draft.entityId ?? null,
        priority: draft.priority ?? "normal",
        // An email-only preference still needs a row for delivery tracking; it is marked read.
        read_at: wantInApp ? null : nowIso(),
      })
      .select("id")
      .maybeSingle();

    if (error) {
      if ((error as { code?: string }).code !== "23505") logServerError("notification insert", error);
      continue;
    }
    if (!inserted) continue;

    const deliveries = [
      ...(wantEmail ? [{ notification_id: inserted.id, channel: "email" }] : []),
      ...(wantPush ? [{ notification_id: inserted.id, channel: "push" }] : []),
      ...extra.map((channel) => ({ notification_id: inserted.id, channel })),
    ];
    if (deliveries.length) {
      await client.from("notification_deliveries").insert(deliveries);
    }
  }
}

const entityTables: Record<string, string> = {
  lead: "leads", deal: "deals", project: "projects", task: "tasks", client: "clients", invoice: "invoices", payment: "payments",
  ticket: "tickets", meeting: "meetings", employee: "employees", change_request: "change_requests", contract: "contracts", milestone: "milestones", issue: "issues",
};

async function loadEntity(event: ActivityEvent): Promise<Record<string, unknown> | null> {
  const table = entityTables[event.entity_type];
  if (!table) return null;
  const { data } = await db().from(table as "leads").select("*").eq("id", event.entity_id).maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

// Recipient language: personal preference → company default.
async function languagesFor(userIds: string[]): Promise<Map<string, "ar" | "en">> {
  const out = new Map<string, "ar" | "en">();
  if (!userIds.length) return out;
  const [{ data: prefs }, { data: company }] = await Promise.all([
    db().from("user_preferences").select("user_id, language").in("user_id", userIds),
    db().from("bos_settings").select("value").eq("key", "company").maybeSingle(),
  ]);
  const fallback = ((company?.value as { default_language?: string } | null)?.default_language === "en" ? "en" : "ar") as "ar" | "en";
  const byUser = new Map((prefs ?? []).map((p) => [p.user_id, p.language]));
  for (const u of userIds) out.set(u, byUser.get(u) === "en" ? "en" : byUser.get(u) === "ar" ? "ar" : fallback);
  return out;
}

// Notification copy (docs/bos/30 §9.2): the per-language template for the
// event, else the catalogue label (translated) + the record's name.
async function renderCopy(event: ActivityEvent, entity: Record<string, unknown> | null, languages: Set<"ar" | "en">) {
  const [{ data: templates }, { eventMap }, { translate }] = await Promise.all([
    db().from("notification_templates").select("language, title, body, priority").eq("event_type", event.event_type).eq("is_active", true),
    import("@/lib/bos/event-types"),
    import("@/lib/bos/i18n/core"),
  ]);
  const payload = (event.payload ?? {}) as Payload;
  const ctx: Record<string, unknown> = { entity: entity ?? {}, payload, summary: event.summary };
  const fill = (s: string) =>
    s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
      const v = path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), ctx);
      return v === null || v === undefined || typeof v === "object" ? "" : String(v);
    }).replace(/\s+/g, " ").replace(/[:：]\s*$/, "").trim();
  const name = entity ? String(entity.title ?? entity.name ?? entity.subject ?? entity.full_name ?? entity.invoice_number ?? entity.contract_number ?? "") : str(payload.title) ?? "";
  const out = new Map<"ar" | "en", { title: string; body: string | null; priority: "low" | "normal" | "high" | "urgent" }>();
  for (const lang of languages) {
    const t = (templates ?? []).find((x) => x.language === lang);
    if (t) {
      const title = fill(t.title);
      out.set(lang, { title: title || fill(event.summary), body: t.body ? fill(t.body) || null : null, priority: t.priority as "low" | "normal" | "high" | "urgent" });
    } else {
      const label = eventMap.get(event.event_type)?.label;
      out.set(lang, { title: label ? `${translate(lang, label)}${name ? `: ${name}` : ""}` : event.summary, body: label ? event.summary : null, priority: "normal" });
    }
  }
  return out;
}

// Event → subscriptions → recipients → notifications (§77).
export async function dispatchNotifications(event: ActivityEvent, extraRecipients: string[] = []): Promise<void> {
  const client = db();
  const payload = (event.payload ?? {}) as Payload;

  const { data: subs } = await client
    .from("notification_subscriptions")
    .select("*")
    .eq("event_type", event.event_type)
    .eq("is_active", true);

  const onlyRelations = Array.isArray(payload.notify_relations) ? (payload.notify_relations as string[]) : null;
  // The record is needed for conditions and for the notification copy.
  const entity = (subs ?? []).length || extraRecipients.length ? await loadEntity(event) : null;
  const { evaluateConditions } = await import("@/lib/bos/conditions");

  const recipientChannels = new Map<string, Set<string>>();
  const lockedRecipients = new Set<string>();
  const add = (userId: string, channels: string[], locked: boolean) => {
    const set = recipientChannels.get(userId) ?? new Set<string>();
    channels.forEach((c) => set.add(c));
    if (locked) lockedRecipients.add(userId);
    recipientChannels.set(userId, set);
  };

  for (const sub of subs ?? []) {
    // Subscription conditions (docs/bos/30 §9.2), evaluated in code.
    const conds = (Array.isArray(sub.conditions) ? sub.conditions : []) as unknown as Parameters<typeof evaluateConditions>[0];
    if (conds.length && !evaluateConditions(conds, "all", { payload, entity, summary: event.summary })) continue;
    let users: string[] = [];
    if (sub.subscriber_kind === "role" && sub.role_id) {
      users = await activeStaffWithRole(sub.role_id);
    } else if (sub.subscriber_kind === "user" && sub.user_id) {
      users = [sub.user_id];
    } else if (sub.subscriber_kind === "relation" && sub.relation) {
      if (onlyRelations && !onlyRelations.includes(sub.relation)) continue;
      users = await resolveRelation(sub.relation, event);
    }
    users.forEach((u) => add(u, sub.channels, !sub.user_configurable));
  }
  extraRecipients.forEach((u) => add(u, ["in_app"], false));
  // Explicit recipients carried by the event (e.g. team leads on escalation).
  if (Array.isArray(payload.notify_user_ids)) for (const u of payload.notify_user_ids) if (typeof u === "string") add(u, ["in_app"], true);

  // Never notify the person who performed the action about their own action.
  if (event.actor_user_id && event.actor_type === "user") {
    recipientChannels.delete(event.actor_user_id);
  }

  const link = entityHref(event.entity_type, event.entity_id);
  const recipients = [...recipientChannels.keys()];
  if (!recipients.length) return;
  const langs = await languagesFor(recipients);
  const copy = await renderCopy(event, entity, new Set(langs.values()));
  const drafts: NotificationDraft[] = recipients.map((userId) => {
    const c = copy.get(langs.get(userId) ?? "ar")!;
    return {
      userId,
      eventId: event.id,
      eventType: event.event_type,
      title: c.title,
      body: c.body,
      priority: c.priority,
      link,
      entityType: event.entity_type,
      entityId: event.entity_id,
      channels: [...recipientChannels.get(userId)!],
      locked: lockedRecipients.has(userId),
    };
  });

  await insertNotifications(drafts);
}

// Overdue work is aggregated per user per sweep: "🔴 Task overdue" for one
// item, "🔴 N follow-ups overdue" for several (§14 — spec-mandated copy).
export async function dispatchOverdueDigest(events: ActivityEvent[]): Promise<void> {
  const byUser = new Map<string, ActivityEvent[]>();
  for (const event of events) {
    const payload = (event.payload ?? {}) as Payload;
    const userId = str(payload.assignee_user_id);
    if (!userId) continue;
    // Only notify the assignee on the first day of each overdue episode and
    // then as a daily digest — both come from the per-day event.
    const list = byUser.get(userId) ?? [];
    list.push(event);
    byUser.set(userId, list);
  }

  const drafts: NotificationDraft[] = [];
  for (const [userId, list] of byUser) {
    if (list.length === 1) {
      const e = list[0];
      const payload = (e.payload ?? {}) as Payload;
      drafts.push({
        userId,
        eventId: e.id,
        eventType: "task.overdue",
        title: `🔴 Task overdue: ${String(payload.title ?? "")}`,
        link: entityHref(e.entity_type, e.entity_id) ?? "/admin/projects/tasks?view=overdue",
        entityType: e.entity_type,
        entityId: e.entity_id,
        channels: ["in_app"],
        locked: true,
      });
    } else {
      drafts.push({
        userId,
        eventId: list[0].id,
        eventType: "task.overdue",
        title: `🔴 ${list.length} follow-ups overdue`,
        body: list.map((e) => String(((e.payload ?? {}) as Payload).title ?? "")).slice(0, 10).join(" · "),
        link: "/admin/projects/tasks?view=overdue",
        channels: ["in_app"],
        locked: true,
      });
    }
  }
  await insertNotifications(drafts);
}
