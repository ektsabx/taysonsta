import "server-only";
import { nowIso } from "@/lib/bos/clock";
import { db } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { audit, recordStatus } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";

// Performance (docs/bos/28 §25): goals, review cycles, self assessment,
// 360 feedback and history. KPIs and reviews stay in services/bos/kpis.ts
// and services/bos/performance.ts — this module extends them.

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export interface GoalInput {
  user_id: string;
  title: string;
  description: string | null;
  metric: string | null;
  unit: string | null;
  target_value: string | null;
  weight: string | null;
  start_date: string | null;
  due_date: string | null;
  kpi_id: string | null;
  cycle_id: string | null;
}

export async function listGoals(f: { userIds?: string[] | null; userId?: string; status?: string; cycle?: string }) {
  let q = db().from("performance_goals").select("*, kpis(name), review_cycles(name)").order("due_date", { nullsFirst: false }).limit(500);
  if (f.userIds) q = q.in("user_id", f.userIds.length ? f.userIds : ["00000000-0000-0000-0000-000000000000"]);
  if (f.userId) q = q.eq("user_id", f.userId);
  if (f.status) q = q.eq("status", f.status);
  if (f.cycle) q = q.eq("cycle_id", f.cycle);
  const { data } = await q;
  return data ?? [];
}

export async function saveGoal(bos: BosUser, id: string | null, input: GoalInput) {
  if (input.start_date && input.due_date && input.due_date < input.start_date) throw new ValidationError("تاريخ الاستحقاق قبل البداية.", { due_date: "غير صالح" });
  const row = { ...input, target_value: input.target_value ? Number(input.target_value) : null, weight: input.weight ? Number(input.weight) : null };
  let goalId = id;
  if (id) {
    const { error } = await db().from("performance_goals").update(row).eq("id", id);
    if (error) throw error;
  } else {
    const { data, error } = await db().from("performance_goals").insert({ ...row, created_by: bos.userId }).select("id").single();
    if (error) throw error;
    goalId = data.id;
    const { data: emp } = await db().from("employees").select("id").eq("user_id", input.user_id).maybeSingle();
    if (input.user_id !== bos.userId) await emitEvent({ type: "performance.goal_assigned", entityType: "employee", entityId: emp?.id ?? input.user_id, summary: `New goal: ${input.title}`, actorId: bos.userId, payload: { employee_user_id: input.user_id, goal_id: goalId } });
  }
  await audit({ actorId: bos.userId, action: id ? "goal.updated" : "goal.created", entityType: "performance_goal", entityId: goalId as string, newValue: row });
  return goalId as string;
}

export async function updateGoalProgress(bos: BosUser, id: string, input: { current_value: string | null; progress: number; status: string }) {
  const { data: g } = await db().from("performance_goals").select("*").eq("id", id).maybeSingle();
  if (!g) throw new NotFoundError();
  let progress = input.progress;
  if (input.current_value !== null && g.target_value) progress = Math.max(0, Math.min(100, Math.round((Number(input.current_value) / Number(g.target_value)) * 100)));
  const status = input.status === "completed" || progress >= 100 ? "completed" : input.status;
  await db().from("performance_goals").update({ current_value: input.current_value === null ? null : Number(input.current_value), progress, status }).eq("id", id);
  if (status !== g.status) await recordStatus("performance_goal", id, g.status, status, bos.userId);
  await audit({ actorId: bos.userId, action: "goal.progress", entityType: "performance_goal", entityId: id, oldValue: { progress: g.progress, status: g.status }, newValue: { progress, status } });
}

// ---------------------------------------------------------------------------
// Review cycles
// ---------------------------------------------------------------------------

export async function listCycles() {
  const { data } = await db().from("review_cycles").select("*").order("period_start", { ascending: false });
  return data ?? [];
}

export async function saveCycle(bos: BosUser, id: string | null, input: { name: string; cycle_type: string; period_start: string; period_end: string; self_assessment: boolean; peer_feedback: boolean }) {
  if (input.period_end < input.period_start) throw new ValidationError("نهاية الدورة قبل بدايتها.", { period_end: "غير صالح" });
  let cycleId = id;
  if (id) await db().from("review_cycles").update(input).eq("id", id);
  else cycleId = (await db().from("review_cycles").insert({ ...input, created_by: bos.userId }).select("id").single()).data?.id ?? null;
  await audit({ actorId: bos.userId, action: id ? "review_cycle.updated" : "review_cycle.created", entityType: "review_cycle", entityId: cycleId as string, newValue: input });
  return cycleId as string;
}

// Activating a cycle creates a draft review per employee (reviewer = the
// manager) so managers and employees see what is due.
export async function setCycleStatus(bos: BosUser, id: string, status: "draft" | "active" | "closed", employeeUserIds: { user_id: string; manager_user_id: string | null }[]) {
  const { data: cycle } = await db().from("review_cycles").select("*").eq("id", id).maybeSingle();
  if (!cycle) throw new NotFoundError();
  await db().from("review_cycles").update({ status }).eq("id", id);
  let created = 0;
  if (status === "active") {
    const { data: existing } = await db().from("performance_reviews").select("user_id").eq("cycle_id", id);
    const have = new Set((existing ?? []).map((r) => r.user_id));
    const rows = employeeUserIds.filter((e) => !have.has(e.user_id)).map((e) => ({ user_id: e.user_id, reviewer_id: e.manager_user_id, cycle_id: id, period_start: cycle.period_start, period_end: cycle.period_end, review_type: (cycle.cycle_type === "probation" ? "probation" : cycle.cycle_type === "annual" ? "annual" : "periodic") as "probation" | "annual" | "periodic", status: "draft" }));
    if (rows.length) {
      const { error } = await db().from("performance_reviews").insert(rows);
      if (error) throw error;
      created = rows.length;
    }
  }
  await recordStatus("review_cycle", id, cycle.status, status, bos.userId);
  await audit({ actorId: bos.userId, action: "review_cycle.status", entityType: "review_cycle", entityId: id, newValue: { status, reviews_created: created } });
  return created;
}

export async function submitSelfAssessment(bos: BosUser, reviewId: string, input: { self_assessment: string; self_rating: number | null }) {
  const { data: r } = await db().from("performance_reviews").select("*").eq("id", reviewId).maybeSingle();
  if (!r) throw new NotFoundError();
  if (r.user_id !== bos.userId) throw new ValidationError("التقييم الذاتي لصاحب المراجعة فقط.");
  if (r.status === "acknowledged") throw new ValidationError("المراجعة مغلقة.");
  if (!input.self_assessment.trim()) throw new ValidationError("اكتب التقييم الذاتي.", { self_assessment: "مطلوب" });
  await db().from("performance_reviews").update({ self_assessment: input.self_assessment, self_rating: input.self_rating, self_submitted_at: nowIso() }).eq("id", reviewId);
  await audit({ actorId: bos.userId, action: "review.self_assessment", entityType: "performance_review", entityId: reviewId, newValue: { self_rating: input.self_rating } });
}

// ---------------------------------------------------------------------------
// 360 feedback
// ---------------------------------------------------------------------------

export async function requestFeedback(bos: BosUser, input: { subject_user_id: string; from_user_ids: string[]; relationship: "manager" | "peer" | "direct_report" | "self" | "other"; cycle_id: string | null; review_id: string | null }) {
  if (!input.from_user_ids.length) throw new ValidationError("اختر من سيقدم التقييم.", { from_user_ids: "مطلوب" });
  const { data: subject } = await db().from("employees").select("id, full_name").eq("user_id", input.subject_user_id).maybeSingle();
  let n = 0;
  for (const from of input.from_user_ids) {
    if (from === input.subject_user_id && input.relationship !== "self") continue;
    const { error } = await db().from("performance_feedback").insert({ subject_user_id: input.subject_user_id, from_user_id: from, relationship: input.relationship, cycle_id: input.cycle_id, review_id: input.review_id, requested_by: bos.userId });
    if (error) {
      if (error.code === "23505") continue;
      throw error;
    }
    n++;
    await emitEvent({ type: "performance.feedback_requested", entityType: "employee", entityId: subject?.id ?? input.subject_user_id, summary: `Feedback requested about ${subject?.full_name ?? ""}`, actorId: bos.userId, payload: { assignee_user_id: from } });
  }
  await audit({ actorId: bos.userId, action: "feedback.requested", entityType: "employee", entityId: subject?.id ?? input.subject_user_id, newValue: { count: n, relationship: input.relationship } });
  return n;
}

export async function submitFeedback(bos: BosUser, id: string, input: { rating: number | null; strengths: string | null; improvements: string | null; comments: string | null; is_anonymous: boolean; decline?: boolean }) {
  const { data: f } = await db().from("performance_feedback").select("*").eq("id", id).maybeSingle();
  if (!f) throw new NotFoundError();
  if (f.from_user_id !== bos.userId) throw new ValidationError("هذا الطلب موجه لشخص آخر.");
  if (f.status !== "requested") throw new ValidationError("تم الرد على هذا الطلب.");
  if (input.decline) {
    await db().from("performance_feedback").update({ status: "declined", submitted_at: nowIso() }).eq("id", id);
    return;
  }
  if (!input.strengths && !input.improvements && !input.comments && input.rating === null) throw new ValidationError("أضف تقييماً أو ملاحظات.");
  const { decline: _decline, ...values } = input;
  void _decline;
  await db().from("performance_feedback").update({ ...values, status: "submitted", submitted_at: nowIso() }).eq("id", id);
  await audit({ actorId: bos.userId, action: "feedback.submitted", entityType: "performance_feedback", entityId: id });
}

// Feedback about a person; anonymous entries hide the author except from HR/admin.
export async function listFeedback(f: { subjectUserId?: string; fromUserId?: string; status?: string }, revealAuthors: boolean) {
  let q = db().from("performance_feedback").select("*, review_cycles(name)").order("requested_at", { ascending: false }).limit(300);
  if (f.subjectUserId) q = q.eq("subject_user_id", f.subjectUserId);
  if (f.fromUserId) q = q.eq("from_user_id", f.fromUserId);
  if (f.status) q = q.eq("status", f.status);
  const { data } = await q;
  return (data ?? []).map((x) => (x.is_anonymous && !revealAuthors && x.from_user_id !== f.fromUserId ? { ...x, from_user_id: null } : x));
}

// Timeline of reviews, goals and job changes (performance history).
export async function performanceHistory(userId: string, employeeId: string | null) {
  const [{ data: reviews }, { data: goals }, { data: jobs }] = await Promise.all([
    db().from("performance_reviews").select("id, period_start, period_end, status, overall_rating, recommendation, review_type, review_cycles(name)").eq("user_id", userId).order("period_end", { ascending: false }),
    db().from("performance_goals").select("id, title, status, progress, due_date").eq("user_id", userId).order("due_date", { ascending: false, nullsFirst: false }),
    employeeId ? db().from("employee_job_history").select("*").eq("employee_id", employeeId).order("effective_date", { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  return { reviews: reviews ?? [], goals: goals ?? [], jobs: jobs ?? [] };
}
