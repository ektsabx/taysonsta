import { nowIso, nowMs } from "@/lib/bos/clock";
import "server-only";
import type { Json } from "@/types/database";
import { db, type Tables, type DbEnum } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { audit, recordStatus } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { getSetting } from "@/lib/bos/settings";
import { ForbiddenError, ValidationError } from "@/lib/bos/errors";
import { userNameMap } from "@/services/bos/shared";

// Unified approval engine (docs/bos/30 §18, doc 31 Phase 6).
// • Steps run in order; a step written "role:finance|role:executive" (or an
//   array of specs) is PARALLEL — every member must approve.
// • Decisions: approve, reject (reason), request changes (comment) → the
//   requester resubmits (new version; history kept).
// • Due dates from Settings (approval SLA), reminders + escalation (sweep).
// • Delegation: an active delegation routes new approvals to the substitute
//   and lets them decide open ones.
// • Amount thresholds add steps (payload.amount_base, or amount+currency).
// Source modules keep their own records; they only receive the outcome.

export type ApprovalType = DbEnum<"approval_type">;
export type Approval = Tables<"approvals">;
export type Decision = "approved" | "rejected" | "changes_requested";

interface ApproverSpec {
  userId?: string | null;
  roleId?: string | null;
  contactId?: string | null;
}
type StepSpec = string | ApproverSpec | (string | ApproverSpec)[];

async function activeDelegate(userId: string, type: string): Promise<string | null> {
  const today = nowIso().slice(0, 10);
  const { data } = await db()
    .from("approval_delegations")
    .select("delegate_user_id, approval_types")
    .eq("user_id", userId)
    .eq("is_active", true)
    .lte("starts_on", today)
    .gte("ends_on", today)
    .order("created_at", { ascending: false });
  const d = (data ?? []).find((x) => !x.approval_types.length || x.approval_types.includes(type));
  return d?.delegate_user_id ?? null;
}

// "manager" | "role:<key>" | "user:<id>" → concrete approver.
export async function resolveApprover(spec: string, requesterUserId: string | null): Promise<ApproverSpec> {
  const client = db();
  if (spec.startsWith("user:")) return { userId: spec.slice(5) };
  if (spec.startsWith("role:")) {
    const { data } = await client.from("roles").select("id").eq("key", spec.slice(5)).maybeSingle();
    return { roleId: data?.id ?? null };
  }
  // manager of the requester, falling back to HR → Admin roles
  if (requesterUserId) {
    const { data: emp } = await client.from("employees").select("manager_id").eq("user_id", requesterUserId).maybeSingle();
    if (emp?.manager_id) {
      const { data: mgr } = await client.from("employees").select("user_id, lifecycle_status").eq("id", emp.manager_id).maybeSingle();
      if (mgr?.user_id && ["active", "onboarding", "on_leave"].includes(mgr.lifecycle_status)) return { userId: mgr.user_id };
    }
  }
  const { data: hr } = await client.from("roles").select("id").eq("key", "hr").maybeSingle();
  const { count } = hr ? await client.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role_id", hr.id) : { count: 0 };
  if (hr && (count ?? 0) > 0) return { roleId: hr.id };
  const { data: admin } = await client.from("roles").select("id").eq("key", "admin").maybeSingle();
  return { roleId: admin?.id ?? null };
}

function stepMembers(step: StepSpec): (string | ApproverSpec)[] {
  if (Array.isArray(step)) return step;
  if (typeof step === "string") return step.split("|").map((s) => s.trim()).filter(Boolean);
  return [step];
}

async function resolveStep(step: StepSpec, requester: string | null, type: string): Promise<(ApproverSpec & { delegatedFrom?: string | null })[]> {
  const out: (ApproverSpec & { delegatedFrom?: string | null })[] = [];
  for (const m of stepMembers(step)) {
    const spec = typeof m === "string" ? await resolveApprover(m, requester) : m;
    if (spec.userId) {
      const delegate = await activeDelegate(spec.userId, type);
      if (delegate) {
        out.push({ userId: delegate, delegatedFrom: spec.userId });
        continue;
      }
    }
    out.push(spec);
  }
  // Two members may resolve to the same approver (same manager, delegation):
  // one decision is enough.
  const seen = new Set<string>();
  return out.filter((m) => {
    const key = `${m.userId ?? ""}|${m.roleId ?? ""}|${m.contactId ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function dueAt(): Promise<string> {
  const wf = await getSetting("approval_workflow");
  return new Date(nowMs() + wf.sla_hours * 3600_000).toISOString();
}

async function amountBase(payload: Record<string, unknown> | undefined): Promise<number | null> {
  if (!payload) return null;
  if (payload.amount_base !== undefined && payload.amount_base !== null && Number.isFinite(Number(payload.amount_base))) return Number(payload.amount_base);
  if (payload.amount !== undefined && typeof payload.currency === "string") {
    const { data } = await db().rpc("bos_to_base", { p_amount: Number(payload.amount), p_currency: payload.currency });
    return data === null || data === undefined ? null : Number(data);
  }
  return null;
}

export interface RequestApprovalInput {
  type: ApprovalType;
  entityType: string;
  entityId: string;
  title: string;
  requestedBy: string | null;
  requestedByContactId?: string | null;
  steps: StepSpec[];
  clientVisible?: boolean;
  version?: number;
  payload?: Record<string, unknown>;
  links?: { type: string; id: string | null | undefined }[];
}

async function insertStep(base: { type: ApprovalType; entityType: string; entityId: string; title: string; groupId: string; step: number; totalSteps: number; requestedBy: string | null; requestedByContactId: string | null; clientVisible: boolean | null; version: number; payload: Json }, members: (ApproverSpec & { delegatedFrom?: string | null })[], actorId: string | null, links?: { type: string; id: string | null | undefined }[]) {
  const due = await dueAt();
  const rows = members.map((m) => ({
    approval_type: base.type,
    entity_type: base.entityType,
    entity_id: base.entityId,
    title: base.title,
    group_id: base.groupId,
    step: base.step,
    total_steps: base.totalSteps,
    requested_by: base.requestedBy,
    requested_by_contact_id: base.requestedByContactId,
    approver_user_id: m.userId ?? null,
    approver_role_id: m.roleId ?? null,
    approver_contact_id: m.contactId ?? null,
    client_visible: base.clientVisible ?? Boolean(m.contactId),
    version: base.version,
    payload: base.payload,
    due_at: m.contactId ? null : due,
    delegated_from: m.delegatedFrom ?? null,
  }));
  const { data, error } = await db().from("approvals").insert(rows).select("*");
  if (error) throw error;
  for (const a of data ?? []) {
    await recordStatus("approval", a.id, null, "pending", actorId);
    await emitEvent({
      type: "approval.requested",
      entityType: base.entityType,
      entityId: base.entityId,
      summary: `Approval requested: ${base.title}${base.totalSteps > 1 ? ` (step ${base.step}/${base.totalSteps})` : ""}`,
      payload: { approval_id: a.id, approval_type: base.type, title: base.title, approver_user_id: a.approver_user_id, approver_role_id: a.approver_role_id, creator_user_id: base.requestedBy, delegated_from: a.delegated_from, due_at: a.due_at, ...((base.payload as Record<string, unknown>) ?? {}), steps: undefined },
      links,
      actorId,
      actorType: base.requestedByContactId && base.step === 1 ? "client" : "user",
      visibility: a.client_visible ? "client" : "internal",
    });
  }
  return data ?? [];
}

// Creates step 1 now; later steps are created when the previous completes.
export async function requestApproval(input: RequestApprovalInput): Promise<Approval> {
  let steps = [...input.steps];
  if (!steps.length) throw new ValidationError("لا توجد خطوات موافقة.");
  const client = db();

  // Amount thresholds (Settings → approval workflow) append extra steps.
  const wf = await getSetting("approval_workflow");
  const rules = wf.thresholds.filter((t) => t.approval_type === input.type);
  if (rules.length) {
    const amount = await amountBase(input.payload);
    if (amount !== null) for (const r of rules.sort((a, b) => a.min_amount - b.min_amount)) if (amount >= r.min_amount) steps = [...steps, ...r.add_steps];
  }

  // A new version supersedes open approvals (pending or changes requested) of the same type for the entity.
  const { data: open } = await client.from("approvals").select("id, status").eq("entity_type", input.entityType).eq("entity_id", input.entityId).eq("approval_type", input.type).in("status", ["pending", "changes_requested"]);
  for (const p of open ?? []) {
    await client.from("approvals").update({ status: "superseded", decided_at: nowIso() }).eq("id", p.id);
    await recordStatus("approval", p.id, p.status, "superseded", input.requestedBy, "New version requested");
  }

  const members = await resolveStep(steps[0], input.requestedBy, input.type);
  if (!members.length || members.some((m) => !m.userId && !m.roleId && !m.contactId)) {
    throw new ValidationError("تعذر تحديد جهة الموافقة. راجع سياسات الموافقة في الإعدادات.");
  }

  const groupId = crypto.randomUUID();
  const created = await insertStep(
    {
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId,
      title: input.title,
      groupId,
      step: 1,
      totalSteps: steps.length,
      requestedBy: input.requestedBy,
      requestedByContactId: input.requestedByContactId ?? null,
      clientVisible: input.clientVisible ?? null,
      version: input.version ?? 1,
      payload: { ...(input.payload ?? {}), steps } as unknown as Json,
    },
    members,
    input.requestedBy,
    input.links,
  );
  return created[0];
}

export async function canDecide(bos: BosUser | null, approval: Approval, contactId?: string | null): Promise<boolean> {
  if (approval.status !== "pending") return false;
  if (contactId) return approval.approver_contact_id === contactId;
  if (!bos) return false;
  if (approval.approver_user_id === bos.userId) return true;
  if (approval.approver_role_id) {
    const { data } = await db().from("user_roles").select("user_id").eq("user_id", bos.userId).eq("role_id", approval.approver_role_id).maybeSingle();
    if (data) return true;
  }
  // Substitute: an active delegation from the assigned approver to me.
  if (approval.approver_user_id && (await activeDelegate(approval.approver_user_id, approval.approval_type)) === bos.userId) return true;
  return bos.isSuperAdmin || bos.permissions.get("approvals.manage") === "all";
}

export type ApprovalOutcomeHandler = (approval: Approval, decision: "approved" | "rejected", actor: { userId: string | null; contactId: string | null }, comment: string | null) => Promise<void>;

const handlers = new Map<ApprovalType, ApprovalOutcomeHandler>();

export function onApprovalDecided(type: ApprovalType, handler: ApprovalOutcomeHandler) {
  handlers.set(type, handler);
}

export async function decideApproval(approvalId: string, decision: Decision, comment: string | null, actor: { bos: BosUser | null; contactId?: string | null }): Promise<Approval> {
  const client = db();
  const { data: approval } = await client.from("approvals").select("*").eq("id", approvalId).maybeSingle();
  if (!approval) throw new ValidationError("طلب الموافقة غير موجود.");
  if (!(await canDecide(actor.bos, approval, actor.contactId))) {
    throw new ForbiddenError("لست جهة الموافقة على هذا الطلب، أو تم اتخاذ القرار مسبقاً.");
  }
  // Self-approval is blocked for personal requests (leave, expenses, corrections, overtime, access).
  const personal: ApprovalType[] = ["leave", "expense", "attendance_correction", "overtime", "access_request", "loan", "bonus", "hr_request", "salary_adjustment"];
  if (actor.bos && approval.requested_by === actor.bos.userId && personal.includes(approval.approval_type) && !actor.bos.isSuperAdmin) {
    throw new ForbiddenError("لا يمكنك الموافقة على طلبك الشخصي.");
  }
  if (decision === "rejected" && !comment?.trim()) throw new ValidationError("سبب الرفض مطلوب.", { comment: "سبب الرفض مطلوب" });
  if (decision === "changes_requested" && !comment?.trim()) throw new ValidationError("اكتب التعديلات المطلوبة.", { comment: "مطلوب" });

  const actorUserId = actor.bos?.userId ?? null;
  const { data: updated, error } = await client
    .from("approvals")
    .update({ status: decision, decided_at: nowIso(), decided_by_user_id: actorUserId, decided_by_contact_id: actor.contactId ?? null, decision_comment: comment?.trim() || null })
    .eq("id", approvalId)
    .eq("status", "pending")
    .select("*")
    .single();
  if (error || !updated) throw new ValidationError("تم اتخاذ قرار على هذا الطلب بالفعل.");

  await recordStatus("approval", approvalId, "pending", decision, actorUserId, comment);
  await audit({
    actorId: actorUserId,
    actorType: actor.contactId ? "client" : "user",
    action: `approval.${decision}`,
    entityType: approval.entity_type,
    entityId: approval.entity_id,
    oldValue: { status: "pending" },
    newValue: { status: decision, approval_type: approval.approval_type, step: approval.step },
    reason: comment,
    metadata: { approval_id: approvalId, contact_id: actor.contactId ?? null, on_behalf_of: approval.approver_user_id && approval.approver_user_id !== actorUserId ? approval.approver_user_id : null },
  });

  // Parallel siblings of this step.
  const { data: siblings } = approval.group_id
    ? await client.from("approvals").select("id, status").eq("group_id", approval.group_id).eq("step", approval.step).neq("id", approvalId)
    : { data: [] as { id: string; status: string }[] };
  const pendingSiblings = (siblings ?? []).filter((s) => s.status === "pending");

  if (decision !== "approved") {
    // Rejection / changes requested ends the step: close the other open members.
    for (const s of pendingSiblings) {
      await client.from("approvals").update({ status: "cancelled", decided_at: nowIso() }).eq("id", s.id).eq("status", "pending");
      await recordStatus("approval", s.id, "pending", "cancelled", actorUserId, `Step closed: ${decision}`);
    }
  }

  const steps = ((approval.payload as { steps?: StepSpec[] })?.steps ?? []) as StepSpec[];
  const waitingParallel = decision === "approved" && pendingSiblings.length > 0;
  const isFinal = decision === "rejected" || (decision === "approved" && !waitingParallel && approval.step >= approval.total_steps);

  if (decision === "approved" && !waitingParallel && !isFinal) {
    const members = await resolveStep(steps[approval.step] ?? "manager", approval.requested_by, approval.approval_type);
    await insertStep(
      { type: approval.approval_type, entityType: approval.entity_type, entityId: approval.entity_id, title: approval.title, groupId: approval.group_id ?? approval.id, step: approval.step + 1, totalSteps: approval.total_steps, requestedBy: approval.requested_by, requestedByContactId: approval.requested_by_contact_id, clientVisible: approval.client_visible, version: approval.version, payload: approval.payload },
      members,
      actorUserId,
    );
  } else if (isFinal) {
    const handler = handlers.get(approval.approval_type);
    if (handler) await handler(updated, decision as "approved" | "rejected", { userId: actorUserId, contactId: actor.contactId ?? null }, comment);
  }

  await emitEvent({
    type: decision === "changes_requested" ? "approval.changes_requested" : "approval.decided",
    entityType: approval.entity_type,
    entityId: approval.entity_id,
    summary: `${decision === "approved" ? "Approved" : decision === "rejected" ? "Rejected" : "Changes requested"}: ${approval.title}${isFinal || decision === "changes_requested" ? "" : ` (step ${approval.step}/${approval.total_steps})`}`,
    payload: { approval_id: approvalId, approval_type: approval.approval_type, title: approval.title, decision, final: isFinal, creator_user_id: approval.requested_by, comment, waiting_parallel: waitingParallel },
    actorId: actorUserId,
    actorType: actor.contactId ? "client" : "user",
    visibility: approval.client_visible ? "client" : "internal",
  });

  return updated;
}

// The requester answers "changes requested": a new version of the same
// request starts again from step 1 (the earlier round stays in history).
export async function resubmitApproval(bos: BosUser, approvalId: string, note: string | null): Promise<Approval> {
  const { data: a } = await db().from("approvals").select("*").eq("id", approvalId).maybeSingle();
  if (!a) throw new ValidationError("طلب الموافقة غير موجود.");
  if (a.status !== "changes_requested") throw new ValidationError("إعادة التقديم متاحة بعد طلب التعديلات فقط.");
  if (a.requested_by !== bos.userId && !bos.isSuperAdmin) throw new ForbiddenError("إعادة التقديم لصاحب الطلب فقط.");
  const { data: later } = await db().from("approvals").select("id").eq("entity_type", a.entity_type).eq("entity_id", a.entity_id).eq("approval_type", a.approval_type).gt("requested_at", a.requested_at).limit(1);
  if (later?.length) throw new ValidationError("تمت إعادة تقديم هذا الطلب بالفعل.");
  const payload = (a.payload ?? {}) as Record<string, unknown>;
  const steps = (payload.steps as StepSpec[] | undefined) ?? ["manager"];
  const created = await requestApproval({ type: a.approval_type, entityType: a.entity_type, entityId: a.entity_id, title: a.title, requestedBy: a.requested_by, requestedByContactId: a.requested_by_contact_id, steps, clientVisible: a.client_visible, version: a.version + 1, payload: { ...payload, steps: undefined, resubmit_note: note?.trim() || null, previous_approval_id: a.id } });
  await audit({ actorId: bos.userId, action: "approval.resubmitted", entityType: a.entity_type, entityId: a.entity_id, newValue: { approval_id: created.id, version: a.version + 1 }, reason: note });
  await emitEvent({ type: "approval.resubmitted", entityType: a.entity_type, entityId: a.entity_id, summary: `Resubmitted: ${a.title}`, payload: { approval_id: created.id, approval_type: a.approval_type, title: a.title, note }, actorId: bos.userId });
  return created;
}

// Sweep: reminders for overdue approvals and escalation to the approver's manager.
export async function remindOverdueApprovals(): Promise<number> {
  const wf = await getSetting("approval_workflow");
  const now = nowMs();
  const { data } = await db().from("approvals").select("*").eq("status", "pending").not("due_at", "is", null).lt("due_at", new Date(now).toISOString()).limit(500);
  let n = 0;
  for (const a of data ?? []) {
    if (a.reminded_at && now - new Date(a.reminded_at).getTime() < wf.remind_every_hours * 3600_000) continue;
    const hoursOverdue = Math.round((now - new Date(a.due_at!).getTime()) / 3600_000);
    let escalation: string | null = null;
    if (wf.escalate_after_hours > 0 && hoursOverdue >= wf.escalate_after_hours && a.approver_user_id) {
      const { data: emp } = await db().from("employees").select("manager_id").eq("user_id", a.approver_user_id).maybeSingle();
      if (emp?.manager_id) escalation = (await db().from("employees").select("user_id").eq("id", emp.manager_id).maybeSingle()).data?.user_id ?? null;
    }
    await db().from("approvals").update({ reminded_at: new Date(now).toISOString() }).eq("id", a.id);
    await emitEvent({
      type: "approval.overdue",
      entityType: a.entity_type,
      entityId: a.entity_id,
      summary: `Approval overdue (${hoursOverdue}h): ${a.title}`,
      payload: { approval_id: a.id, approval_type: a.approval_type, title: a.title, approver_user_id: a.approver_user_id, approver_role_id: a.approver_role_id, hours_overdue: hoursOverdue, escalation_user_id: escalation },
      dedupeKey: `approval.overdue:${a.id}:${new Date(now).toISOString().slice(0, 13)}`,
    });
    n++;
  }
  return n;
}

// Delegations
export async function listDelegations(userId?: string) {
  let q = db().from("approval_delegations").select("*").order("starts_on", { ascending: false }).limit(200);
  if (userId) q = q.or(`user_id.eq.${userId},delegate_user_id.eq.${userId}`);
  const { data } = await q;
  return data ?? [];
}

export async function createDelegation(bos: BosUser, input: { user_id: string; delegate_user_id: string; starts_on: string; ends_on: string; approval_types: string[]; reason: string | null }) {
  const manageAll = bos.isSuperAdmin || bos.permissions.get("approvals.manage") === "all";
  if (input.user_id !== bos.userId && !manageAll) throw new ForbiddenError("يمكنك تفويض موافقاتك أنت فقط.");
  if (input.user_id === input.delegate_user_id) throw new ValidationError("لا يمكن التفويض لنفس الشخص.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.starts_on) || !/^\d{4}-\d{2}-\d{2}$/.test(input.ends_on) || input.ends_on < input.starts_on) throw new ValidationError("الفترة غير صالحة.");
  const { data: del } = await db().from("employees").select("lifecycle_status").eq("user_id", input.delegate_user_id).maybeSingle();
  if (!del || !["active", "onboarding", "on_leave"].includes(del.lifecycle_status)) throw new ValidationError("المفوَّض إليه يجب أن يكون موظفاً نشطاً.");
  // No chains: the delegate must not be delegating themselves in that period.
  const { data: chain } = await db().from("approval_delegations").select("id").eq("user_id", input.delegate_user_id).eq("is_active", true).lte("starts_on", input.ends_on).gte("ends_on", input.starts_on).limit(1);
  if (chain?.length) throw new ValidationError("المفوَّض إليه لديه تفويض نشط في نفس الفترة.");
  const { data, error } = await db().from("approval_delegations").insert({ ...input, created_by: bos.userId }).select("id").single();
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "approval.delegation_created", entityType: "user", entityId: input.user_id, newValue: input });
  return data.id;
}

export async function endDelegation(bos: BosUser, id: string) {
  const { data: d } = await db().from("approval_delegations").select("*").eq("id", id).maybeSingle();
  if (!d) throw new ValidationError("التفويض غير موجود.");
  const manageAll = bos.isSuperAdmin || bos.permissions.get("approvals.manage") === "all";
  if (d.user_id !== bos.userId && !manageAll) throw new ForbiddenError();
  await db().from("approval_delegations").update({ is_active: false }).eq("id", id);
  await audit({ actorId: bos.userId, action: "approval.delegation_ended", entityType: "user", entityId: d.user_id, newValue: { delegation_id: id } });
}

// Delay report: decision times and overdue work per type and approver.
export async function approvalDelayReport(days = 90) {
  const since = new Date(nowMs() - days * 86400_000).toISOString();
  const [{ data: decided }, { data: pending }] = await Promise.all([
    db().from("approvals").select("approval_type, requested_at, decided_at, decided_by_user_id, status, due_at").gte("requested_at", since).in("status", ["approved", "rejected", "changes_requested"]).limit(5000),
    db().from("approvals").select("approval_type, approver_user_id, approver_role_id, due_at, requested_at").eq("status", "pending").limit(5000),
  ]);
  const now = nowMs();
  const byType = new Map<string, { decided: number; hours: number; late: number; pending: number; overdue: number }>();
  const row = (t: string) => byType.get(t) ?? byType.set(t, { decided: 0, hours: 0, late: 0, pending: 0, overdue: 0 }).get(t)!;
  for (const a of decided ?? []) {
    const r = row(a.approval_type);
    r.decided++;
    r.hours += (new Date(a.decided_at!).getTime() - new Date(a.requested_at).getTime()) / 3600_000;
    if (a.due_at && new Date(a.decided_at!).getTime() > new Date(a.due_at).getTime()) r.late++;
  }
  const byApprover = new Map<string, { pending: number; overdue: number; oldestHours: number }>();
  for (const a of pending ?? []) {
    const r = row(a.approval_type);
    r.pending++;
    const overdue = !!a.due_at && new Date(a.due_at).getTime() < now;
    if (overdue) r.overdue++;
    const key = a.approver_user_id ? `user:${a.approver_user_id}` : `role:${a.approver_role_id}`;
    const ap = byApprover.get(key) ?? { pending: 0, overdue: 0, oldestHours: 0 };
    ap.pending++;
    if (overdue) ap.overdue++;
    ap.oldestHours = Math.max(ap.oldestHours, Math.round((now - new Date(a.requested_at).getTime()) / 3600_000));
    byApprover.set(key, ap);
  }
  return {
    types: [...byType.entries()].map(([type, r]) => ({ type, ...r, avgHours: r.decided ? Math.round((r.hours / r.decided) * 10) / 10 : null })).sort((a, b) => b.pending - a.pending || b.decided - a.decided),
    approvers: [...byApprover.entries()].map(([key, r]) => ({ key, ...r })).sort((a, b) => b.overdue - a.overdue || b.pending - a.pending),
  };
}

export async function listApprovalsForEntity(entityType: string, entityId: string) {
  const { data } = await db().from("approvals").select("*").eq("entity_type", entityType).eq("entity_id", entityId).order("requested_at", { ascending: false });
  return data ?? [];
}

export async function describeApprovers(approvals: Approval[]) {
  const names = await userNameMap();
  const roleIds = approvals.map((a) => a.approver_role_id).filter(Boolean) as string[];
  const contactIds = approvals.map((a) => a.approver_contact_id).filter(Boolean) as string[];
  const [{ data: roles }, { data: contacts }] = await Promise.all([
    roleIds.length ? db().from("roles").select("id, name").in("id", roleIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    contactIds.length ? db().from("contacts").select("id, full_name").in("id", contactIds) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);
  const roleNames = new Map((roles ?? []).map((r) => [r.id, r.name]));
  const contactNames = new Map((contacts ?? []).map((c) => [c.id, c.full_name]));
  return approvals.map((a) => ({
    ...a,
    approverLabel: a.approver_user_id
      ? `${names.get(a.approver_user_id) ?? "—"}${a.delegated_from ? ` (نيابةً عن ${names.get(a.delegated_from) ?? "—"})` : ""}`
      : a.approver_role_id
        ? `دور: ${roleNames.get(a.approver_role_id) ?? "—"}`
        : a.approver_contact_id
          ? `العميل: ${contactNames.get(a.approver_contact_id) ?? "—"}`
          : "—",
    requesterLabel: a.requested_by ? names.get(a.requested_by) ?? "—" : a.requested_by_contact_id ? "العميل" : "النظام",
    deciderLabel: a.decided_by_user_id ? names.get(a.decided_by_user_id) ?? "—" : a.decided_by_contact_id ? contactNames.get(a.decided_by_contact_id) ?? "العميل" : null,
  }));
}
