import { nowIso } from "@/lib/bos/clock";
import "server-only";
import { db, dec, type Tables } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { audit, diffFields } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { attainment, kpiMetricMap, periodRange } from "@/lib/bos/kpi-metrics";

// KPI engine (§37–38): configurable definitions, role-based or explicit
// assignments, computed values from the metric registry, manual values.

export type Kpi = Tables<"kpis">;

export async function listKpis(includeInactive = false) {
  let q = db().from("kpis").select("*, roles(name, key), departments(name)").order("category").order("name");
  if (!includeInactive) q = q.eq("is_active", true);
  const { data } = await q;
  return data ?? [];
}

export async function getKpi(id: string) {
  const { data } = await db().from("kpis").select("*, roles(name, key), departments(name)").eq("id", id).maybeSingle();
  if (!data) throw new NotFoundError();
  const { data: assignments } = await db().from("kpi_assignments").select("*").eq("kpi_id", id);
  return { ...data, assignments: assignments ?? [] };
}

export interface KpiInput {
  name: string;
  description: string | null;
  category: string | null;
  role_id: string | null;
  department_id: string | null;
  owner_id: string | null;
  data_source: string;
  calculation: Kpi["calculation"];
  unit: Kpi["unit"];
  direction: Kpi["direction"];
  target: string;
  period: Kpi["period"];
  weight: string | null;
  weight_enabled: boolean;
  is_active: boolean;
}

async function validateWeights(input: KpiInput, id?: string) {
  if (!input.weight_enabled || !input.role_id) return;
  if (input.weight == null) throw new ValidationError("أدخل الوزن عند تفعيل الأوزان.", { weight: "مطلوب" });
  let q = db().from("kpis").select("id, weight").eq("role_id", input.role_id).eq("weight_enabled", true).eq("is_active", true).eq("period", input.period);
  if (id) q = q.neq("id", id);
  const { data } = await q;
  const total = (data ?? []).reduce((s, k) => s + Number(k.weight ?? 0), 0) + Number(input.weight);
  if (total > 100) throw new ValidationError(`مجموع أوزان مؤشرات هذا الدور سيصبح ${total}% (الحد 100%).`, { weight: "يتجاوز 100%" });
}

export async function createKpi(bos: BosUser, input: KpiInput) {
  if (input.data_source !== "manual" && !kpiMetricMap.has(input.data_source)) throw new ValidationError("مصدر البيانات غير مدعوم.", { data_source: "غير مدعوم" });
  await validateWeights(input);
  const { data, error } = await db().from("kpis").insert({ ...input, calculation: input.data_source === "manual" ? "manual" : input.calculation, target: dec(input.target), weight: dec(input.weight), created_by: bos.userId }).select("*").single();
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "kpi.created", entityType: "kpi", entityId: data.id, newValue: input });
  return data;
}

export async function updateKpi(bos: BosUser, id: string, input: KpiInput) {
  const before = await getKpi(id);
  if (input.data_source !== "manual" && !kpiMetricMap.has(input.data_source)) throw new ValidationError("مصدر البيانات غير مدعوم.", { data_source: "غير مدعوم" });
  await validateWeights(input, id);
  const row = { ...input, calculation: input.data_source === "manual" ? ("manual" as const) : input.calculation, target: dec(input.target), weight: dec(input.weight) };
  const { error } = await db().from("kpis").update(row).eq("id", id);
  if (error) throw error;
  const diff = diffFields(before as unknown as Record<string, unknown>, row as unknown as Record<string, unknown>, ["name", "target", "period", "weight", "weight_enabled", "data_source", "role_id", "is_active", "direction"]);
  if (diff.changed) await audit({ actorId: bos.userId, action: "kpi.updated", entityType: "kpi", entityId: id, oldValue: diff.oldValue, newValue: diff.newValue });
}

export async function setKpiAssignment(bos: BosUser, kpiId: string, userId: string, assigned: boolean, targetOverride: string | null) {
  if (assigned) {
    await db().from("kpi_assignments").upsert({ kpi_id: kpiId, user_id: userId, target_override: dec(targetOverride) }, { onConflict: "kpi_id,user_id" });
  } else {
    await db().from("kpi_assignments").delete().eq("kpi_id", kpiId).eq("user_id", userId);
  }
  await audit({ actorId: bos.userId, action: assigned ? "kpi.assigned" : "kpi.unassigned", entityType: "kpi", entityId: kpiId, newValue: { user_id: userId, target_override: targetOverride } });
  const { data: emp } = await db().from("employees").select("id").eq("user_id", userId).maybeSingle();
  if (emp) {
    const { refreshEmployeeOnboardingSafe } = await import("@/services/bos/employees");
    await refreshEmployeeOnboardingSafe(emp.id, bos.userId);
  }
}

// Effective KPIs for a user: role-based definitions for the user's roles plus
// explicit assignments (explicit target override wins).
export async function kpisForUser(userId: string) {
  const [{ data: roles }, { data: explicit }, all] = await Promise.all([
    db().from("user_roles").select("role_id").eq("user_id", userId),
    db().from("kpi_assignments").select("kpi_id, target_override").eq("user_id", userId),
    listKpis(),
  ]);
  const roleIds = new Set((roles ?? []).map((r) => r.role_id));
  const overrides = new Map((explicit ?? []).map((e) => [e.kpi_id, e.target_override]));
  return all
    .filter((k) => (k.role_id && roleIds.has(k.role_id)) || overrides.has(k.id))
    .map((k) => ({ kpi: k, target: overrides.get(k.id) != null ? Number(overrides.get(k.id)) : Number(k.target) }));
}

export async function computeUserKpis(userId: string, date: string, persist: boolean) {
  const kpis = await kpisForUser(userId);
  const results = [];
  for (const { kpi, target } of kpis) {
    const { start, end } = periodRange(kpi.period, date);
    let actual: number | null = null;
    let valid = true;
    if (kpi.calculation === "manual" || kpi.data_source === "manual") {
      const { data: v } = await db().from("kpi_values").select("actual").eq("kpi_id", kpi.id).eq("user_id", userId).eq("period_start", start).maybeSingle();
      actual = v?.actual != null ? Number(v.actual) : null;
    } else if (!kpiMetricMap.has(kpi.data_source)) {
      valid = false; // data source removed → KPI invalid, not computed (edge case)
    } else {
      const { data: v, error } = await db().rpc("bos_kpi_actual", { p_source: kpi.data_source, p_user: userId, p_start: start, p_end: end });
      if (error) throw error;
      actual = v == null ? null : Number(v);
      if (persist && actual != null) {
        await db().from("kpi_values").upsert({ kpi_id: kpi.id, user_id: userId, period_start: start, period_end: end, actual: dec(String(actual)), target: dec(String(target)), computed_at: nowIso() }, { onConflict: "kpi_id,user_id,period_start" });
      }
    }
    results.push({ kpi, target, actual, start, end, valid, attainment: valid ? attainment(actual, target, kpi.direction) : null });
  }
  return results;
}

export async function saveManualKpiValue(bos: BosUser, kpiId: string, userId: string, date: string, actual: string, note: string | null) {
  const kpi = await getKpi(kpiId);
  if (kpi.calculation !== "manual" && kpi.data_source !== "manual") throw new ValidationError("هذا المؤشر يُحسب تلقائياً.");
  const { start, end } = periodRange(kpi.period, date);
  const override = kpi.assignments.find((a) => a.user_id === userId)?.target_override;
  await db().from("kpi_values").upsert({ kpi_id: kpiId, user_id: userId, period_start: start, period_end: end, actual: dec(actual), target: override ?? kpi.target, note, computed_at: nowIso() }, { onConflict: "kpi_id,user_id,period_start" });
  await audit({ actorId: bos.userId, action: "kpi.value_entered", entityType: "kpi", entityId: kpiId, newValue: { user_id: userId, period_start: start, actual, note } });
}

// Period close sweep: persist computed values for every active employee.
export async function computeAllKpis(date: string) {
  const { data: emps } = await db().from("employees").select("user_id").not("user_id", "is", null).in("lifecycle_status", ["active", "on_leave", "onboarding"]);
  let n = 0;
  for (const e of emps ?? []) {
    const r = await computeUserKpis(e.user_id as string, date, true);
    n += r.length;
  }
  await emitEvent({ type: "kpi.period_computed", entityType: "system", entityId: "00000000-0000-0000-0000-000000000000", summary: `KPI values computed for ${date}`, actorType: "system", payload: { values: n } });
  return n;
}

export async function kpiHistory(userId: string, kpiId: string) {
  const { data } = await db().from("kpi_values").select("*").eq("user_id", userId).eq("kpi_id", kpiId).order("period_start", { ascending: false }).limit(12);
  return data ?? [];
}
