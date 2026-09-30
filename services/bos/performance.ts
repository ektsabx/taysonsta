import { nowIso } from "@/lib/bos/clock";
import "server-only";
import { db } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { audit, recordStatus } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { summarize } from "@/services/bos/attendance";
import { computeUserKpis } from "@/services/bos/kpis";

// Performance profiles (§37): a multi-dimensional view built from source
// data — never a single arbitrary score. KPI attainment is shown per
// category; an aggregate appears only when weights are explicitly enabled.

export async function getPerformanceProfile(userId: string, from: string, to: string) {
  const c = db();
  const fromTs = `${from}T00:00:00Z`;
  const toTs = `${to}T23:59:59Z`;
  const count = (p: PromiseLike<{ count: number | null }>) => Promise.resolve(p).then((r) => r.count ?? 0);
  const [tasksDone, tasksOverdue, activities, meetings, leads, dealsWon, wonRows, projects, attendance, time, reviews, kpis] = await Promise.all([
    count(c.from("tasks").select("id", { count: "exact", head: true }).eq("assigned_to", userId).eq("status", "completed").gte("completed_at", fromTs).lte("completed_at", toTs)),
    count(c.from("tasks").select("id", { count: "exact", head: true }).eq("assigned_to", userId).not("status", "in", "(completed,cancelled)").lt("due_date", to)),
    count(c.from("activities").select("id", { count: "exact", head: true }).or(`created_by.eq.${userId},assigned_to.eq.${userId}`).gte("created_at", fromTs).lte("created_at", toTs)),
    count(c.from("meetings").select("id", { count: "exact", head: true }).eq("organizer_id", userId).gte("start_at", fromTs).lte("start_at", toTs)),
    count(c.from("leads").select("id", { count: "exact", head: true }).eq("assigned_to", userId).gte("created_at", fromTs).lte("created_at", toTs)),
    count(c.from("deals").select("id", { count: "exact", head: true }).eq("assigned_to", userId).gte("won_at", fromTs).lte("won_at", toTs)),
    c.from("deals").select("value, currency").eq("assigned_to", userId).gte("won_at", fromTs).lte("won_at", toTs).then((r) => r.data ?? []),
    count(c.from("projects").select("id", { count: "exact", head: true }).eq("pm_id", userId).not("status", "in", "(cancelled)")),
    c.from("attendance_records").select("status, worked_minutes, overtime_minutes, late_minutes, expected_minutes").eq("user_id", userId).gte("work_date", from).lte("work_date", to).then((r) => r.data ?? []),
    c.from("time_entries").select("duration_minutes").eq("user_id", userId).gte("started_at", fromTs).lte("started_at", toTs).then((r) => (r.data ?? []).reduce((s, x) => s + (x.duration_minutes ?? 0), 0)),
    c.from("performance_reviews").select("*").eq("user_id", userId).order("period_end", { ascending: false }).limit(10).then((r) => r.data ?? []),
    computeUserKpis(userId, to, false),
  ]);
  const revenue = new Map<string, number>();
  for (const d of wonRows) revenue.set(d.currency, (revenue.get(d.currency) ?? 0) + Number(d.value));

  const categories = new Map<string, { category: string; items: typeof kpis }>();
  for (const k of kpis) {
    const cat = k.kpi.category ?? "عام";
    const g = categories.get(cat) ?? { category: cat, items: [] };
    g.items.push(k);
    categories.set(cat, g);
  }
  const weighted = kpis.filter((k) => k.kpi.weight_enabled && k.kpi.weight != null && k.attainment != null);
  const weightedScore = weighted.length ? Math.round(weighted.reduce((s, k) => s + Math.min(k.attainment as number, 150) * Number(k.kpi.weight), 0) / weighted.reduce((s, k) => s + Number(k.kpi.weight), 0)) : null;

  return {
    work: { tasksDone, tasksOverdue, activities, meetings, leads, dealsWon, revenue: [...revenue.entries()].map(([currency, amount]) => ({ currency, amount: amount.toFixed(2) })), projects, loggedMinutes: time },
    attendance: summarize(attendance),
    kpiCategories: [...categories.values()],
    weightedScore,
    weightedBreakdown: weighted,
    reviews,
  };
}

export interface ReviewInput {
  period_start: string;
  period_end: string;
  summary: string | null;
  strengths: string | null;
  improvements: string | null;
  goals: string | null;
  // HR & Workforce (docs/bos/28 §25): cycle, ratings, recommendation.
  cycle_id?: string | null;
  review_type?: "periodic" | "annual" | "probation" | "ad_hoc";
  overall_rating?: number | null;
  manager_rating?: number | null;
  competencies?: { name: string; rating: number | null; comment: string | null }[];
  recommendation?: "none" | "promotion" | "salary_increase" | "bonus" | "pip" | "confirm_probation" | "extend_probation" | "termination";
}

export async function saveReview(bos: BosUser, userId: string, input: ReviewInput, reviewId: string | null, submit: boolean) {
  if (input.period_end < input.period_start) throw new ValidationError("نهاية الفترة قبل بدايتها.", { period_end: "غير صالح" });
  if (userId === bos.userId) throw new ValidationError("لا يمكن كتابة مراجعة أداء لنفسك.");
  let id = reviewId;
  if (id) {
    const { data: r } = await db().from("performance_reviews").select("*").eq("id", id).maybeSingle();
    if (!r) throw new NotFoundError();
    if (r.status !== "draft") throw new ValidationError("تم إرسال المراجعة ولا يمكن تعديلها.");
    await db().from("performance_reviews").update({ ...input, status: submit ? "submitted" : "draft" }).eq("id", id);
  } else {
    const { data, error } = await db().from("performance_reviews").insert({ ...input, user_id: userId, reviewer_id: bos.userId, status: submit ? "submitted" : "draft" }).select("id").single();
    if (error) throw error;
    id = data.id;
  }
  await audit({ actorId: bos.userId, action: submit ? "review.submitted" : "review.saved", entityType: "performance_review", entityId: id, newValue: { user_id: userId, ...input } });
  if (submit) {
    await recordStatus("performance_review", id as string, "draft", "submitted", bos.userId);
    const { data: emp } = await db().from("employees").select("id").eq("user_id", userId).maybeSingle();
    await emitEvent({ type: "review.submitted", entityType: "employee", entityId: emp?.id ?? userId, summary: `Performance review submitted (${input.period_start} → ${input.period_end})`, actorId: bos.userId, payload: { review_id: id, employee_user_id: userId } });
  }
  return id as string;
}

export async function acknowledgeReview(bos: BosUser, reviewId: string) {
  const { data: r } = await db().from("performance_reviews").select("*").eq("id", reviewId).maybeSingle();
  if (!r) throw new NotFoundError();
  if (r.user_id !== bos.userId) throw new ValidationError("يمكن للموظف صاحب المراجعة فقط تأكيد الاطلاع.");
  if (r.status !== "submitted") throw new ValidationError("المراجعة ليست بانتظار التأكيد.");
  await db().from("performance_reviews").update({ status: "acknowledged", acknowledged_at: nowIso() }).eq("id", reviewId);
  await recordStatus("performance_review", reviewId, "submitted", "acknowledged", bos.userId);
  await audit({ actorId: bos.userId, action: "review.acknowledged", entityType: "performance_review", entityId: reviewId });
}
