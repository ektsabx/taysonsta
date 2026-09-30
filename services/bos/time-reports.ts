import "server-only";
import { db } from "@/lib/bos/db";
import { can, scopeUserIds, type BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { nowIso } from "@/lib/bos/clock";
import { ForbiddenError, ValidationError } from "@/lib/bos/errors";
import type { Scope } from "@/lib/bos/permissions";

// Time tracking approvals and reports (docs/bos/30 §22, doc 31 Phase 15) on
// the existing time_entries (timer + manual). Hours count once approved (or
// when no approval is required); pending hours are shown separately. Cost
// comes from the existing per-entry cost (hourly rate trigger), per currency.

export async function reviewTime(bos: BosUser, ids: string[], decision: "approved" | "rejected", reason: string | null) {
  if (bos.permissions.get("timesheets.approve") !== "all" && !bos.isSuperAdmin) {
    // Managers approve their team (team scope).
    if (!bos.permissions.get("timesheets.approve")) throw new ForbiddenError();
  }
  if (!ids.length || ids.length > 500) throw new ValidationError("اختر إدخالات.");
  if (decision === "rejected" && !reason?.trim()) throw new ValidationError("سبب الرفض مطلوب.", { reason: "مطلوب" });
  const { data: rows } = await db().from("time_entries").select("id, user_id, approval_status, duration_minutes").in("id", ids);
  const scope = bos.permissions.get("timesheets.approve") as Scope;
  const allowed = await scopeUserIds(bos, scope);
  const ok = (rows ?? []).filter((r) => r.approval_status === "pending" && r.user_id !== bos.userId && (!allowed || allowed.includes(r.user_id)));
  if (!ok.length) throw new ValidationError("لا توجد إدخالات بانتظار اعتمادك (لا يمكن اعتماد ساعاتك بنفسك).");
  await db().from("time_entries").update({ approval_status: decision, approved_by: bos.userId, approved_at: nowIso(), rejection_reason: decision === "rejected" ? reason!.trim().slice(0, 500) : null }).in("id", ok.map((r) => r.id));
  await audit({ actorId: bos.userId, action: `time.${decision}`, entityType: "time_entry", entityId: null, newValue: { count: ok.length }, reason });
  const byUser = new Map<string, number>();
  for (const r of ok) byUser.set(r.user_id, (byUser.get(r.user_id) ?? 0) + (r.duration_minutes ?? 0));
  for (const [u, min] of byUser) await emitEvent({ type: "time.reviewed", entityType: "employee", entityId: u, summary: `Hours ${decision}: ${(min / 60).toFixed(1)} h`, actorId: bos.userId, payload: { result: decision === "approved" ? "اعتُمدت" : "رُفضت", reason: reason ?? `${(min / 60).toFixed(1)} h`, notify_user_ids: [u] } });
  return ok.length;
}

export interface TimeFilter { from: string; to: string; project_id?: string | null; user_id?: string | null; billable?: "1" | "0" | null }

export async function timeReport(bos: BosUser, f: TimeFilter) {
  if (!can(bos, "timesheets.read")) throw new ForbiddenError();
  const users = await scopeUserIds(bos, bos.permissions.get("timesheets.read") as Scope);
  let q = db().from("time_entries").select("id, user_id, project_id, task_id, started_at, duration_minutes, billable, cost_amount, cost_currency, approval_status, description, projects(name, currency), tasks(title, estimated_minutes)").gte("started_at", `${f.from}T00:00:00Z`).lte("started_at", `${f.to}T23:59:59Z`).not("ended_at", "is", null).limit(20000);
  if (users) q = q.in("user_id", users);
  if (f.project_id) q = q.eq("project_id", f.project_id);
  if (f.user_id) q = q.eq("user_id", f.user_id);
  if (f.billable === "1") q = q.eq("billable", true);
  if (f.billable === "0") q = q.eq("billable", false);
  const { data } = await q;
  const rows = data ?? [];
  const counted = (r: (typeof rows)[number]) => r.approval_status === "approved" || r.approval_status === "not_required";
  type Agg = { minutes: number; billable: number; nonBillable: number; pending: number; rejected: number; cost: Map<string, number> };
  const empty = (): Agg => ({ minutes: 0, billable: 0, nonBillable: 0, pending: 0, rejected: 0, cost: new Map() });
  const add = (a: Agg, r: (typeof rows)[number]) => {
    const m = r.duration_minutes ?? 0;
    if (r.approval_status === "pending") a.pending += m;
    else if (r.approval_status === "rejected") a.rejected += m;
    else {
      a.minutes += m;
      if (r.billable) a.billable += m;
      else a.nonBillable += m;
      if (r.cost_amount != null && r.cost_currency) a.cost.set(r.cost_currency, (a.cost.get(r.cost_currency) ?? 0) + Number(r.cost_amount));
    }
  };
  const byProject = new Map<string, Agg & { name: string }>();
  const byUser = new Map<string, Agg>();
  const total = empty();
  for (const r of rows) {
    add(total, r);
    const pk = r.project_id ?? "none";
    const pa = byProject.get(pk) ?? { ...empty(), name: (r.projects as unknown as { name: string } | null)?.name ?? "—" };
    add(pa, r);
    byProject.set(pk, pa);
    const ua = byUser.get(r.user_id) ?? empty();
    add(ua, r);
    byUser.set(r.user_id, ua);
  }
  // Estimated vs actual: every task of the reported projects (estimates are per task).
  const projectIds = [...byProject.keys()].filter((k) => k !== "none");
  const { data: tasks } = projectIds.length ? await db().from("tasks").select("id, project_id, title, estimated_minutes").in("project_id", projectIds).is("archived_at", null) : { data: [] as { id: string; project_id: string; title: string; estimated_minutes: number | null }[] };
  // Actual per task over all time (estimate vs lifetime actual), counted hours only.
  const taskIds = (tasks ?? []).map((t) => t.id);
  const { data: allTime } = taskIds.length ? await db().from("time_entries").select("task_id, duration_minutes, approval_status").in("task_id", taskIds).not("ended_at", "is", null) : { data: [] as { task_id: string; duration_minutes: number | null; approval_status: string }[] };
  const actualByTask = new Map<string, number>();
  for (const e of allTime ?? []) if (e.approval_status === "approved" || e.approval_status === "not_required") actualByTask.set(e.task_id!, (actualByTask.get(e.task_id!) ?? 0) + (e.duration_minutes ?? 0));
  const estByProject = new Map<string, { estimated: number; actual: number; withEstimate: number; tasks: number }>();
  for (const t of tasks ?? []) {
    if (!t.project_id) continue;
    const e = estByProject.get(t.project_id) ?? { estimated: 0, actual: 0, withEstimate: 0, tasks: 0 };
    e.tasks++;
    if (t.estimated_minutes) { e.estimated += t.estimated_minutes; e.withEstimate++; e.actual += actualByTask.get(t.id) ?? 0; }
    estByProject.set(t.project_id, e);
  }
  const costList = (m: Map<string, number>) => [...m.entries()].map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 }));
  const pending = rows.filter((r) => r.approval_status === "pending");
  return {
    total: { ...total, cost: costList(total.cost) },
    projects: [...byProject.entries()].map(([id, a]) => ({ id, ...a, cost: costList(a.cost), estimate: estByProject.get(id) ?? null })).sort((a, b) => b.minutes - a.minutes),
    users: [...byUser.entries()].map(([id, a]) => ({ id, ...a, cost: costList(a.cost) })).sort((a, b) => b.minutes - a.minutes),
    tasks: f.project_id ? (tasks ?? []).map((t) => ({ id: t.id, title: t.title, estimated: t.estimated_minutes, actual: actualByTask.get(t.id) ?? 0 })).sort((a, b) => (b.actual - (b.estimated ?? 0)) - (a.actual - (a.estimated ?? 0))) : [],
    pending: pending.map((r) => ({ id: r.id, user_id: r.user_id, project: (r.projects as unknown as { name: string } | null)?.name ?? "—", task: (r.tasks as unknown as { title: string } | null)?.title ?? null, started_at: r.started_at, minutes: r.duration_minutes ?? 0, description: r.description, billable: r.billable })),
  };
}
