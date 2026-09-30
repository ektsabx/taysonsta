import { nowIso, nowMs } from "@/lib/bos/clock";
import "server-only";
import { z } from "zod";
import type { Json } from "@/types/database";
import { db } from "@/lib/bos/db";
import { renderTemplate, type EvaluationContext } from "@/lib/bos/automation/conditions";
import { insertNotifications } from "@/lib/bos/notify";
import { ensureProjectChannel, ensureTeamChannel, postSystemMessage } from "@/lib/bos/chat-core";
import { sendEmail } from "@/lib/bos/integrations/email";
import { getSetting } from "@/lib/bos/settings";
import { entityHref } from "@/lib/bos/links";
import type { ActivityEvent } from "@/lib/bos/notify";

export interface ActionContext extends EvaluationContext {
  event: ActivityEvent;
  ruleId: string;
  ruleName: string;
  emit: (input: {
    type: string;
    entityType: string;
    entityId: string;
    summary: string;
    payload?: Record<string, unknown>;
    links?: { type: string; id: string | null | undefined }[];
    dedupeKey?: string;
  }) => Promise<void>;
}

export interface ActionResult {
  type: string;
  status: "done" | "skipped" | "failed";
  detail?: string;
}

type ActionHandler = (params: Record<string, unknown>, ctx: ActionContext) => Promise<ActionResult>;

const str = (v: unknown) => (typeof v === "string" && v ? v : null);

async function usersWithRole(roleKey: string): Promise<string[]> {
  const { data } = await db()
    .from("user_roles")
    .select("user_id, roles!inner(key)")
    .eq("roles.key", roleKey);
  const ids = (data ?? []).map((r) => r.user_id);
  if (!ids.length) return [];
  const { data: active } = await db()
    .from("employees")
    .select("user_id")
    .in("user_id", ids)
    .in("lifecycle_status", ["active", "onboarding"])
    .is("archived_at", null);
  return (active ?? []).map((e) => e.user_id!).filter(Boolean);
}

async function managerOf(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const { data } = await db().from("employees").select("manager_id").eq("user_id", userId).maybeSingle();
  if (!data?.manager_id) return null;
  const { data: mgr } = await db().from("employees").select("user_id").eq("id", data.manager_id).maybeSingle();
  return mgr?.user_id ?? null;
}

// Resolves "relation:x", "user:<id>", "role:<key>" to one user id.
async function resolveAssignee(spec: string | null, ctx: ActionContext, fallbackRole?: string | null): Promise<string | null> {
  const p = ctx.payload;
  let resolved: string | null = null;
  if (spec?.startsWith("user:")) resolved = spec.slice(5);
  else if (spec?.startsWith("role:")) resolved = (await usersWithRole(spec.slice(5)))[0] ?? null;
  else if (spec?.startsWith("relation:")) {
    const relation = spec.slice(9);
    switch (relation) {
      case "assignee":
        resolved = str(p.assignee_user_id) ?? str(p.organizer_id) ?? str(p.assigned_to) ?? str(p.owner_user_id);
        break;
      case "owner":
        resolved = str(p.owner_user_id);
        break;
      case "pm": {
        const projectId = str(p.project_id);
        if (projectId) {
          const { data } = await db().from("projects").select("pm_id").eq("id", projectId).maybeSingle();
          resolved = data?.pm_id ?? null;
        }
        break;
      }
      case "account_manager": {
        const clientId = str(p.client_id);
        if (clientId) {
          const { data } = await db().from("clients").select("account_manager_id").eq("id", clientId).maybeSingle();
          resolved = data?.account_manager_id ?? null;
        }
        break;
      }
      case "manager_of_assignee":
        resolved = await managerOf(str(p.assignee_user_id));
        break;
      default:
        break;
    }
  }
  if (!resolved && fallbackRole) {
    resolved = (await usersWithRole(fallbackRole))[0] ?? null;
  }
  return resolved;
}

const recipientSchema = z.array(z.object({ kind: z.enum(["role", "user", "relation"]), value: z.string() }));

const handlers: Record<string, ActionHandler> = {
  async notify(params, ctx) {
    const recipients = recipientSchema.parse(params.recipients ?? []);
    const users = new Set<string>();
    for (const r of recipients) {
      if (r.kind === "user") users.add(r.value);
      if (r.kind === "role") (await usersWithRole(r.value)).forEach((u) => users.add(u));
      if (r.kind === "relation") {
        const u = await resolveAssignee(`relation:${r.value}`, ctx);
        if (u) users.add(u);
      }
    }
    if (!users.size) return { type: "notify", status: "skipped", detail: "No recipients resolved" };
    await insertNotifications(
      [...users].map((userId) => ({
        userId,
        eventId: null,
        eventType: `automation.${ctx.event.event_type}`,
        title: renderTemplate(String(params.title ?? ctx.ruleName), ctx),
        body: params.body ? renderTemplate(String(params.body), ctx) : null,
        link: entityHref(ctx.event.entity_type, ctx.event.entity_id),
        entityType: ctx.event.entity_type,
        entityId: ctx.event.entity_id,
        channels: ["in_app"],
      })),
    );
    return { type: "notify", status: "done", detail: `${users.size} recipient(s)` };
  },

  async assign_record(params, ctx) {
    const entity = String(params.entity ?? ctx.event.entity_type);
    const table = ({ lead: "leads", deal: "deals", task: "tasks", ticket: "tickets" } as const)[entity as "lead"];
    if (!table) return { type: "assign_record", status: "failed", detail: `Unsupported entity ${entity}` };

    const { data: row } = await db().from(table).select("id, assigned_to").eq("id", ctx.event.entity_id).maybeSingle();
    if (!row) return { type: "assign_record", status: "failed", detail: "Record not found" };
    if (row.assigned_to && !params.overwrite) return { type: "assign_record", status: "skipped", detail: "Already assigned" };

    let userId: string | null = null;
    const strategy = String(params.strategy ?? "round_robin");
    if (strategy === "specific") {
      userId = str(params.user_id);
    } else {
      const role = String(params.role ?? "business_development");
      const candidates = await usersWithRole(role);
      if (!candidates.length) return { type: "assign_record", status: "skipped", detail: `No active users with role ${role}` };
      if (strategy === "least_loaded") {
        const counts = await Promise.all(
          candidates.map(async (u) => {
            const { count } = await db().from(table).select("id", { count: "exact", head: true }).eq("assigned_to", u);
            return { u, n: count ?? 0 };
          }),
        );
        counts.sort((a, b) => a.n - b.n);
        userId = counts[0].u;
      } else {
        const routing = await getSetting("lead_routing");
        const sorted = [...candidates].sort();
        const lastIndex = routing.last_user_id ? sorted.indexOf(routing.last_user_id) : -1;
        userId = sorted[(lastIndex + 1) % sorted.length];
        await db()
          .from("bos_settings")
          .upsert({ key: "lead_routing", value: { ...routing, last_user_id: userId } as unknown as Json, updated_at: nowIso() });
      }
    }
    if (!userId) return { type: "assign_record", status: "skipped", detail: "No assignee resolved" };

    await db().from(table).update({ assigned_to: userId }).eq("id", row.id);
    await ctx.emit({
      type: `${entity}.assigned`,
      entityType: entity,
      entityId: row.id,
      summary: `Assigned automatically (${strategy})`,
      payload: { assignee_user_id: userId, automation_rule_id: ctx.ruleId },
      dedupeKey: `${entity}.assigned:auto:${row.id}:${userId}`,
    });
    return { type: "assign_record", status: "done", detail: userId };
  },

  async create_task(params, ctx) {
    const p = ctx.payload;
    const assignee = await resolveAssignee(str(params.assignee), ctx, str(params.fallback_role));
    const due = new Date(nowMs());
    due.setDate(due.getDate() + Number(params.due_offset_days ?? 1));
    const link = params.link_from_payload !== false;
    const dedupe = `${ctx.ruleId}:${ctx.event.id}`;

    const { data: existing } = await db().from("tasks").select("id").eq("source_key", dedupe).maybeSingle();
    if (existing) return { type: "create_task", status: "skipped", detail: "Task already created for this event" };

    const projectId = link ? str(p.project_id) ?? (ctx.event.entity_type === "project" ? ctx.event.entity_id : null) : null;
    const dealId = link ? str(p.deal_id) ?? (ctx.event.entity_type === "deal" ? ctx.event.entity_id : null) : null;
    const leadId = link ? str(p.lead_id) ?? (ctx.event.entity_type === "lead" ? ctx.event.entity_id : null) : null;
    const clientId = link ? str(p.client_id) ?? (ctx.event.entity_type === "client" ? ctx.event.entity_id : null) : null;

    const { data: task, error } = await db()
      .from("tasks")
      .insert({
        title: renderTemplate(String(params.title ?? "Follow up"), ctx),
        source_key: dedupe,
        assigned_to: assignee,
        priority: (str(params.priority) as "low" | "medium" | "high" | "urgent") ?? "medium",
        due_date: due.toISOString().slice(0, 10),
        project_id: projectId,
        deal_id: dealId,
        lead_id: leadId,
        client_id: clientId,
        is_required: false,
      })
      .select("id, title")
      .single();
    if (error) return { type: "create_task", status: "failed", detail: error.message };

    if (ctx.event.entity_type === "meeting") {
      await db().from("meetings").update({ follow_up_task_id: task.id }).eq("id", ctx.event.entity_id).is("follow_up_task_id", null);
    }

    await ctx.emit({
      type: "task.created",
      entityType: "task",
      entityId: task.id,
      summary: `Task created: ${task.title}`,
      payload: { assignee_user_id: assignee, project_id: projectId, deal_id: dealId, automation_rule_id: ctx.ruleId },
      links: [
        { type: "project", id: projectId },
        { type: "deal", id: dealId },
        { type: "lead", id: leadId },
        { type: "client", id: clientId },
      ],
    });
    if (assignee) {
      await ctx.emit({
        type: "task.assigned",
        entityType: "task",
        entityId: task.id,
        summary: `Task assigned: ${task.title}`,
        payload: { assignee_user_id: assignee, automation_rule_id: ctx.ruleId },
      });
    }
    return { type: "create_task", status: "done", detail: task.id };
  },

  async create_activity(params, ctx) {
    const p = ctx.payload;
    const assignee = await resolveAssignee(str(params.assignee), ctx, str(params.fallback_role));
    const due = new Date(nowMs());
    due.setDate(due.getDate() + Number(params.due_offset_days ?? 1));
    const leadId = str(p.lead_id) ?? (ctx.event.entity_type === "lead" ? ctx.event.entity_id : null);
    const dealId = str(p.deal_id) ?? (ctx.event.entity_type === "deal" ? ctx.event.entity_id : null);
    const clientId = str(p.client_id) ?? (ctx.event.entity_type === "client" ? ctx.event.entity_id : null);
    const projectId = str(p.project_id) ?? (ctx.event.entity_type === "project" ? ctx.event.entity_id : null);
    if (!leadId && !dealId && !clientId && !projectId) {
      return { type: "create_activity", status: "skipped", detail: "No related record" };
    }
    const { error } = await db().from("activities").insert({
      type: (str(params.activity_type) ?? "follow_up") as "follow_up",
      title: renderTemplate(String(params.title ?? "Follow up"), ctx),
      assigned_to: assignee,
      due_at: due.toISOString(),
      lead_id: leadId,
      deal_id: dealId,
      client_id: clientId,
      project_id: projectId,
    });
    if (error) return { type: "create_activity", status: "failed", detail: error.message };
    return { type: "create_activity", status: "done" };
  },

  async assign_pm(params, ctx) {
    const p = ctx.payload;
    const dealId = str(p.deal_id);
    const projectId = str(p.project_id);
    const query = db().from("projects").select("id, pm_id");
    const { data: project } = projectId
      ? await query.eq("id", projectId).maybeSingle()
      : dealId
        ? await query.eq("deal_id", dealId).maybeSingle()
        : { data: null };
    if (!project) return { type: "assign_pm", status: "skipped", detail: "No project for this event" };

    let pm: string | null = null;
    const strategy = String(params.strategy ?? "round_robin");
    if (strategy === "specific") pm = str(params.user_id);
    else if (strategy === "senior_pool") {
      const delivery = await getSetting("delivery");
      const pool = delivery.senior_pm_user_ids;
      if (!pool.length) return { type: "assign_pm", status: "skipped", detail: "No senior PMs configured (Settings → Delivery)" };
      const counts = await Promise.all(
        pool.map(async (u) => {
          const { count } = await db().from("projects").select("id", { count: "exact", head: true }).eq("pm_id", u).not("status", "in", "(completed,cancelled)");
          return { u, n: count ?? 0 };
        }),
      );
      counts.sort((a, b) => a.n - b.n);
      pm = counts[0].u;
    } else {
      const { data } = await db().rpc("bos_pick_user_for_role", { p_role_key: "project_manager", p_kind: "projects" });
      pm = (data as string | null) ?? null;
    }
    if (!pm) return { type: "assign_pm", status: "skipped", detail: "No PM resolved" };
    if (project.pm_id === pm) return { type: "assign_pm", status: "skipped", detail: "Already assigned" };

    await db().from("projects").update({ pm_id: pm }).eq("id", project.id);
    await db().from("project_members").upsert({ project_id: project.id, user_id: pm, role_label: "Project Manager" }, { onConflict: "project_id,user_id" });
    await db().from("milestones").update({ owner_id: pm }).eq("project_id", project.id).eq("owner_id", project.pm_id ?? "00000000-0000-0000-0000-000000000000");
    await ctx.emit({
      type: "project.pm_assigned",
      entityType: "project",
      entityId: project.id,
      summary: "PM assigned by workflow",
      payload: { project_id: project.id, pm_id: pm, previous_pm_id: project.pm_id, automation_rule_id: ctx.ruleId },
      dedupeKey: `project.pm_assigned:${project.id}:${pm}`,
    });
    return { type: "assign_pm", status: "done", detail: pm };
  },

  async add_project_members(params, ctx) {
    const projectId = str(ctx.payload.project_id) ?? (ctx.event.entity_type === "project" ? ctx.event.entity_id : null);
    if (!projectId) return { type: "add_project_members", status: "skipped", detail: "No project" };
    const users = new Set<string>(Array.isArray(params.user_ids) ? (params.user_ids as string[]) : []);
    for (const role of Array.isArray(params.role_keys) ? (params.role_keys as string[]) : []) {
      const { data } = await db().rpc("bos_pick_user_for_role", { p_role_key: role, p_kind: "tasks" });
      if (data) users.add(data as string);
    }
    if (!users.size) return { type: "add_project_members", status: "skipped", detail: "No users resolved" };
    await db().from("project_members").upsert([...users].map((user_id) => ({ project_id: projectId, user_id })), { onConflict: "project_id,user_id", ignoreDuplicates: true });
    return { type: "add_project_members", status: "done", detail: `${users.size} member(s)` };
  },

  async create_onboarding_checklist(params, ctx) {
    const template = String(params.template ?? "client_onboarding");
    const p = ctx.payload;
    if (template === "employee_onboarding") {
      const employeeId = ctx.event.entity_type === "employee" ? ctx.event.entity_id : str(p.employee_id);
      if (!employeeId) return { type: "create_onboarding_checklist", status: "skipped", detail: "No employee" };
      await db().rpc("bos_start_onboarding", {
        p_subject: "employee", p_template_key: template, p_client: null as unknown as string, p_deal: null as unknown as string,
        p_project: null as unknown as string, p_employee: employeeId,
      });
      return { type: "create_onboarding_checklist", status: "done" };
    }
    const dealId = str(p.deal_id) ?? (ctx.event.entity_type === "deal" ? ctx.event.entity_id : null);
    if (!dealId) return { type: "create_onboarding_checklist", status: "skipped", detail: "No deal" };
    const { data: deal } = await db().from("deals").select("client_id").eq("id", dealId).maybeSingle();
    const { data: project } = await db().from("projects").select("id").eq("deal_id", dealId).maybeSingle();
    if (!deal) return { type: "create_onboarding_checklist", status: "skipped", detail: "Deal not found" };
    await db().rpc("bos_start_onboarding", {
      p_subject: "client", p_template_key: template, p_client: deal.client_id, p_deal: dealId,
      p_project: (project?.id ?? null) as unknown as string, p_employee: null as unknown as string,
    });
    return { type: "create_onboarding_checklist", status: "done" };
  },

  async generate_access_checklist(_params, ctx) {
    const employeeId = ctx.event.entity_type === "employee" ? ctx.event.entity_id : str(ctx.payload.employee_id);
    if (!employeeId) return { type: "generate_access_checklist", status: "skipped", detail: "No employee" };
    const { data, error } = await db().rpc("bos_generate_access_checklist", { p_employee: employeeId, p_actor: ctx.event.actor_user_id as string });
    if (error) return { type: "generate_access_checklist", status: "failed", detail: error.message };
    return { type: "generate_access_checklist", status: "done", detail: `${data ?? 0} item(s)` };
  },

  async ensure_project_channel(_params, ctx) {
    let projectId = str(ctx.payload.project_id) ?? (ctx.event.entity_type === "project" ? ctx.event.entity_id : null);
    if (!projectId && str(ctx.payload.deal_id)) {
      const { data } = await db().from("projects").select("id").eq("deal_id", str(ctx.payload.deal_id)!).maybeSingle();
      projectId = data?.id ?? null;
    }
    if (!projectId) return { type: "ensure_project_channel", status: "skipped", detail: "No project" };
    const channel = await ensureProjectChannel(projectId, ctx.event.actor_user_id);
    return { type: "ensure_project_channel", status: channel ? "done" : "failed", detail: channel ?? "Project not found" };
  },

  async post_system_message(params, ctx) {
    const target = String(params.channel ?? "project");
    let channelId: string | null = null;
    if (target === "project") {
      let projectId = str(ctx.payload.project_id) ?? (ctx.event.entity_type === "project" ? ctx.event.entity_id : null);
      if (!projectId && str(ctx.payload.deal_id)) {
        const { data } = await db().from("projects").select("id").eq("deal_id", str(ctx.payload.deal_id)!).maybeSingle();
        projectId = data?.id ?? null;
      }
      if (projectId) channelId = await ensureProjectChannel(projectId, null);
    } else {
      channelId = await ensureTeamChannel(target === "sales" ? "Sales" : target);
    }
    if (!channelId) return { type: "post_system_message", status: "skipped", detail: "No channel" };
    await postSystemMessage(channelId, renderTemplate(String(params.text ?? ctx.summary ?? ""), ctx), ctx.event.id);
    return { type: "post_system_message", status: "done" };
  },

  async send_email(params, ctx) {
    const to: string[] = [];
    const target = String(params.to ?? "");
    if (target === "client_primary_contact") {
      const clientId = str(ctx.payload.client_id);
      if (clientId) {
        const { data } = await db().from("clients").select("email, primary_contact_id").eq("id", clientId).maybeSingle();
        if (data?.primary_contact_id) {
          const { data: contact } = await db().from("contacts").select("email").eq("id", data.primary_contact_id).maybeSingle();
          if (contact?.email) to.push(contact.email);
        }
        if (!to.length && data?.email) to.push(data.email);
      }
    } else if (target.includes("@")) {
      to.push(target);
    } else if (target.startsWith("relation:") || target.startsWith("user:") || target.startsWith("role:")) {
      const userId = await resolveAssignee(target, ctx);
      if (userId) {
        const { data } = await db().from("employees").select("email").eq("user_id", userId).maybeSingle();
        if (data?.email) to.push(data.email);
      }
    }
    const result = await sendEmail({
      to,
      subject: renderTemplate(String(params.subject ?? ctx.ruleName), ctx),
      text: renderTemplate(String(params.body ?? ""), ctx),
    });
    if (result.status === "sent") return { type: "send_email", status: "done", detail: to.join(", ") };
    if (result.status === "skipped") return { type: "send_email", status: "skipped", detail: result.reason };
    return { type: "send_email", status: "failed", detail: result.error };
  },

  async update_field(params, ctx) {
    const allowed: Record<string, { table: string; fields: string[] }> = {
      lead: { table: "leads", fields: ["priority", "team_id"] },
      deal: { table: "deals", fields: ["probability", "expected_close_date"] },
      task: { table: "tasks", fields: ["priority", "due_date"] },
      project: { table: "projects", fields: ["health"] },
      ticket: { table: "tickets", fields: ["priority", "category"] },
    };
    const entity = String(params.entity ?? ctx.event.entity_type);
    const rule = allowed[entity];
    const field = String(params.field ?? "");
    if (!rule || !rule.fields.includes(field)) return { type: "update_field", status: "failed", detail: `Field ${entity}.${field} is not allowed` };
    const { error } = await db().from(rule.table as "leads").update({ [field]: params.value } as never).eq("id", ctx.event.entity_id);
    if (error) return { type: "update_field", status: "failed", detail: error.message };
    return { type: "update_field", status: "done" };
  },

  async create_invoice(params, ctx) {
    const dealId = str(ctx.payload.deal_id) ?? (ctx.event.entity_type === "deal" ? ctx.event.entity_id : null);
    if (!dealId) return { type: "create_invoice", status: "skipped", detail: "No deal" };
    const index = Number(params.schedule_index ?? 1);
    const { data: schedule } = await db().from("payment_schedules").select("id").eq("deal_id", dealId).eq("sort_order", index).maybeSingle();
    if (!schedule) return { type: "create_invoice", status: "skipped", detail: "No schedule row" };
    const { error } = await db().rpc("bos_create_invoice_from_schedule", { p_schedule_id: schedule.id, p_actor: ctx.event.actor_user_id as string });
    if (error) return { type: "create_invoice", status: "failed", detail: error.message };
    return { type: "create_invoice", status: "done" };
  },

  async create_project(_params, ctx) {
    if (ctx.event.event_type !== "deal.won") return { type: "create_project", status: "skipped", detail: "Only valid for deal.won" };
    const { error } = await db().rpc("bos_process_deal_won", { p_deal_id: ctx.event.entity_id, p_actor: ctx.event.actor_user_id as string });
    if (error) return { type: "create_project", status: "failed", detail: error.message };
    return { type: "create_project", status: "done" };
  },

  async create_payment_schedule(_params, ctx) {
    return handlers.create_project({}, ctx);
  },

  // Status changes validated by the domain transition maps.
  async change_status(params, ctx) {
    const entity = String(params.entity ?? ctx.event.entity_type);
    const to = String(params.status ?? "");
    const id = ctx.event.entity_id;
    if (entity === "ticket") {
      const { changeTicketStatus } = await import("@/services/bos/support");
      await changeTicketStatus({}, id, to as "in_progress", `Automation: ${ctx.ruleName}`);
      return { type: "change_status", status: "done", detail: `ticket → ${to}` };
    }
    if (entity === "task") {
      const allowed: Record<string, string[]> = { pending: ["in_progress", "blocked", "cancelled"], in_progress: ["blocked", "completed", "pending"], blocked: ["in_progress", "pending"], overdue: ["in_progress", "completed"] };
      const { data: t } = await db().from("tasks").select("status").eq("id", id).maybeSingle();
      if (!t) return { type: "change_status", status: "failed", detail: "Task not found" };
      if (!(allowed[t.status] ?? []).includes(to)) return { type: "change_status", status: "failed", detail: `Invalid transition ${t.status} → ${to}` };
      await db().from("tasks").update({ status: to as "in_progress", completed_at: to === "completed" ? nowIso() : null }).eq("id", id);
      await db().rpc("bos_status", { p_entity_type: "task", p_entity_id: id, p_from: t.status, p_to: to, p_by: null as unknown as string, p_reason: `Automation: ${ctx.ruleName}` });
      return { type: "change_status", status: "done", detail: `task → ${to}` };
    }
    return { type: "change_status", status: "failed", detail: `Unsupported entity ${entity}` };
  },

  async create_approval(params, ctx) {
    const { requestApproval } = await import("@/services/bos/approvals");
    const type = String(params.approval_type ?? "scope");
    const approver = String(params.approver ?? "manager");
    await requestApproval({
      type: type as "scope",
      entityType: ctx.event.entity_type,
      entityId: ctx.event.entity_id,
      title: renderTemplate(String(params.title ?? `${ctx.ruleName}`), ctx),
      requestedBy: ctx.event.actor_user_id,
      steps: [approver],
      payload: { automation_rule_id: ctx.ruleId },
    });
    return { type: "create_approval", status: "done", detail: approver };
  },

  async webhook(params, ctx) {
    const integrations = await getSetting("integrations");
    if (!integrations.webhooks.enabled) return { type: "webhook", status: "skipped", detail: "Webhooks disabled" };
    const url = String(params.url ?? "");
    let host: string;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") return { type: "webhook", status: "failed", detail: "Only https URLs are allowed" };
      host = parsed.hostname;
    } catch {
      return { type: "webhook", status: "failed", detail: "Invalid URL" };
    }
    if (!integrations.webhooks.allowed_domains.some((d) => host === d || host.endsWith(`.${d}`))) {
      return { type: "webhook", status: "failed", detail: `Domain ${host} is not allowlisted` };
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: ctx.event.event_type, entity_type: ctx.event.entity_type, entity_id: ctx.event.entity_id, payload: ctx.payload }),
    }).catch((e: Error) => ({ ok: false, status: 0, statusText: e.message }) as Response);
    return res.ok ? { type: "webhook", status: "done" } : { type: "webhook", status: "failed", detail: `HTTP ${res.status}` };
  },
};

export const automationActionTypes = Object.keys(handlers);

export const actionLabels: Record<string, string> = {
  notify: "إرسال إشعار",
  assign_record: "تعيين مسؤول",
  create_task: "إنشاء مهمة",
  create_activity: "إنشاء نشاط متابعة",
  assign_pm: "تعيين مدير مشروع",
  add_project_members: "إضافة أعضاء للمشروع",
  create_onboarding_checklist: "إنشاء قائمة تهيئة",
  generate_access_checklist: "إنشاء قائمة الصلاحيات",
  ensure_project_channel: "إنشاء قناة المشروع",
  post_system_message: "رسالة نظام في قناة",
  send_email: "إرسال بريد إلكتروني",
  update_field: "تحديث حقل",
  create_invoice: "إنشاء فاتورة",
  create_project: "إنشاء مشروع",
  create_payment_schedule: "إنشاء جدول دفعات",
  webhook: "Webhook",
  change_status: "تغيير الحالة",
  create_approval: "طلب موافقة",
};

export async function runAction(type: string, params: Record<string, unknown>, ctx: ActionContext): Promise<ActionResult> {
  const handler = handlers[type];
  if (!handler) return { type, status: "failed", detail: `Unknown action ${type}` };
  try {
    return await handler(params ?? {}, ctx);
  } catch (error) {
    return { type, status: "failed", detail: error instanceof Error ? error.message : String(error) };
  }
}
