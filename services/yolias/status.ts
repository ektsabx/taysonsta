import "server-only";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { ValidationError } from "@/lib/bos/errors";
import { ydb, type YTables } from "@/lib/yolias/db";
import { parseStatusSettings, STATUS_SETTINGS_KEY, type StatusSettings } from "../../Yolias/lib/status/checks-config";

// Yolias Admin → Platform → Status (D-181): the components shown on
// yolias.com/status, their latest checks, the check settings, and incidents
// / maintenance with their public updates. Incident history is never deleted.

export type Component = YTables<"status_components">;
export type Incident = YTables<"status_incidents">;

const INCIDENT_STATUSES = ["investigating", "identified", "monitoring", "resolved"] as const;
const MAINTENANCE_STATUSES = ["scheduled", "in_progress", "completed"] as const;
const IMPACTS = ["degraded", "partial_outage", "major_outage", "maintenance"] as const;
const actorOf = (bos: BosUser) => bos.email || bos.userId;

export async function overview() {
  const db = ydb();
  const [{ data: comps }, { data: checks }, { data: incidents }, { data: s }] = await Promise.all([
    db.from("status_components").select("*").order("sort"),
    db.from("status_checks").select("component_id, status, latency_ms, detail, checked_at").order("checked_at", { ascending: false }).limit(140),
    db.from("status_incidents").select("*").order("started_at", { ascending: false }).limit(50),
    db.from("site_settings").select("value").eq("key", STATUS_SETTINGS_KEY).maybeSingle(),
  ]);
  const ids = (incidents ?? []).map((i) => i.id);
  const { data: updates } = ids.length ? await db.from("status_incident_updates").select("*").in("incident_id", ids).order("created_at", { ascending: false }) : { data: [] };
  return {
    components: comps ?? [],
    checks: checks ?? [],
    incidents: (incidents ?? []).map((i) => ({ ...i, updates: (updates ?? []).filter((u) => u.incident_id === i.id) })),
    settings: parseStatusSettings(s?.value),
  };
}

export async function saveComponent(bos: BosUser, id: string, input: { name_en: string; name_ar: string; description_en: string; description_ar: string; is_public: boolean; check_enabled: boolean; sort: number }) {
  if (!/^[a-z_]{2,30}$/.test(id)) throw new ValidationError("خدمة غير صالحة.");
  const en = input.name_en.trim(), ar = input.name_ar.trim();
  if (!en || !ar || en.length > 60 || ar.length > 60) throw new ValidationError("الاسم بالعربية والإنجليزية مطلوب (حتى 60 حرفًا).");
  const { data: before } = await ydb().from("status_components").select("*").eq("id", id).maybeSingle();
  if (!before) throw new ValidationError("الخدمة غير موجودة.");
  const patch = { name_en: en, name_ar: ar, description_en: input.description_en.trim().slice(0, 200) || null, description_ar: input.description_ar.trim().slice(0, 200) || null, is_public: input.is_public, check_enabled: input.check_enabled, sort: Number.isFinite(input.sort) ? Math.round(input.sort) : before.sort };
  const { error } = await ydb().from("status_components").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  await audit({ actorId: bos.userId, action: "yolias.status.component", entityType: "yolias_status_component", entityId: null, oldValue: before, newValue: { id, ...patch } });
}

export async function saveSettings(bos: BosUser, input: Partial<Record<keyof StatusSettings, number>>) {
  const v = parseStatusSettings(input);
  if (v.queueOutageMinutes <= v.queueDegradedMinutes) throw new ValidationError("حد التوقف يجب أن يكون أكبر من حد البطء.");
  if (v.failureRateOutage <= v.failureRateDegraded) throw new ValidationError("نسبة التوقف يجب أن تكون أكبر من نسبة البطء.");
  const { data: before } = await ydb().from("site_settings").select("value").eq("key", STATUS_SETTINGS_KEY).maybeSingle();
  const { error } = await ydb().from("site_settings").upsert({ key: STATUS_SETTINGS_KEY, value: v as never, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  await audit({ actorId: bos.userId, action: "yolias.status.settings", entityType: "yolias_site_setting", entityId: null, oldValue: before?.value ?? null, newValue: v });
}

export async function createIncident(bos: BosUser, input: { kind: "incident" | "maintenance"; title: string; impact: string; components: string[]; body: string; scheduledFor?: string | null; scheduledUntil?: string | null }) {
  const title = input.title.trim();
  if (title.length < 3 || title.length > 200) throw new ValidationError("العنوان من 3 إلى 200 حرف.", { title: "مطلوب" });
  const body = input.body.trim();
  if (body.length < 3) throw new ValidationError("اكتب التحديث الأول للعملاء.", { body: "مطلوب" });
  const impact = input.kind === "maintenance" ? "maintenance" : input.impact;
  if (!(IMPACTS as readonly string[]).includes(impact)) throw new ValidationError("درجة التأثير غير صالحة.");
  const { data: comps } = await ydb().from("status_components").select("id");
  const valid = new Set((comps ?? []).map((c) => c.id));
  const components = [...new Set(input.components)].filter((c) => valid.has(c));
  if (!components.length) throw new ValidationError("اختر خدمة متأثرة واحدة على الأقل.", { components: "مطلوب" });
  let scheduled_for: string | null = null, scheduled_until: string | null = null;
  if (input.kind === "maintenance") {
    if (!input.scheduledFor || Number.isNaN(Date.parse(input.scheduledFor))) throw new ValidationError("حدد موعد بداية الصيانة.", { scheduledFor: "مطلوب" });
    scheduled_for = new Date(input.scheduledFor).toISOString();
    if (input.scheduledUntil) {
      if (Number.isNaN(Date.parse(input.scheduledUntil)) || Date.parse(input.scheduledUntil) <= Date.parse(scheduled_for)) throw new ValidationError("نهاية الصيانة بعد بدايتها.", { scheduledUntil: "غير صالح" });
      scheduled_until = new Date(input.scheduledUntil).toISOString();
    }
  }
  const status = input.kind === "maintenance" ? "scheduled" : "investigating";
  const { data, error } = await ydb().from("status_incidents").insert({
    title, kind: input.kind, impact: impact as Incident["impact"], status, components, created_by: actorOf(bos),
    started_at: scheduled_for ?? new Date().toISOString(), scheduled_for, scheduled_until,
  }).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "insert failed");
  await ydb().from("status_incident_updates").insert({ incident_id: data.id, status, body, created_by: actorOf(bos) });
  await audit({ actorId: bos.userId, action: "yolias.status.incident_created", entityType: "yolias_status_incident", entityId: data.id, newValue: { title, kind: input.kind, impact, components } });
  return data.id;
}

export async function addUpdate(bos: BosUser, id: string, input: { status: string; body: string; impact?: string | null }) {
  const { data: inc } = await ydb().from("status_incidents").select("*").eq("id", id).maybeSingle();
  if (!inc) throw new ValidationError("الحادث غير موجود.");
  const allowed: readonly string[] = inc.kind === "maintenance" ? MAINTENANCE_STATUSES : INCIDENT_STATUSES;
  if (!allowed.includes(input.status)) throw new ValidationError("حالة غير صالحة.");
  if (inc.status === "resolved" || inc.status === "completed") throw new ValidationError("الحادث مغلق. أنشئ حادثًا جديدًا إن عادت المشكلة.");
  const body = input.body.trim();
  if (body.length < 3) throw new ValidationError("اكتب نص التحديث.", { body: "مطلوب" });
  const closing = input.status === "resolved" || input.status === "completed";
  const impact = inc.kind === "incident" && input.impact && (IMPACTS as readonly string[]).includes(input.impact) && input.impact !== "maintenance" ? input.impact : inc.impact;
  const { error } = await ydb().from("status_incidents").update({ status: input.status as Incident["status"], impact: impact as Incident["impact"], resolved_at: closing ? new Date().toISOString() : null }).eq("id", id).eq("status", inc.status);
  if (error) throw new Error(error.message);
  await ydb().from("status_incident_updates").insert({ incident_id: id, status: input.status, body, created_by: actorOf(bos) });
  await audit({ actorId: bos.userId, action: "yolias.status.incident_update", entityType: "yolias_status_incident", entityId: id, oldValue: { status: inc.status, impact: inc.impact }, newValue: { status: input.status, impact } });
}
