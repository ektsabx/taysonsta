import { nowIso } from "@/lib/bos/clock";
import "server-only";
import { z } from "zod";
import type { Json } from "@/types/database";
import { db } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { saveSetting, type SettingKey } from "@/lib/bos/settings";
import { configTables, type FieldSpec } from "@/lib/bos/config-tables";
import { permissionActions, permissionModules } from "@/lib/bos/permissions";
import { eventMap } from "@/lib/bos/event-types";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";

// Settings administration (docs/bos/22): every change validated and audited
// (old/new); security-relevant changes notify Super Admins.

const securityKeys: SettingKey[] = ["security", "approval_policies", "integrations"];

async function notifySuperAdmins(bos: BosUser, summary: string, payload: Record<string, unknown>) {
  await emitEvent({ type: "security.settings_changed", entityType: "system", entityId: "00000000-0000-0000-0000-000000000000", summary, actorId: bos.userId, payload });
  const { data: role } = await db().from("roles").select("id").eq("key", "super_admin").single();
  const { data: users } = role ? await db().from("user_roles").select("user_id").eq("role_id", role.id) : { data: [] };
  const { insertNotifications } = await import("@/lib/bos/notify");
  await insertNotifications((users ?? []).filter((u) => u.user_id !== bos.userId).map((u) => ({ userId: u.user_id, eventId: null, eventType: "security.settings_changed", title: summary, body: `${bos.employee.full_name}`, link: "/admin/settings/audit-logs", channels: ["in_app"], locked: true })));
}

export async function saveSettingSection(bos: BosUser, key: SettingKey, value: unknown) {
  let result;
  try {
    result = await saveSetting(key, value, bos.userId);
  } catch (e) {
    if (e instanceof z.ZodError) throw new ValidationError(`قيم غير صالحة: ${e.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("، ")}`);
    throw e;
  }
  if (key === "company") {
    const tz = (result.after as { timezone: string }).timezone;
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
    } catch {
      throw new ValidationError("المنطقة الزمنية غير صالحة.");
    }
  }
  await audit({ actorId: bos.userId, action: "settings.updated", entityType: "settings", entityId: null, oldValue: result.before, newValue: result.after, metadata: { key } });
  if (securityKeys.includes(key)) await notifySuperAdmins(bos, `Security setting changed: ${key}`, { key });
  return result.after;
}

// ---------------------------------------------------------------------------
// Generic config tables
// ---------------------------------------------------------------------------

function fieldSchema(f: FieldSpec): z.ZodTypeAny {
  const empty = (v: unknown) => (v === "" || v === undefined ? null : v);
  let s: z.ZodTypeAny;
  switch (f.type) {
    case "number":
      s = z.preprocess(empty, z.coerce.number().min(f.min ?? -1e12).max(f.max ?? 1e12).nullable());
      break;
    case "money":
      s = z.preprocess((v) => (typeof v === "string" ? (v.replace(/[,\s]/g, "") || null) : empty(v)), z.string().regex(/^\d+(\.\d{1,3})?$/, `${f.label} غير صالح`).nullable());
      break;
    case "boolean":
      s = z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean());
      break;
    case "date":
      s = z.preprocess(empty, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح").nullable());
      break;
    case "time":
      s = z.preprocess(empty, z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "وقت غير صالح").nullable());
      break;
    case "weekdays":
      s = z.array(z.coerce.number().int().min(0).max(6)).min(1, "اختر يوماً واحداً على الأقل");
      break;
    case "json":
      s = z.preprocess((v) => {
        if (typeof v !== "string") return v ?? [];
        try {
          return JSON.parse(v || "[]");
        } catch {
          return "__invalid__";
        }
      }, z.array(z.any(), { message: "JSON غير صالح (يجب أن يكون مصفوفة)" }));
      break;
    case "user":
    case "role":
    case "department":
    case "product":
      s = z.preprocess(empty, z.string().uuid().nullable());
      break;
    case "currency":
      s = z.preprocess(empty, z.string().regex(/^[A-Z]{3}$/, "عملة غير صالحة").nullable());
      break;
    case "list":
      s = z.preprocess((v) => (Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,،\n]/).map((x) => x.trim()).filter(Boolean) : []), z.array(z.string().max(200)).nullable());
      if (f.required) s = s.refine((v) => Array.isArray(v) && v.length > 0, `${f.label} مطلوب`);
      return s;
    case "select":
      s = z.preprocess(empty, z.string().nullable().refine((v) => v === null || !f.options || f.options.some((o) => o.value === v), "قيمة غير صالحة"));
      break;
    default:
      s = z.preprocess((v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : empty(v)), z.string().max(5000).nullable().refine((v) => v === null || !f.pattern || new RegExp(f.pattern).test(v), `${f.label} بصيغة غير صالحة`));
  }
  if (f.required) s = s.refine((v) => v !== null && v !== undefined && v !== "", `${f.label} مطلوب`);
  return s;
}

export async function listConfigRows(key: string) {
  const spec = configTables[key];
  if (!spec) throw new NotFoundError();
  const { data, error } = await db().from(spec.table as "departments").select("*").order(spec.order as "name", { ascending: spec.table === "exchange_rates" ? false : true }).limit(1000);
  if (error) throw error;
  return (data ?? []) as unknown as Record<string, unknown>[];
}

export async function saveConfigRow(bos: BosUser, key: string, id: string | null, values: Record<string, unknown>) {
  const spec = configTables[key];
  if (!spec) throw new NotFoundError();
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of spec.fields) shape[f.key] = fieldSchema(f);
  const parsed = z.object(shape).safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] = i.message;
    throw new ValidationError("بعض الحقول تحتاج إلى مراجعة.", fieldErrors);
  }
  const row: Record<string, unknown> = { ...parsed.data };
  if (key === "external_apps" && typeof row.access_levels === "string") row.access_levels = (row.access_levels as string).split(",").map((s) => s.trim()).filter(Boolean);
  if (key === "external_apps" && row.access_levels == null) row.access_levels = [];
  if (key === "external_apps" && typeof row.url === "string" && row.url && !/^https?:\/\//.test(row.url as string)) throw new ValidationError("رابط غير صالح.", { url: "http(s)://" });
  if (key === "exchange_rates") {
    if (Number(row.rate) <= 0) throw new ValidationError("السعر يجب أن يكون أكبر من صفر.", { rate: "> 0" });
    if (row.base === row.quote) throw new ValidationError("العملتان متطابقتان.", { quote: "مختلفة" });
    row.created_by = bos.userId;
  }
  if (key === "work_schedules") {
    if (String(row.end_time) <= String(row.start_time)) throw new ValidationError("وقت النهاية يجب أن يكون بعد البداية.", { end_time: "بعد البداية" });
    try {
      new Intl.DateTimeFormat("en", { timeZone: String(row.timezone) });
    } catch {
      throw new ValidationError("المنطقة الزمنية غير صالحة.", { timezone: "IANA" });
    }
    if (row.is_default) await db().from("work_schedules").update({ is_default: false }).neq("id", id ?? "00000000-0000-0000-0000-000000000000");
  }
  if (key === "commission_rules") {
    if (row.basis === "percentage" && row.rate == null) throw new ValidationError("أدخل النسبة.", { rate: "مطلوب" });
    if (row.basis === "fixed" && (row.fixed_amount == null || !row.currency)) throw new ValidationError("أدخل المبلغ والعملة.", { fixed_amount: "مطلوب" });
    if (!id) row.created_by = bos.userId;
  }
  if (key === "project_templates" && row.is_default && row.product_id) await db().from("project_templates").update({ is_default: false }).eq("product_id", row.product_id as string);
  const pk = spec.pk ?? "id";
  let before: unknown = null;
  let rowId = id;
  if (id) {
    const { data } = await db().from(spec.table as "departments").select("*").eq(pk as "id", id).maybeSingle();
    if (!data) throw new NotFoundError();
    before = data;
    const { error } = await db().from(spec.table as "departments").update(row as never).eq(pk as "id", id);
    if (error) throw friendly(error);
  } else {
    const { data, error } = await db().from(spec.table as "departments").insert(row as never).select(pk).single();
    if (error) throw friendly(error);
    rowId = String((data as unknown as Record<string, unknown>)[pk]);
  }
  await audit({ actorId: bos.userId, action: id ? "settings.row_updated" : "settings.row_created", entityType: spec.table, entityId: pk === "id" ? rowId : null, oldValue: before, newValue: row, metadata: { table: spec.table, key: rowId } });
  return rowId;
}

function friendly(error: { code?: string; message: string }) {
  if (error.code === "23505") return new ValidationError("القيمة مستخدمة بالفعل (مكررة).");
  if (error.code === "23514") return new ValidationError(`القيم لا تستوفي شروط الجدول: ${error.message}`);
  if (error.code === "23503") return new ValidationError("السجل مرتبط بسجلات أخرى.");
  return error as unknown as Error;
}

// Delete when unused; otherwise deactivate/archive (edge case: "removing a
// currency used by records → deactivate only").
export async function removeConfigRow(bos: BosUser, key: string, id: string) {
  const spec = configTables[key];
  if (!spec) throw new NotFoundError();
  const pk = spec.pk ?? "id";
  const { data: before } = await db().from(spec.table as "departments").select("*").eq(pk as "id", id).maybeSingle();
  if (!before) throw new NotFoundError();
  // Referenced rows (even via ON DELETE SET NULL) are never deleted.
  const { data: refs } = await db().rpc("bos_reference_count", { p_table: spec.table, p_id: id });
  const referenced = Number(refs ?? 0) > 0;
  const { error } = referenced ? { error: { code: "23503", message: "referenced" } } : await db().from(spec.table as "departments").delete().eq(pk as "id", id);
  let mode = "deleted";
  if (error) {
    if (error.code !== "23503") throw friendly(error);
    if (!spec.softDelete) throw new ValidationError("السجل مستخدم في سجلات أخرى ولا يمكن حذفه.");
    const patch = spec.softDelete === "is_active" ? { is_active: false } : { archived_at: nowIso() };
    const { error: e2 } = await db().from(spec.table as "departments").update(patch as never).eq(pk as "id", id);
    if (e2) throw friendly(e2);
    mode = spec.softDelete === "is_active" ? "deactivated" : "archived";
  }
  await audit({ actorId: bos.userId, action: `settings.row_${mode}`, entityType: spec.table, entityId: pk === "id" ? id : null, oldValue: before, metadata: { table: spec.table, key: id } });
  return mode;
}

// ---------------------------------------------------------------------------
// Pipeline stages
// ---------------------------------------------------------------------------

export interface StageInput {
  id: string | null;
  key: string;
  name: string;
  probability: number;
  category: "open" | "won" | "lost";
  is_active: boolean;
}

export async function savePipelineStages(bos: BosUser, pipelineId: string, stages: StageInput[]) {
  const { data: pipeline } = await db().from("pipelines").select("id, entity").eq("id", pipelineId).maybeSingle();
  if (!pipeline) throw new NotFoundError();
  const active = stages.filter((s) => s.is_active);
  if (!active.some((s) => s.category === "open")) throw new ValidationError("يجب وجود مرحلة مفتوحة واحدة على الأقل.");
  if (pipeline.entity === "deal") {
    if (active.filter((s) => s.category === "won").length !== 1) throw new ValidationError("يجب وجود مرحلة «مكسوبة» واحدة بالضبط.");
    if (active.filter((s) => s.category === "lost").length !== 1) throw new ValidationError("يجب وجود مرحلة «خاسرة» واحدة بالضبط.");
  }
  const keys = stages.map((s) => s.key.trim());
  if (new Set(keys).size !== keys.length) throw new ValidationError("مفاتيح المراحل يجب أن تكون فريدة.");
  for (const s of stages) {
    if (!/^[a-z_]+$/.test(s.key)) throw new ValidationError(`مفتاح غير صالح: ${s.key}`);
    if (!s.name.trim()) throw new ValidationError("اسم المرحلة مطلوب.");
    if (s.probability < 0 || s.probability > 100) throw new ValidationError("الاحتمالية من 0 إلى 100.");
  }
  const { data: before } = await db().from("pipeline_stages").select("*").eq("pipeline_id", pipelineId).order("sort_order");
  // Removed stages: delete if unused, otherwise deactivate.
  const keep = new Set(stages.map((s) => s.id).filter(Boolean));
  for (const old of before ?? []) {
    if (keep.has(old.id)) continue;
    const { data: refs } = await db().rpc("bos_reference_count", { p_table: "pipeline_stages", p_id: old.id });
    const { error } = Number(refs ?? 0) > 0 ? { error: true } : await db().from("pipeline_stages").delete().eq("id", old.id);
    if (error) await db().from("pipeline_stages").update({ is_active: false }).eq("id", old.id);
  }
  for (const [i, s] of stages.entries()) {
    const row = { pipeline_id: pipelineId, key: s.key, name: s.name.trim(), probability: s.probability, category: s.category, is_active: s.is_active, sort_order: i + 1 };
    if (s.id) {
      const { error } = await db().from("pipeline_stages").update(row).eq("id", s.id);
      if (error) throw friendly(error);
    } else {
      const { error } = await db().from("pipeline_stages").insert(row);
      if (error) throw friendly(error);
    }
  }
  await audit({ actorId: bos.userId, action: "settings.pipeline_updated", entityType: "pipeline", entityId: pipelineId, oldValue: before, newValue: stages });
}

// ---------------------------------------------------------------------------
// Roles & permissions
// ---------------------------------------------------------------------------

export async function saveRole(bos: BosUser, id: string | null, input: { key: string; name: string; description: string | null; sort_order: number }) {
  if (!/^[a-z_]+$/.test(input.key)) throw new ValidationError("مفتاح الدور بأحرف إنجليزية صغيرة و _ فقط.", { key: "غير صالح" });
  if (!input.name.trim()) throw new ValidationError("الاسم مطلوب.", { name: "مطلوب" });
  if (id) {
    const { data: before } = await db().from("roles").select("*").eq("id", id).single();
    if (before?.is_system && before.key !== input.key) throw new ValidationError("لا يمكن تغيير مفتاح دور نظامي.");
    const { error } = await db().from("roles").update(input).eq("id", id);
    if (error) throw friendly(error);
    await audit({ actorId: bos.userId, action: "role.updated", entityType: "role", entityId: id, oldValue: before, newValue: input });
    await notifySuperAdmins(bos, `Role updated: ${input.name}`, { role_id: id });
    return id;
  }
  const { data, error } = await db().from("roles").insert({ ...input, is_system: false }).select("id").single();
  if (error) throw friendly(error);
  await audit({ actorId: bos.userId, action: "role.created", entityType: "role", entityId: data.id, newValue: input });
  return data.id;
}

export async function cloneRole(bos: BosUser, sourceId: string, key: string, name: string) {
  const id = await saveRole(bos, null, { key, name, description: `Cloned`, sort_order: 100 });
  const { data: perms } = await db().from("role_permissions").select("permission_id, scope").eq("role_id", sourceId);
  if (perms?.length) await db().from("role_permissions").insert(perms.map((p) => ({ ...p, role_id: id })));
  await audit({ actorId: bos.userId, action: "role.cloned", entityType: "role", entityId: id, newValue: { source: sourceId, permissions: perms?.length ?? 0 } });
  return id;
}

export async function archiveRole(bos: BosUser, id: string, archived: boolean) {
  const { data: role } = await db().from("roles").select("*").eq("id", id).single();
  if (!role) throw new NotFoundError();
  if (role.is_system && archived) throw new ValidationError("الأدوار النظامية لا تُؤرشف.");
  if (archived) {
    const { count } = await db().from("user_roles").select("user_id", { count: "exact", head: true }).eq("role_id", id);
    if (count) throw new ValidationError(`لا يمكن الأرشفة: ${count} مستخدم لديه هذا الدور.`);
  }
  await db().from("roles").update({ archived_at: archived ? nowIso() : null }).eq("id", id);
  await audit({ actorId: bos.userId, action: archived ? "role.archived" : "role.restored", entityType: "role", entityId: id });
}

export async function permissionMatrix(roleId: string) {
  const [{ data: perms }, { data: granted }] = await Promise.all([
    db().from("permissions").select("id, key, module, action").order("module").order("action"),
    db().from("role_permissions").select("permission_id, scope").eq("role_id", roleId),
  ]);
  const scopeOf = new Map((granted ?? []).map((g) => [g.permission_id, g.scope]));
  return { modules: permissionModules, actions: permissionActions, permissions: (perms ?? []).map((p) => ({ ...p, scope: scopeOf.get(p.id) ?? null })) };
}

export async function setRolePermission(bos: BosUser, roleId: string, permissionId: string, scope: "own" | "assigned" | "team" | "all" | null) {
  const { data: role } = await db().from("roles").select("key, name").eq("id", roleId).single();
  if (role?.key === "super_admin") throw new ValidationError("صلاحيات المدير العام ثابتة (كل شيء).");
  const { data: before } = await db().from("role_permissions").select("scope").eq("role_id", roleId).eq("permission_id", permissionId).maybeSingle();
  if (scope) await db().from("role_permissions").upsert({ role_id: roleId, permission_id: permissionId, scope }, { onConflict: "role_id,permission_id" });
  else await db().from("role_permissions").delete().eq("role_id", roleId).eq("permission_id", permissionId);
  const { data: perm } = await db().from("permissions").select("key").eq("id", permissionId).single();
  await audit({ actorId: bos.userId, action: "role.permission_changed", entityType: "role", entityId: roleId, oldValue: { permission: perm?.key, scope: before?.scope ?? null }, newValue: { permission: perm?.key, scope } });
}

export async function setUserOverride(bos: BosUser, userId: string, permissionId: string, effect: "grant" | "deny" | null, scope: "own" | "assigned" | "team" | "all" | null, reason: string | null) {
  if (effect && !reason?.trim()) throw new ValidationError("السبب مطلوب للاستثناءات الفردية.");
  const { data: before } = await db().from("user_permission_overrides").select("*").eq("user_id", userId).eq("permission_id", permissionId).maybeSingle();
  if (!effect) await db().from("user_permission_overrides").delete().eq("user_id", userId).eq("permission_id", permissionId);
  else {
    const { error } = await db().from("user_permission_overrides").upsert({ user_id: userId, permission_id: permissionId, effect, scope: effect === "grant" ? scope ?? "own" : null, reason, created_by: bos.userId } as never, { onConflict: "user_id,permission_id" });
    if (error) throw friendly(error);
  }
  await audit({ actorId: bos.userId, action: "user.permission_override", entityType: "user", entityId: userId, oldValue: before, newValue: { permission_id: permissionId, effect, scope, reason } });
  await notifySuperAdmins(bos, "User permission override changed", { user_id: userId });
}

// ---------------------------------------------------------------------------
// Notification subscriptions & role tool requirements
// ---------------------------------------------------------------------------

export async function addSubscription(bos: BosUser, input: { event_type: string; kind: "role" | "user" | "relation"; value: string; channels: string[]; user_configurable: boolean }) {
  if (!eventMap.has(input.event_type) && !/^[a-z_]+\.[a-z_]+$/.test(input.event_type)) throw new ValidationError("حدث غير صالح.");
  const channels = input.channels.filter((c) => ["in_app", "email", "push"].includes(c));
  if (!channels.length) throw new ValidationError("اختر قناة واحدة على الأقل.");
  const row: Record<string, unknown> = { event_type: input.event_type, subscriber_kind: input.kind, channels, user_configurable: input.user_configurable };
  if (input.kind === "role") row.role_id = input.value;
  if (input.kind === "user") row.user_id = input.value;
  if (input.kind === "relation") row.relation = input.value;
  const { data, error } = await db().from("notification_subscriptions").insert(row as never).select("id").single();
  if (error) throw friendly(error);
  await audit({ actorId: bos.userId, action: "notification_subscription.created", entityType: "notification_subscription", entityId: data.id, newValue: row });
}

export async function setSubscriptionActive(bos: BosUser, id: string, active: boolean) {
  await db().from("notification_subscriptions").update({ is_active: active }).eq("id", id);
  await audit({ actorId: bos.userId, action: active ? "notification_subscription.enabled" : "notification_subscription.disabled", entityType: "notification_subscription", entityId: id });
}

export async function deleteSubscription(bos: BosUser, id: string) {
  const { data } = await db().from("notification_subscriptions").select("*").eq("id", id).single();
  await db().from("notification_subscriptions").delete().eq("id", id);
  await audit({ actorId: bos.userId, action: "notification_subscription.deleted", entityType: "notification_subscription", entityId: id, oldValue: data });
}

export async function setRoleAppRequirement(bos: BosUser, roleId: string, appId: string, required: boolean, level: string | null) {
  if (required) {
    const { data: app } = await db().from("external_apps").select("access_levels").eq("id", appId).single();
    if (level && app?.access_levels.length && !app.access_levels.includes(level)) throw new ValidationError("مستوى وصول غير صالح.");
    await db().from("role_app_requirements").upsert({ role_id: roleId, app_id: appId, is_required: true, default_access_level: level }, { onConflict: "role_id,app_id" });
  } else await db().from("role_app_requirements").delete().eq("role_id", roleId).eq("app_id", appId);
  await audit({ actorId: bos.userId, action: "it.role_requirement_changed", entityType: "role", entityId: roleId, newValue: { app_id: appId, required, level } });
}

export const _json = (v: unknown) => v as Json;
